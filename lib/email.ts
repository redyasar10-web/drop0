import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Chariot <orders@chariotarchive.com>'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://chariotarchive.com'

export async function sendOrderConfirmation({
  to,
  memberNumber,
  isFounder,
  referralCode,
  creditBalance,
}: {
  to: string
  memberNumber: number
  isFounder: boolean
  referralCode: string
  creditBalance: number
}) {
  const formatted = `#${String(memberNumber).padStart(3, '0')}`
  const referralUrl = `${SITE_URL}/ref/${referralCode}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You are Chariot Member ${formatted}`,
    html: buildHtml({ formatted, isFounder, referralUrl, creditBalance }),
    text: buildText({ formatted, isFounder, referralUrl, creditBalance }),
  })
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function buildHtml({
  formatted,
  isFounder,
  referralUrl,
  creditBalance,
}: {
  formatted: string
  isFounder: boolean
  referralUrl: string
  creditBalance: number
}) {
  const memberLabel = isFounder ? 'Founding Member' : 'Member'
  const founderLine = isFounder
    ? `<tr><td><p class="body">Your account carries Founding Member status. This designation is permanent.</p></td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; }
body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0; mso-table-rspace: 0; border-collapse: collapse; }
body { margin: 0; padding: 0; width: 100%; background-color: #111111; }

/* ── Shell ── */
.shell { background-color: #111111; width: 100%; }

/* ── Container ── */
.wrap { max-width: 560px; margin: 0 auto; padding: 56px 40px 48px; }

/* ── Wordmark ── */
.wordmark {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #F2EBE0;
  text-decoration: none;
  display: block;
  margin: 0 0 56px;
}

/* ── Member number ── */
.member-number {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 52px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: #C9921E;
  line-height: 1;
  margin: 0 0 10px;
}

.member-label {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(242,235,224,0.4);
  margin: 0 0 48px;
}

/* ── Divider ── */
.rule {
  border: none;
  border-top: 1px solid rgba(242,235,224,0.1);
  margin: 40px 0;
}

/* ── Body text ── */
.body {
  font-family: 'Spectral', Georgia, 'Times New Roman', serif;
  font-size: 16px;
  line-height: 1.65;
  color: rgba(242,235,224,0.78);
  margin: 0 0 20px;
}
.body:last-child { margin-bottom: 0; }

/* ── Referral section ── */
.ref-label {
  font-family: 'Courier New', Courier, 'DM Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(242,235,224,0.38);
  margin: 0 0 10px;
  display: block;
}

.ref-link {
  font-family: 'Courier New', Courier, 'DM Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.03em;
  color: #C9921E;
  text-decoration: underline;
  text-underline-offset: 3px;
  word-break: break-all;
  display: block;
  margin: 0 0 12px;
}

.ref-note {
  font-family: 'Spectral', Georgia, 'Times New Roman', serif;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(242,235,224,0.38);
  margin: 0;
}

/* ── Footer ── */
.footer {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(242,235,224,0.25);
}
.footer a { color: rgba(242,235,224,0.38); text-decoration: none; }

/* ── Responsive ── */
@media only screen and (max-width: 600px) {
  .wrap { padding: 40px 24px 36px; }
  .member-number { font-size: 40px; }
}
</style>
</head>
<body>
<table class="shell" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td>

  <div class="wrap">

    <!-- Wordmark -->
    <a href="${SITE_URL}" class="wordmark">Chariot</a>

    <!-- Member number hero -->
    <p class="member-number">${formatted}</p>
    <p class="member-label">${memberLabel} &mdash; Drop 0</p>

    <!-- Rule -->
    <hr class="rule">

    <!-- Purchase confirmation -->
    <p class="body">
      Your purchase is confirmed. ${formatted} is your permanent member number &mdash;
      it does not change, it does not expire, and it is not reassigned.
    </p>

    <p class="body">
      $${creditBalance} in store credit has been added to your account.
      It applies automatically at checkout on any future order.
    </p>

    ${founderLine}

    <!-- Rule -->
    <hr class="rule">

    <!-- Referral -->
    <span class="ref-label">Your referral link</span>
    <a href="${referralUrl}" class="ref-link">${referralUrl}</a>
    <p class="ref-note">
      Share this link. You earn $5 in store credit for each friend who completes
      a purchase, up to three referrals ($15 total).
    </p>

    <!-- Rule -->
    <hr class="rule">

    <!-- Footer -->
    <p class="footer">
      Shipping details and tracking will follow when your order ships.<br>
      Questions: <a href="mailto:hello@chariotarchive.com">hello@chariotarchive.com</a>
    </p>
    <p class="footer" style="margin-top:14px;">
      Chariot Archive &mdash;
      <a href="${SITE_URL}">chariotarchive.com</a>
    </p>

  </div>

</td></tr>
</table>
</body>
</html>`
}

// ─── Plain text ───────────────────────────────────────────────────────────────

function buildText({
  formatted,
  isFounder,
  referralUrl,
  creditBalance,
}: {
  formatted: string
  isFounder: boolean
  referralUrl: string
  creditBalance: number
}) {
  const memberLabel = isFounder ? 'Founding Member' : 'Member'
  const founderLine = isFounder
    ? `\nYour account carries Founding Member status. This designation is permanent.\n`
    : ''

  return `CHARIOT
${SITE_URL}

${formatted}
${memberLabel} — Drop 0

────────────────────────────────────────

Your purchase is confirmed. ${formatted} is your permanent member number — it does not change, it does not expire, and it is not reassigned.

$${creditBalance} in store credit has been added to your account. It applies automatically at checkout on any future order.
${founderLine}
────────────────────────────────────────

YOUR REFERRAL LINK

${referralUrl}

Share this link. You earn $5 in store credit for each friend who completes a purchase, up to three referrals ($15 total).

────────────────────────────────────────

Shipping details and tracking will follow when your order ships.
Questions: hello@chariotarchive.com

Chariot Archive — chariotarchive.com`
}
