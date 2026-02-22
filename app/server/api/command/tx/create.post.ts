import { createTransactionCommand } from '~/server/services/api-boundary'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return createTransactionCommand(body ?? {})
})
