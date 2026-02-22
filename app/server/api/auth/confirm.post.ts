import { confirmCommand } from '~/server/services/api-boundary'
import { markLegacyRoute } from '~/server/utils/route-deprecation'

export default defineEventHandler(async (event) => {
  markLegacyRoute(event, '/api/command/auth/confirm')
  const body = await readBody(event)
  return confirmCommand(event, body ?? {})
})
