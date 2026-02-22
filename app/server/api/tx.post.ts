import { createTransactionCommand } from '~/server/services/api-boundary'
import { markLegacyRoute } from '~/server/utils/route-deprecation'

export default defineEventHandler(async (event) => {
  markLegacyRoute(event, '/api/command/tx/create')
  const body = await readBody(event).catch(() => ({}))
  return createTransactionCommand(body ?? {})
})
