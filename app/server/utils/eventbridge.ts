/**
 * Lightweight EventBridge PutEvents client.
 * Uses plain fetch + node:crypto SigV4 — no @aws-sdk bundling.
 */

import { awsSign } from './sigv4'

export interface EventEntry {
  EventBusName: string
  Source:       string
  DetailType:   string
  Detail:       string
}

export async function putEvents(entries: EventEntry[]): Promise<void> {
  const region = process.env.AWS_REGION || 'us-east-1'
  const url    = `https://events.${region}.amazonaws.com/`
  const body   = JSON.stringify({ Entries: entries })

  const headers = awsSign({
    method:  'POST',
    url,
    body,
    service: 'events',
    region,
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'AWSEvents.PutEvents',
    },
  })

  const res = await fetch(url, { method: 'POST', headers, body })

  if (!res.ok) {
    const text = await res.text()
    throw createError({ statusCode: 502, message: `EventBridge error ${res.status}: ${text}` })
  }

  const result = await res.json() as {
    FailedEntryCount: number
    Entries: Array<{ ErrorCode?: string; ErrorMessage?: string }>
  }

  if (result.FailedEntryCount > 0) {
    const failed = result.Entries.filter(e => e.ErrorCode)
    throw createError({ statusCode: 502, message: `EventBridge rejected entries: ${JSON.stringify(failed)}` })
  }
}
