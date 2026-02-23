import crypto from 'node:crypto'
import { putEvents } from './eventbridge'

const VALID_CATEGORIES = ['grocery', 'restaurant', 'gas', 'travel', 'atm', 'online'] as const

const AMOUNT_RANGES: Record<string, [number, number]> = {
  grocery:    [10, 250],
  restaurant: [8, 200],
  gas:        [20, 120],
  travel:     [100, 3000],
  atm:        [100, 1000],
  online:     [10, 600]
}

const SUSPICIOUS_AMOUNTS = [5000, 7500, 9999, 12000]

function isValidCategory(value: unknown): value is (typeof VALID_CATEGORIES)[number] {
  return typeof value === 'string' && VALID_CATEGORIES.some((entry) => entry === value)
}

export function requireSession(event: unknown): void {
  const token = parseCookies(event)['txwatch_token']
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

export function normalizeTxInput(input: { category?: unknown; flagIt?: unknown }): {
  category: string
  flagIt: boolean
} {
  const category = isValidCategory(input.category)
    ? input.category
    : VALID_CATEGORIES[Math.floor(Math.random() * VALID_CATEGORIES.length)]

  const flagIt = input.flagIt === true || input.flagIt === 'true'
  return { category, flagIt }
}

export async function publishManualTx(eventBusName: string, category: string, flagIt: boolean): Promise<{
  success: boolean
  transactionId: string
  category: string
  amount: number
}> {
  const amount = flagIt
    ? SUSPICIOUS_AMOUNTS[Math.floor(Math.random() * SUSPICIOUS_AMOUNTS.length)]
    : (() => {
      const [min, max] = AMOUNT_RANGES[category]
      return parseFloat((Math.random() * (max - min) + min).toFixed(2))
    })()

  const detail = {
    transactionId: crypto.randomUUID(),
    amount,
    currency: 'USD',
    category,
    source: 'manual',
    publishedAt: Date.now()
  }

  await putEvents([{
    EventBusName: eventBusName,
    Source:       'txwatch.transactions',
    DetailType:   'Transaction Created',
    Detail:       JSON.stringify(detail)
  }])

  return {
    success: true,
    transactionId: detail.transactionId,
    category,
    amount
  }
}
