import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

export default defineEventHandler(async (event) => {
  const { email, password, code } = await readBody(event)

  if (!email || !code) {
    throw createError({ statusCode: 400, message: 'Email and confirmation code required' })
  }

  const config = useRuntimeConfig()
  const cognito = new CognitoIdentityProviderClient({ region: config.cognitoRegion })

  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: config.cognitoClientId,
      Username: email,
      ConfirmationCode: code,
    }))
  } catch (e: any) {
    const msg: Record<string, string> = {
      CodeMismatchException:  'Invalid confirmation code',
      ExpiredCodeException:   'Confirmation code has expired — request a new one',
      NotAuthorizedException: 'Account already confirmed',
    }
    throw createError({ statusCode: 400, message: msg[e.name] ?? 'Confirmation failed' })
  }

  // Auto sign-in after confirmation if password was provided
  if (!password) {
    return { ok: true, signedIn: false }
  }

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

    return { ok: true, signedIn: true }
  } catch {
    // Confirmation succeeded but auto-login failed — send to login page
    return { ok: true, signedIn: false }
  }
})
