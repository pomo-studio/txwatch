export default defineEventHandler(async () => {
  const region = process.env.AWS_REGION || 'unknown'

  return {
    status: 'healthy',
    region,
    service: 'txwatch',
    timestamp: new Date().toISOString()
  }
})
