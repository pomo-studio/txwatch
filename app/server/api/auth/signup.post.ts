import { signUpCommand } from '~/server/services/api-boundary'
import { markLegacyRoute } from '~/server/utils/route-deprecation'

export default defineEventHandler(async (event) => {
  markLegacyRoute(event, '/api/command/auth/signup')
  const body = await readBody(event)
  return signUpCommand(body ?? {})
})
