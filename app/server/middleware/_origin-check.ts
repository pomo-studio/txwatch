/**
 * CloudFront origin secret guard.
 * CloudFront injects X-Origin-Secret on every request to the Lambda origin.
 * Direct Lambda function URL access lacks this header → 403.
 * Skip if ORIGIN_SECRET is unset (local dev / bootstrap).
 */
export default defineEventHandler((event) => {
  const secret = process.env.ORIGIN_SECRET
  if (!secret) return

  const header = getHeader(event, 'x-origin-secret')
  if (header !== secret) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
})
