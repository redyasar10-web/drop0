import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkAuthRateLimit, getClientIp } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

// Support contact form endpoint. The /support page renders a form that was
// previously a dead no-op (no JS handler, no action attribute). Until this
// route shipped, "Send message" silently did a GET to /support and the user
// got no feedback either way.
//
// Rate-limited by IP + by submitter email. Body validated and length-clamped
// before any Resend call so a malicious caller can't burn the Resend quota
// or send 1MB messages to caleb@.

const resend = new Resend(process.env.RESEND_API_KEY)

const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_ORDER = 64
const MAX_ISSUE = 64
const MAX_MESSAGE = 4000

const VALID_ISSUES = new Set([
  'Order status',
  'Shipping',
  'Returns & exchanges',
  'Sizing',
  'Payment',
  'Other',
])

const TO_EMAIL = process.env.SUPPORT_TO_EMAIL ?? 'caleb@chariotarchive.com'
// Separate from RESEND_FROM_EMAIL (used by order confirmations) so the
// transactional and support reputations don't pollute each other in Resend.
const FROM_EMAIL =
  process.env.RESEND_SUPPORT_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL ??
  'Chariot Support <support@chariotarchive.com>'

// Maximum body bytes accepted before we parse JSON — defends Resend quota
// against a malicious caller posting a 900 KB JSON blob that we'd still have
// to parse and validate. Holds even before the per-field length clamps.
const MAX_BODY_BYTES = 16 * 1024

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: Request) {
  // Reject obviously-oversized bodies before parsing JSON.
  const cl = parseInt(request.headers.get('content-length') ?? '0', 10) || 0
  if (cl > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'Message too large.' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      // null / number / array are all valid JSON but not what we expect.
      return NextResponse.json({ ok: false, error: 'Body must be a JSON object.' }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim().slice(0, MAX_NAME)
  const email = String(body.email ?? '').trim().slice(0, MAX_EMAIL)
  const order = String(body.order ?? '').trim().slice(0, MAX_ORDER)
  const issue = String(body.issue ?? '').trim().slice(0, MAX_ISSUE)
  const message = String(body.message ?? '').trim().slice(0, MAX_MESSAGE)

  if (!name || !email || !issue || !message) {
    return NextResponse.json(
      { ok: false, error: 'Name, email, issue type, and message are required.' },
      { status: 400 }
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (!VALID_ISSUES.has(issue)) {
    return NextResponse.json({ ok: false, error: 'Pick an issue type from the list.' }, { status: 400 })
  }

  // Rate limit by IP and by sender email so a stray script can't pummel the
  // inbox or burn the Resend quota. Auth limiter is reused (same buckets, same
  // 60s window) so contact spam shares a budget with other anonymous-ish
  // flows.
  if (!(await checkAuthRateLimit('contact', email))) {
    return NextResponse.json(
      { ok: false, error: 'Too many messages. Please wait a minute and try again.' },
      { status: 429 }
    )
  }

  const ip = getClientIp()

  const html = `<p><b>From:</b> ${escape(name)} &lt;${escape(email)}&gt;</p>
<p><b>Issue:</b> ${escape(issue)}</p>
${order ? `<p><b>Order:</b> ${escape(order)}</p>` : ''}
<hr/>
<pre style="font-family:inherit;white-space:pre-wrap;">${escape(message)}</pre>
<hr/>
<p style="color:#888;font-size:12px;">IP: ${escape(ip)}</p>`

  const text = `From: ${name} <${email}>
Issue: ${issue}
${order ? `Order: ${order}\n` : ''}
${message}

---
IP: ${ip}`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: `[Chariot Support] ${issue} — ${name}`,
      html,
      text,
    })
  } catch (err) {
    console.error('[contact] resend send failed:', err)
    await logAudit({
      event: 'contact.send_failed',
      level: 'alert',
      detail: { email, issue, message: String(err) },
    })
    return NextResponse.json(
      { ok: false, error: 'Could not send your message right now. Please email caleb@chariotarchive.com directly.' },
      { status: 502 }
    )
  }

  await logAudit({ event: 'contact.sent', level: 'info', detail: { email, issue } })
  return NextResponse.json({ ok: true })
}
