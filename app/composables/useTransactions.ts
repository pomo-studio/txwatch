/**
 * useTransactions composable
 * Manages the real-time transaction feed via AppSync WebSocket subscription.
 * Prepends new transactions from the subscription to the SSR-hydrated initial list.
 * Bounds the feed to 50 items max.
 */

import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'

export interface Transaction {
  transactionId: string
  amount: number
  currency: string
  merchant: string
  category: string
  status: string
  riskScore: number
  fraudFlag: boolean
  source: string
  processingRegion: string
  processingLatencyMs: number
  eventId: string
  createdAt: string
}

const ON_TRANSACTION_ADDED = /* GraphQL */ `
  subscription OnTransactionAdded {
    onTransactionAdded {
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
  }
`

const MAX_FEED_SIZE = 50

export function useTransactions(initialItems: Transaction[] = []) {
  const config = useRuntimeConfig()
  const transactions = ref<Transaction[]>(initialItems)
  let subscription: ReturnType<typeof generateClient>['graphql'] | null = null
  let client: ReturnType<typeof generateClient> | null = null

  function riskClass(score: number): string {
    if (score > 90) return 'risk-high'
    if (score > 70) return 'risk-medium'
    return 'risk-low'
  }

  function riskLabel(score: number): string {
    if (score > 90) return 'FLAGGED'
    if (score > 70) return 'HIGH RISK'
    return 'OK'
  }

  async function startSubscription() {
    if (!import.meta.client) return

    try {
      Amplify.configure({
        API: {
          GraphQL: {
            endpoint: config.public.appsyncUrl,
            region:   config.public.cognitoRegion,
            defaultAuthMode: 'userPool'
          }
        },
        Auth: {
          Cognito: {
            userPoolId:       config.public.cognitoRegion + '_' + config.public.cognitoClientId.split('_')[0],
            userPoolClientId: config.public.cognitoClientId
          }
        }
      })

      client = generateClient()

      // Verify user is authenticated before subscribing
      await getCurrentUser()

      const sub = (client.graphql({
        query: ON_TRANSACTION_ADDED,
        authMode: 'userPool'
      }) as any)

      if (typeof sub.subscribe === 'function') {
        sub.subscribe({
          next: ({ data }: any) => {
            const tx: Transaction = data?.onTransactionAdded
            if (!tx) return

            transactions.value = [tx, ...transactions.value].slice(0, MAX_FEED_SIZE)
          },
          error: (err: Error) => {
            console.warn('[useTransactions] subscription error:', err.message)
          }
        })
      }
    } catch (err) {
      console.warn('[useTransactions] failed to start subscription:', err)
    }
  }

  function stopSubscription() {
    if (subscription && typeof (subscription as any)?.unsubscribe === 'function') {
      (subscription as any).unsubscribe()
    }
  }

  onMounted(() => startSubscription())
  onUnmounted(() => stopSubscription())

  return {
    transactions,
    riskClass,
    riskLabel
  }
}
