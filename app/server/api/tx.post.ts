/**
 * POST /api/tx
 * Fires a manual transaction to txwatch-bus via EventBridge PutEvents.
 * The event is then routed → SQS → enricher Lambda → DynamoDB → AppSync subscription.
 */

import { normalizeTxInput, publishManualTx, requireSession } from '../utils/tx'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  requireSession(event)

  const body = await readBody(event).catch(() => ({}))
  const { category, flagIt } = normalizeTxInput(body ?? {})

  return publishManualTx(
    config.eventBusName || process.env.EVENT_BUS_NAME || '',
    category,
    flagIt
  )
})
