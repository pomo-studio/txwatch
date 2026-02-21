import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const config = useRuntimeConfig()
  const cognito = new CognitoIdentityProviderClient({ region: config.cognitoRegion })

  try {
    const result = await cognito.send(new SignUpCommand({
      ClientId: config.cognitoClientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    }))

    return {
      ok: true,
      confirmed: result.UserConfirmed,
      needsConfirmation: !result.UserConfirmed,
    }
  } catch (e: any) {
    const msg: Record<string, string> = {
      UsernameExistsException:    'An account with this email already exists',
      InvalidPasswordException:   'Password must be 8+ characters with uppercase and a number',
      InvalidParameterException:  'Invalid email address',
    }
    throw createError({ statusCode: 400, message: msg[e.name] ?? 'Sign up failed' })
  }
})
