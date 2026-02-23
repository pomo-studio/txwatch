export default defineEventHandler((event) => {
  const config = useRuntimeConfig()

  const domain = `${config.cognitoDomainPrefix}.auth.${config.cognitoRegion}.amazoncognito.com`
  const loginUrl = new URL(`https://${domain}/login`)
  loginUrl.searchParams.set('client_id', config.cognitoClientId)
  loginUrl.searchParams.set('response_type', 'code')
  loginUrl.searchParams.set('scope', 'openid email profile')
  loginUrl.searchParams.set('redirect_uri', config.cognitoRedirectUri)

  return sendRedirect(event, loginUrl.toString(), 302)
})
