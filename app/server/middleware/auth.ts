// Server-side auth guard.
// Reads the ID token from an httpOnly cookie and checks expiry.
// Redirects unauthenticated / expired sessions to /login.

const PUBLIC_PATHS = ['/login', '/about', '/api/health', '/api/auth/']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) return

  const cookies = parseCookies(event)
  const token = cookies['txwatch_token']

  if (!token) {
    return sendRedirect(event, '/login', 302)
  }

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return sendRedirect(event, '/login', 302)
    }
  } catch {
    return sendRedirect(event, '/login', 302)
  }
})
