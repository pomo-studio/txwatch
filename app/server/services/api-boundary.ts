import crypto from 'node:crypto'
import { cognitoCall } from '~/server/utils/cognito'
import { putEvents } from '~/server/utils/eventbridge'

const VALID_CATEGORIES = ['grocery', 'restaurant', 'gas', 'travel', 'atm', 'online'] as const

const AMOUNT_RANGES: Record<string, [number, number]> = {
  grocery: [10, 250],
  restaurant: [8, 200],
  gas: [20, 120],
  travel: [100, 3000],
  atm: [100, 1000],
  online: [10, 600],
}

const SUSPICIOUS_AMOUNTS = [5000, 7500, 9999, 12000]

function authCookieBase() {
  return { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }
}

export async function signInCommand(
  event: any,
  input: { email?: string; password?: string }
): Promise<{ ok: true }> {
  const email = input.email?.trim()
  const password = input.password

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required', data: { code: 'INVALID_INPUT' } })
  }

  const config = useRuntimeConfig()
  const result = await cognitoCall(config.cognitoRegion, 'InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.cognitoClientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  })

  const { IdToken, RefreshToken } = result.AuthenticationResult
  const cookieBase = authCookieBase()

  setCookie(event, 'txwatch_token', IdToken, { ...cookieBase, maxAge: 3600 })
  setCookie(event, 'txwatch_refresh', RefreshToken, { ...cookieBase, maxAge: 30 * 24 * 3600 })

  return { ok: true }
}

export async function signUpCommand(
  input: { email?: string; password?: string }
): Promise<{ ok: true; confirmed: boolean; needsConfirmation: boolean }> {
  const email = input.email?.trim()
  const password = input.password

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required', data: { code: 'INVALID_INPUT' } })
  }

  const config = useRuntimeConfig()
  const data = await cognitoCall(config.cognitoRegion, 'SignUp', {
    ClientId: config.cognitoClientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  })

  return {
    ok: true,
    confirmed: data.UserConfirmed,
    needsConfirmation: !data.UserConfirmed,
  }
}

export async function confirmCommand(
  event: any,
  input: { email?: string; password?: string; code?: string }
): Promise<{ ok: true; signedIn: boolean }> {
  const email = input.email?.trim()
  const code = input.code?.trim()
  const password = input.password

  if (!email || !code) {
    throw createError({ statusCode: 400, message: 'Email and confirmation code required', data: { code: 'INVALID_INPUT' } })
  }

  const config = useRuntimeConfig()
  await cognitoCall(config.cognitoRegion, 'ConfirmSignUp', {
    ClientId: config.cognitoClientId,
    Username: email,
    ConfirmationCode: code,
  })

  if (!password) {
    return { ok: true, signedIn: false }
  }

  try {
    const result = await cognitoCall(config.cognitoRegion, 'InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.cognitoClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })

    const { IdToken, RefreshToken } = result.AuthenticationResult
    const cookieBase = authCookieBase()

    setCookie(event, 'txwatch_token', IdToken, { ...cookieBase, maxAge: 3600 })
    setCookie(event, 'txwatch_refresh', RefreshToken, { ...cookieBase, maxAge: 30 * 24 * 3600 })

    return { ok: true, signedIn: true }
  } catch {
    return { ok: true, signedIn: false }
  }
}

export function signOutCommand(event: any): { ok: true } {
  const cookieBase = { ...authCookieBase(), maxAge: 0 }
  setCookie(event, 'txwatch_token', '', cookieBase)
  setCookie(event, 'txwatch_refresh', '', cookieBase)
  return { ok: true }
}

export async function createTransactionCommand(
  input: { category?: string; flagIt?: boolean }
): Promise<{ success: true; transactionId: string; category: string; amount: number }> {
  const config = useRuntimeConfig()

  const category = VALID_CATEGORIES.includes(input?.category as any)
    ? (input.category as (typeof VALID_CATEGORIES)[number])
    : VALID_CATEGORIES[Math.floor(Math.random() * VALID_CATEGORIES.length)]

  const flagIt = input?.flagIt === true

  let amount: number
  if (flagIt) {
    amount = SUSPICIOUS_AMOUNTS[Math.floor(Math.random() * SUSPICIOUS_AMOUNTS.length)]
  } else {
    const [min, max] = AMOUNT_RANGES[category]
    amount = parseFloat((Math.random() * (max - min) + min).toFixed(2))
  }

  const detail = {
    transactionId: crypto.randomUUID(),
    amount,
    currency: 'USD',
    category,
    source: 'manual',
    publishedAt: Date.now(),
  }

  await putEvents([{
    EventBusName: config.eventBusName || process.env.EVENT_BUS_NAME || '',
    Source: 'txwatch.transactions',
    DetailType: 'Transaction Created',
    Detail: JSON.stringify(detail),
  }])

  return {
    success: true,
    transactionId: detail.transactionId,
    category,
    amount,
  }
}
