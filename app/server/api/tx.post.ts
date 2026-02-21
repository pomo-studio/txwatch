/**
 * POST /api/tx
 * Fires a manual transaction to txwatch-bus via EventBridge PutEvents.
 * The event is then routed → SQS → enricher Lambda → DynamoDB → AppSync subscription.
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import crypto from 'node:crypto'

const ebClient = new EventBridgeClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

const VALID_CATEGORIES = ['grocery', 'restaurant', 'gas', 'travel', 'atm', 'online'] as const

const AMOUNT_RANGES: Record<string, [number, number]> = {
  grocery:    [10, 250],
  restaurant: [8, 200],
  gas:        [20, 120],
  travel:     [100, 3000],
  atm:        [100, 1000],
  online:     [10, 600]
}

const SUSPICIOUS_AMOUNTS = [5000, 7500, 9999, 12000]

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const body = await readBody(event).catch(() => ({}))

  const category = VALID_CATEGORIES.includes(body?.category)
    ? body.category
    : VALID_CATEGORIES[Math.floor(Math.random() * VALID_CATEGORIES.length)]

  const flagIt = body?.flagIt === true

  let amount: number
  if (flagIt) {
    amount = SUSPICIOUS_AMOUNTS[Math.floor(Math.random() * SUSPICIOUS_AMOUNTS.length)]
  } else {
    const [min, max] = AMOUNT_RANGES[category]
    amount = parseFloat((Math.random() * (max - min) + min).toFixed(2))
  }

  const detail = {
    transactionId: crypto.randomUUID(),
    amount,
    currency: 'USD',
    category,
    source: 'manual',
    publishedAt: Date.now()
  }

  const command = new PutEventsCommand({
    Entries: [{
      EventBusName: config.eventBusName || process.env.EVENT_BUS_NAME,
      Source:       'txwatch.transactions',
      DetailType:   'Transaction Created',
      Detail:       JSON.stringify(detail)
    }]
  })

  const result = await ebClient.send(command)

  if (result.FailedEntryCount && result.FailedEntryCount > 0) {
    throw createError({ statusCode: 502, statusMessage: 'EventBridge PutEvents failed' })
  }

  return {
    success: true,
    transactionId: detail.transactionId,
    category,
    amount
  }
})
