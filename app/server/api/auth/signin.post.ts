import { cognitoCall } from '~/server/utils/cognito'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const config = useRuntimeConfig()

  const data = await cognitoCall(config.cognitoRegion, 'InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.cognitoClientId,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  })

  const { IdToken, RefreshToken } = data.AuthenticationResult
  const cookieBase = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }

  setCookie(event, 'txwatch_token',   IdToken,      { ...cookieBase, maxAge: 3600 })
  setCookie(event, 'txwatch_refresh', RefreshToken, { ...cookieBase, maxAge: 30 * 24 * 3600 })

  return { ok: true }
})
