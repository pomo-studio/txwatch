export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing authorization code' })
  }

  const domain = `${config.cognitoDomainPrefix}.auth.${config.cognitoRegion}.amazoncognito.com`
  const tokenUrl = `https://${domain}/oauth2/token`

  const payload = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.cognitoClientId,
    code,
    redirect_uri: config.cognitoRedirectUri
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  })

  const data = await res.json() as {
    id_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.id_token) {
    const message = data.error_description || data.error || 'Token exchange failed'
    throw createError({ statusCode: 401, message })
  }

  const cookieBase = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' }
  setCookie(event, 'txwatch_token', data.id_token, { ...cookieBase, maxAge: 3600 })
  if (data.refresh_token) {
    setCookie(event, 'txwatch_refresh', data.refresh_token, { ...cookieBase, maxAge: 30 * 24 * 3600 })
  }

  return sendRedirect(event, '/', 302)
})
