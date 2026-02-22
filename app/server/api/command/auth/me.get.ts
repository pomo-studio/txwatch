import { getSessionCommand } from '~/server/services/api-boundary'

export default defineEventHandler((event) => {
  return getSessionCommand(event)
})
