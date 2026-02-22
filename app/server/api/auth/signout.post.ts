import { signOutCommand } from '~/server/services/api-boundary'
import { markLegacyRoute } from '~/server/utils/route-deprecation'

export default defineEventHandler((event) => {
  markLegacyRoute(event, '/api/command/auth/signout')
  return signOutCommand(event)
})
