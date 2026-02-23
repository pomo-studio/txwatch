import { getQuery } from 'h3'
import { normalizeTxInput, publishManualTx, requireSession } from '../utils/tx'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  requireSession(event)

  const query = getQuery(event)
  const { category, flagIt } = normalizeTxInput({
    category: typeof query.category === 'string' ? query.category : undefined,
    flagIt: typeof query.flagIt === 'string' ? query.flagIt : undefined
  })

  return publishManualTx(
    config.eventBusName || process.env.EVENT_BUS_NAME || '',
    category,
    flagIt
  )
})
