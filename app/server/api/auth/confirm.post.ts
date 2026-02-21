import { cognitoCall } from '~/server/utils/cognito'

export default defineEventHandler(async (event) => {
  const { email, password, code } = await readBody(event)

  if (!email || !code) {
    throw createError({ statusCode: 400, message: 'Email and confirmation code required' })
  }

  const config = useRuntimeConfig()

  // Confirm the account
  await cognitoCall(config.cognitoRegion, 'ConfirmSignUp', {
    ClientId: config.cognitoClientId,
    Username: email,
    ConfirmationCode: code,
  })

  // Auto sign-in after confirmation if password provided
  if (!password) {
    return { ok: true, signedIn: false }
  }

  try {
    const data = await cognitoCall(config.cognitoRegion, 'InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.cognitoClientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    })

    const { IdToken, RefreshToken } = data.AuthenticationResult
    const cookieBase = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }

    setCookie(event, 'txwatch_token',   IdToken,      { ...cookieBase, maxAge: 3600 })
    setCookie(event, 'txwatch_refresh', RefreshToken, { ...cookieBase, maxAge: 30 * 24 * 3600 })

    return { ok: true, signedIn: true }
  } catch {
    // Confirmation succeeded but auto-login failed — let user sign in manually
    return { ok: true, signedIn: false }
  }
})
