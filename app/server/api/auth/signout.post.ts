export default defineEventHandler((event) => {
  const cookieBase = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 0 }
  setCookie(event, 'txwatch_token',   '', cookieBase)
  setCookie(event, 'txwatch_refresh', '', cookieBase)
  return { ok: true }
})
