/**
 * Lightweight Cognito HTTP client.
 * Cognito public app client operations (no secret) don't require SigV4 signing.
 * This matches exactly how browser SDK clients (like Amplify) call Cognito.
 */

const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorizedException:    'Incorrect email or password',
  UserNotConfirmedException: 'Please verify your email before signing in',
  UserNotFoundException:     'Incorrect email or password',
  UsernameExistsException:   'An account with this email already exists',
  InvalidPasswordException:  'Password must be 8+ characters with uppercase and a number',
  InvalidParameterException: 'Invalid email address',
  CodeMismatchException:     'Invalid confirmation code',
  ExpiredCodeException:      'Confirmation code has expired — request a new one',
  LimitExceededException:    'Too many attempts — please wait before trying again',
}

export async function cognitoCall(
  region:    string,
  operation: string,
  payload:   Record<string, unknown>
): Promise<any> {
  const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json() as any

  if (!res.ok) {
    const code = data.__type?.split('#').pop() ?? ''
    const msg  = ERROR_MESSAGES[code] ?? data.message ?? 'Request failed'
    throw createError({ statusCode: res.status === 400 ? 400 : 401, message: msg })
  }

  return data
}
