/**
 * txwatch-enricher
 * Processes transactions from SQS (routed from EventBridge txwatch-bus).
 * Enriches with merchant/category data, calculates risk score,
 * writes to DynamoDB, and fires AppSync subscription via sigv4-signed mutation.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import https from 'node:https';
import crypto from 'node:crypto';

const REGION = process.env.AWS_REGION || 'us-east-1';
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
const APPSYNC_URL = process.env.APPSYNC_URL;
const DR_APPSYNC_URL = process.env.DR_APPSYNC_URL;
const DR_REGION = process.env.DR_REGION || 'us-west-2';

const dynamoPrimary = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

// Merchant data by category
const MERCHANTS = {
  grocery:    ['Whole Foods Market', 'Trader Joe\'s', 'Kroger', 'Safeway', 'Publix', 'Aldi', 'Costco'],
  restaurant: ['Chipotle', 'McDonald\'s', 'Starbucks', 'Panera Bread', 'Shake Shack', 'The Cheesecake Factory'],
  gas:        ['Shell', 'BP', 'ExxonMobil', 'Chevron', 'Sunoco', 'Marathon'],
  travel:     ['Delta Airlines', 'United Airlines', 'Marriott Hotels', 'Hilton', 'Airbnb', 'Hertz'],
  atm:        ['Chase ATM', 'Bank of America ATM', 'Wells Fargo ATM', 'Citibank ATM'],
  online:     ['Amazon', 'eBay', 'Etsy', 'Best Buy', 'Target', 'Walmart.com']
};

const SUSPICIOUS_MERCHANTS = ['CryptoXchange', 'FastCash ATM', 'QuickTransfer', 'VPN Services Inc', 'AnonymousPay'];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function calculateRiskScore(detail) {
  const amount = parseFloat(detail.amount) || 0;
  const category = detail.category || 'online';
  const merchant = detail.merchant || '';
  const hour = new Date().getUTCHours();

  let score = Math.floor(Math.random() * 30); // base noise 0-29

  if (amount > 5000) score += 40;
  else if (amount > 1000) score += 20;
  else if (amount > 500) score += 10;

  if (SUSPICIOUS_MERCHANTS.some(m => merchant.includes(m))) score += 30;
  if (category === 'atm') score += 15;
  if (hour < 6 || hour >= 22) score += 10; // after-hours

  return Math.min(score, 100);
}

async function writeToDynamo(tableName, client, tx) {
  await client.send(new PutCommand({
    TableName: tableName,
    Item: {
      PK: `TX#${tx.transactionId}`,
      SK: tx.createdAt,
      entity_type: 'TRANSACTION',
      ...tx
    }
  }));
}

async function callAppSync(tx) {
  const mutation = /* GraphQL */ `
    mutation NotifyTransaction($input: TransactionInput!) {
      notifyTransaction(input: $input) {
        transactionId
        amount
        currency
        merchant
        category
        status
        riskScore
        fraudFlag
        source
        processingRegion
        processingLatencyMs
        eventId
        createdAt
      }
    }
  `;

  return callSignedAppSync(APPSYNC_URL, REGION, mutation, tx);
}

async function callDrReplication(tx) {
  if (!DR_APPSYNC_URL) return;

  const mutation = /* GraphQL */ `
    mutation ReplicateTransaction($input: TransactionInput!) {
      replicateTransaction(input: $input) {
        transactionId
      }
    }
  `;

  return callSignedAppSync(DR_APPSYNC_URL, DR_REGION, mutation, tx);
}

async function callSignedAppSync(url, region, mutation, tx) {
  const endpoint = new URL(url);

  const body = JSON.stringify({
    query: mutation,
    variables: {
      input: {
        transactionId:      tx.transactionId,
        amount:             tx.amount,
        currency:           tx.currency,
        merchant:           tx.merchant,
        category:           tx.category,
        status:             tx.status,
        riskScore:          tx.riskScore,
        fraudFlag:          tx.fraudFlag,
        source:             tx.source,
        processingRegion:   tx.processingRegion,
        processingLatencyMs: tx.processingLatencyMs,
        eventId:            tx.eventId,
        createdAt:          tx.createdAt
      }
    }
  });

  const signer = new SignatureV4({
    credentials: fromEnv(),
    region,
    service: 'appsync',
    sha256: Sha256
  });

  const request = {
    method: 'POST',
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body).toString(),
      host: endpoint.hostname
    },
    body
  };

  const signed = await signer.sign(request);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: endpoint.hostname,
      path: endpoint.pathname,
      method: 'POST',
      headers: signed.headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          reject(new Error(`AppSync ${url} returned non-JSON response`));
          return;
        }

        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`AppSync ${url} HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          return;
        }

        if (parsed.errors && parsed.errors.length > 0) {
          reject(new Error(`AppSync ${url} GraphQL errors: ${JSON.stringify(parsed.errors)}`));
          return;
        }

        resolve(parsed);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function handler(event) {
  const results = [];

  for (const record of event.Records) {
    const publishedAt = Date.now();

    // SQS wraps the EventBridge event as the message body
    const ebEvent = JSON.parse(record.body);
    const detail = ebEvent.detail || {};
    const eventId = ebEvent.id || crypto.randomUUID();

    const txId = detail.transactionId || crypto.randomUUID();
    const category = detail.category || pickRandom(Object.keys(MERCHANTS));
    const merchant = detail.merchant || pickRandom(MERCHANTS[category] || MERCHANTS.online);
    const amount = parseFloat(detail.amount) || parseFloat((Math.random() * 800 + 10).toFixed(2));
    const source = detail.source || 'auto';

    const enrichedDetail = {
      ...detail,
      transactionId: txId,
      category,
      merchant,
      amount
    };

    const riskScore = calculateRiskScore(enrichedDetail);
    const fraudFlag = riskScore > 70;
    const now = new Date().toISOString();

    const tx = {
      transactionId:       txId,
      amount,
      currency:            detail.currency || 'USD',
      merchant,
      category,
      status:              fraudFlag ? 'flagged' : 'cleared',
      riskScore,
      fraudFlag,
      source,
      processingRegion:    REGION,
      processingLatencyMs: Date.now() - publishedAt,
      eventId,
      createdAt:           now
    };

    try {
      await writeToDynamo(DYNAMODB_TABLE, dynamoPrimary, tx);
      console.log(`[enricher] wrote ${txId} to DynamoDB primary`);

      await callAppSync(tx);
      console.log(`[enricher] notified AppSync for ${txId}`);

      await callDrReplication(tx);
      console.log(`[enricher] replicated ${txId} into DR AppSync`);

      results.push({ txId, success: true });
    } catch (err) {
      console.error(`[enricher] failed for ${txId}:`, err);
      results.push({ txId, success: false, error: err.message });
      throw err; // let SQS retry
    }
  }

  return { processed: results.length, results };
}
