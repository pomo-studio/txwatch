import { signInCommand } from '~/server/services/api-boundary'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return signInCommand(event, body ?? {})
})
