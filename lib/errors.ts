import { NextResponse } from 'next/server'

// ============================================================
// Generic error responses (NF-7 / ASVS 7.4).
//
// Never leak stack traces, internal messages, or DB details to the client.
// Log the real error server-side; return a generic message + status.
// ============================================================

const GENERIC_MESSAGES: Record<number, string> = {
  400: 'The request could not be processed.',
  401: 'Authentication required.',
  403: 'You do not have access to this resource.',
  404: 'Not found.',
  409: 'This request conflicts with the current state.',
  429: 'Too many requests. Please try again shortly.',
  500: 'Something went wrong. Please try again.',
}

/** Log the real error context server-side and return a generic JSON response. */
export function errorResponse(status: number, logContext?: unknown): NextResponse {
  if (logContext !== undefined) {
    console.error(`[error ${status}]`, logContext)
  }
  return NextResponse.json(
    { error: GENERIC_MESSAGES[status] ?? GENERIC_MESSAGES[500] },
    { status }
  )
}
