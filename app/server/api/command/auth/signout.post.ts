import { signOutCommand } from '~/server/services/api-boundary'

export default defineEventHandler((event) => {
  return signOutCommand(event)
})
