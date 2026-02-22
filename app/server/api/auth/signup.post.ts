import { signUpCommand } from '~/server/services/api-boundary'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return signUpCommand(body ?? {})
})
