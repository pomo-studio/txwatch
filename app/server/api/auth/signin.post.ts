import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const config = useRuntimeConfig()
  const cognito = new CognitoIdentityProviderClient({ region: config.cognitoRegion })

  try {
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.cognitoClientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))

    const { IdToken, RefreshToken } = result.AuthenticationResult!
    const cookieBase = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }

    setCookie(event, 'txwatch_token',   IdToken!,      { ...cookieBase, maxAge: 3600 })
    setCookie(event, 'txwatch_refresh', RefreshToken!, { ...cookieBase, maxAge: 30 * 24 * 3600 })

    return { ok: true }
  } catch (e: any) {
    const msg: Record<string, string> = {
      NotAuthorizedException:    'Incorrect email or password',
      UserNotConfirmedException: 'Please verify your email before signing in',
      UserNotFoundException:     'Incorrect email or password',
    }
    throw createError({ statusCode: 401, message: msg[e.name] ?? 'Sign in failed' })
  }
})
