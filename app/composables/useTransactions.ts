/**
 * useTransactions composable
 * Real-time transaction feed via AppSync WebSocket subscription.
 * Uses the AppSync graphql-ws protocol directly — no Amplify dependency.
 * Token is fetched server-side via /api/command/auth/me and kept in memory only.
 */

export interface Transaction {
  transactionId:       string
  amount:              number
  currency:            string
  merchant:            string
  category:            string
  status:              string
  riskScore:           number
  fraudFlag:           boolean
  source:              string
  processingRegion:    string
  processingLatencyMs: number
  eventId:             string
  createdAt:           string
}

const ON_TRANSACTION_ADDED = `
  subscription OnTransactionAdded {
    onTransactionAdded {
      transactionId amount currency merchant category
      status riskScore fraudFlag source processingRegion
      processingLatencyMs eventId createdAt
    }
  }
`

const MAX_FEED_SIZE = 50
const SUB_ID = '1'

export function useTransactions(initialItems: Transaction[] = []) {
  const config       = useRuntimeConfig()
  const transactions = ref<Transaction[]>(initialItems)
  let ws: WebSocket | null = null

  function riskClass(score: number) {
    if (score > 90) return 'risk-high'
    if (score > 70) return 'risk-medium'
    return 'risk-low'
  }

  function riskLabel(score: number) {
    if (score > 90) return 'FLAGGED'
    if (score > 70) return 'HIGH RISK'
    return 'OK'
  }

  async function startSubscription() {
    if (!import.meta.client) return

    // Fetch the ID token from the server — it stays in an httpOnly cookie,
    // this endpoint is the only path from cookie → memory.
    let idToken: string
    try {
      const res = await fetch('/api/command/auth/me')
      if (!res.ok) return
      const data = await res.json()
      idToken = data.idToken
    } catch {
      return
    }

    // Derive the API host from the HTTPS AppSync URL (needed in auth headers)
    const apiHost = new URL(config.public.appsyncUrl).host

    // AppSync WebSocket connection URL:
    // wss://<realtime-endpoint>?header=<b64(auth)>&payload=<b64({})>
    const header  = btoa(JSON.stringify({ Authorization: idToken, host: apiHost }))
    const payload = btoa('{}')
    const wsUrl   = `${config.public.appsyncRealtimeUrl}?header=${header}&payload=${payload}`

    ws = new WebSocket(wsUrl, ['graphql-ws'])

    ws.onopen = () => {
      ws!.send(JSON.stringify({ type: 'connection_init' }))
    }

    ws.onmessage = (event) => {
      let msg: any
      try { msg = JSON.parse(event.data) } catch { return }

      switch (msg.type) {
        case 'connection_ack':
          // Connection established — start the subscription
          ws!.send(JSON.stringify({
            id:      SUB_ID,
            type:    'start',
            payload: {
              data:       JSON.stringify({ query: ON_TRANSACTION_ADDED }),
              extensions: {
                authorization: { Authorization: idToken, host: apiHost }
              },
            },
          }))
          break

        case 'data': {
          const tx: Transaction = msg.payload?.data?.onTransactionAdded
          if (tx) {
            transactions.value = [tx, ...transactions.value].slice(0, MAX_FEED_SIZE)
          }
          break
        }

        case 'ka':
          // Keep-alive — no action needed
          break

        case 'error':
          console.warn('[useTransactions] subscription error:', msg.payload)
          break
      }
    }

    ws.onerror = () => {
      console.warn('[useTransactions] WebSocket error')
    }
  }

  function stopSubscription() {
    if (ws) {
      try {
        ws.send(JSON.stringify({ id: SUB_ID, type: 'stop' }))
        ws.close()
      } catch { /* already closed */ }
      ws = null
    }
  }

  onMounted(() => startSubscription())
  onUnmounted(() => stopSubscription())

  return { transactions, riskClass, riskLabel }
}
