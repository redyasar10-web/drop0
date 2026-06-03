import { NextResponse, type NextRequest } from 'next/server'

// Handles GET /ref/[code]
// Sets a durable referral cookie AND redirects to signup with ?ref= prefilled.
// signupAction reads the form field first, then falls back to this cookie, so
// the referral survives navigation/refresh — not just the immediate click.
export function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params

  // Reject anything that doesn't look like one of our codes.
  if (!/^[A-Z0-9]{4,16}$/i.test(code)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const normalized = code.toUpperCase()
  const dest = new URL('/signup', request.url)
  dest.searchParams.set('ref', normalized)

  const response = NextResponse.redirect(dest)
  response.cookies.set('chariot_ref', normalized, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return response
}
