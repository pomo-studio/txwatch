/**
 * txwatch-generator
 * Invoked by EventBridge Scheduler every 30 seconds.
 * Generates a random transaction and publishes it to txwatch-bus.
 * The event-pipeline module routes it → SQS → enricher Lambda.
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import crypto from 'node:crypto';

const REGION = process.env.AWS_REGION || 'us-east-1';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;

const ebClient = new EventBridgeClient({ region: REGION });

const CATEGORIES = ['grocery', 'restaurant', 'gas', 'travel', 'atm', 'online'];

const AMOUNTS_BY_CATEGORY = {
  grocery:    [12.50, 34.99, 67.25, 145.80, 203.45],
  restaurant: [8.75, 23.50, 47.00, 89.99, 156.00],
  gas:        [25.00, 45.00, 65.50, 85.00, 110.00],
  travel:     [199.00, 450.00, 750.00, 1200.00, 2800.00],
  atm:        [100.00, 200.00, 300.00, 500.00, 1000.00],
  online:     [15.99, 49.99, 99.00, 229.00, 599.00]
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount(category) {
  const base = pickRandom(AMOUNTS_BY_CATEGORY[category] || AMOUNTS_BY_CATEGORY.online);
  const noise = (Math.random() - 0.5) * base * 0.2;
  return parseFloat((base + noise).toFixed(2));
}

export async function handler(event) {
  const category = pickRandom(CATEGORIES);
  const amount = randomAmount(category);
  const txId = crypto.randomUUID();
  const publishedAt = Date.now();

  const detail = {
    transactionId: txId,
    amount,
    currency: 'USD',
    category,
    source: 'auto',
    publishedAt
  };

  const command = new PutEventsCommand({
    Entries: [{
      EventBusName: EVENT_BUS_NAME,
      Source:       'txwatch.transactions',
      DetailType:   'Transaction Created',
      Detail:       JSON.stringify(detail)
    }]
  });

  const result = await ebClient.send(command);

  if (result.FailedEntryCount > 0) {
    console.error('[generator] PutEvents failed:', JSON.stringify(result.Entries));
    throw new Error('EventBridge PutEvents failed');
  }

  console.log(`[generator] published ${txId} (${category}, $${amount})`);
  return { txId, category, amount };
}
