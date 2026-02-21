import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const config = useRuntimeConfig()

  // AdminInitiateAuth requires IAM signing. The Lambda execution role has
  // cognito-idp:AdminInitiateAuth permission. Credentials are read explicitly
  // from Lambda environment variables to avoid credential provider chain issues
  // when bundled by Nitro.
  const cognito = new CognitoIdentityProviderClient({
    region: config.cognitoRegion,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken:    process.env.AWS_SESSION_TOKEN,
    },
  })

  try {
    const result = await cognito.send(new AdminInitiateAuthCommand({
      UserPoolId: config.cognitoUserPoolId,
      ClientId:   config.cognitoClientId,
      AuthFlow:   'USER_PASSWORD_AUTH',
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
      PasswordResetRequiredException: 'Password reset required',
    }
    throw createError({ statusCode: 401, message: msg[e.name] ?? 'Sign in failed' })
  }
})
