// Returns the current user's ID token (for AppSync WebSocket auth) and decoded claims.
// Token stays in an httpOnly cookie; this endpoint is the only way the client
// can retrieve it — keeps the JWT out of localStorage and non-httpOnly cookies.

export default defineEventHandler((event) => {
  const cookies = parseCookies(event)
  const token = cookies['txwatch_token']

  if (!token) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  // Decode JWT payload (no signature verification needed — cookie is httpOnly,
  // only our server sets it, and AppSync will verify the signature on its end)
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw createError({ statusCode: 401, message: 'Session expired' })
  }

  return {
    idToken: token,
    email:   payload.email   ?? '',
    sub:     payload.sub     ?? '',
    exp:     payload.exp     ?? 0,
  }
})
