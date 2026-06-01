import { NextResponse, type NextRequest } from 'next/server'

// Handles GET /ref/[code]
// Redirects to the signup page with the referral code pre-filled.
// The signup page reads ?ref= and stores it as referred_by on account creation.
export function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params

  // Reject anything that doesn't look like one of our codes (uppercase alphanumeric, 6-12 chars)
  if (!/^[A-Z0-9]{4,16}$/i.test(code)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const dest = new URL('/signup', request.url)
  dest.searchParams.set('ref', code.toUpperCase())
  return NextResponse.redirect(dest)
}
