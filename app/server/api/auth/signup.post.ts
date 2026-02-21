import { cognitoCall } from '~/server/utils/cognito'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
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
})
