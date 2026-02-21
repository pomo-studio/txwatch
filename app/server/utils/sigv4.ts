/**
 * AWS SigV4 request signer using node:crypto.
 * No @aws-sdk / @aws-crypto — zero bundling issues in Nitro/Lambda.
 */

import { createHash, createHmac } from 'node:crypto'

function sha256hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate    = hmacSha256(`AWS4${secret}`, dateStamp)
  const kRegion  = hmacSha256(kDate,    region)
  const kService = hmacSha256(kRegion,  service)
  return           hmacSha256(kService, 'aws4_request')
}

/**
 * Sign an AWS API request and return a headers object ready to pass to fetch().
 * Caller provides the fixed service headers (Content-Type, X-Amz-Target, etc.).
 * This function adds X-Amz-Date, (optionally) X-Amz-Security-Token, and Authorization.
 */
export function awsSign(opts: {
  method:  string
  url:     string
  body:    string
  service: string
  region:  string
  headers: Record<string, string>   // caller-supplied headers (Content-Type, X-Amz-Target …)
}): Record<string, string> {
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID!
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!
  const sessionToken    = process.env.AWS_SESSION_TOKEN   // present for all IAM role credentials

  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'  // YYYYMMDDTHHmmssZ
  const dateStamp = amzDate.slice(0, 8)                                          // YYYYMMDD

  const parsed = new URL(opts.url)

  // Build full header map (lowercase names)
  const allHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(opts.headers)) {
    allHeaders[k.toLowerCase()] = v.trim()
  }
  allHeaders['host']       = parsed.host
  allHeaders['x-amz-date'] = amzDate
  if (sessionToken) allHeaders['x-amz-security-token'] = sessionToken

  // Canonical headers: sorted lexicographically
  const sortedNames      = Object.keys(allHeaders).sort()
  const canonicalHeaders = sortedNames.map(k => `${k}:${allHeaders[k]}`).join('\n') + '\n'
  const signedHeaders    = sortedNames.join(';')

  // Canonical query string (empty for EventBridge PutEvents)
  const canonicalQS = parsed.search ? parsed.search.slice(1) : ''

  const payloadHash = sha256hex(opts.body)

  const canonicalRequest = [
    opts.method.toUpperCase(),
    parsed.pathname || '/',
    canonicalQS,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${opts.region}/${opts.service}/aws4_request`
  const stringToSign    = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n')

  const signingKey  = deriveSigningKey(secretAccessKey, dateStamp, opts.region, opts.service)
  const signature   = hmacSha256(signingKey, stringToSign).toString('hex')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    ...allHeaders,
    Authorization: authorization,
  }
}
