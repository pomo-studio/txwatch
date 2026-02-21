// Server-side auth guard.
// Reads the access token from an httpOnly cookie.
// Redirects unauthenticated requests to /login.
// Public routes (login, about, health) bypass the guard.

const PUBLIC_PATHS = ['/login', '/about', '/api/health']

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Allow public paths
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return

  // Check for auth cookie
  const cookies = parseCookies(event)
  const accessToken = cookies['txwatch_access_token']

  if (!accessToken) {
    return sendRedirect(event, '/login', 302)
  }

  // Token present — Cognito JWT validation happens client-side via Amplify.
  // The server trusts the token for SSR rendering; AppSync enforces auth at query time.
})
