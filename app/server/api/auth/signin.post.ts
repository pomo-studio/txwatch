import { signInCommand } from '~/server/services/api-boundary'
import { markLegacyRoute } from '~/server/utils/route-deprecation'

export default defineEventHandler(async (event) => {
  markLegacyRoute(event, '/api/command/auth/signin')
  const body = await readBody(event)
  return signInCommand(event, body ?? {})
})
