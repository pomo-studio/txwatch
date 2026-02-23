export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const cookieBase = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 }
  setCookie(event, 'txwatch_token', '', cookieBase)
  setCookie(event, 'txwatch_refresh', '', cookieBase)

  const domain = `${config.cognitoDomainPrefix}.auth.${config.cognitoRegion}.amazoncognito.com`
  const logoutUrl = new URL(`https://${domain}/logout`)
  logoutUrl.searchParams.set('client_id', config.cognitoClientId)
  logoutUrl.searchParams.set('logout_uri', config.cognitoLogoutUri)

  return sendRedirect(event, logoutUrl.toString(), 302)
})
