/**
 * GET /api/txfeed
 * Server-side query for initial transaction list.
 * Uses AppSync API_KEY auth — key never leaves the Lambda environment.
 */

import https from 'node:https'

const LIST_TRANSACTIONS = /* GraphQL */ `
  query ListTransactions($limit: Int) {
    listTransactions(limit: $limit) {
      items {
        transactionId
        amount
        currency
        merchant
        category
        status
        riskScore
        fraudFlag
        source
        processingRegion
        processingLatencyMs
        eventId
        createdAt
      }
      nextToken
    }
  }
`

function appsyncRequest(url: string, apiKey: string, query: string, variables: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables })
    const endpoint = new URL(url)

    const req = https.request({
      hostname: endpoint.hostname,
      path:     endpoint.pathname,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Content-Length':  Buffer.byteLength(body).toString(),
        'x-api-key':       apiKey
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(JSON.parse(data)))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  const appsyncUrl = config.appsyncUrl || process.env.APPSYNC_URL
  const apiKey     = config.appsyncApiKey || process.env.APPSYNC_API_KEY

  if (!appsyncUrl || !apiKey) {
    console.warn('[txfeed] APPSYNC_URL or APPSYNC_API_KEY not configured — returning empty feed')
    return { items: [], nextToken: null }
  }

  try {
    const result = await appsyncRequest(appsyncUrl, apiKey, LIST_TRANSACTIONS, { limit: 20 })
    return result?.data?.listTransactions ?? { items: [], nextToken: null }
  } catch (err) {
    console.error('[txfeed] AppSync query failed:', err)
    return { items: [], nextToken: null }
  }
})
