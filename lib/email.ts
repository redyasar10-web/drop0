import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Chariot <orders@chariotarchive.com>'

export async function sendOrderConfirmation({
  to,
  memberNumber,
  isFounder,
}: {
  to: string
  memberNumber: number
  isFounder: boolean
}) {
  const formatted = `#${String(memberNumber).padStart(3, '0')}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're in — Founding Member ${formatted}`,
    html: buildConfirmationHtml({ formatted, isFounder }),
  })
}

function buildConfirmationHtml({
  formatted,
  isFounder,
}: {
  formatted: string
  isFounder: boolean
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Chariot — Order Confirmed</title>
<style>
  body { margin:0; padding:0; background:#111111; color:#F2EBE0;
         font-family:"Inter",ui-sans-serif,system-ui,sans-serif;
         font-size:16px; line-height:1.55; -webkit-font-smoothing:antialiased; }
  a { color:#C9921E; text-decoration:none; }
  .wrap { max-width:520px; margin:0 auto; padding:48px 32px; }
  .wordmark { font-size:13px; font-weight:600; letter-spacing:0.18em;
              text-transform:uppercase; color:#F2EBE0; margin:0 0 48px; }
  .number { font-size:40px; font-weight:500; letter-spacing:-0.02em;
            color:#C9921E; margin:0 0 8px; line-height:1; }
  .label { font-size:11px; font-weight:500; letter-spacing:0.14em;
           text-transform:uppercase; color:rgba(242,235,224,0.5); margin:0 0 40px; }
  .body-text { font-size:16px; line-height:1.6; color:rgba(242,235,224,0.8);
               margin:0 0 24px; }
  .divider { border:none; border-top:1px solid rgba(242,235,224,0.12);
             margin:40px 0; }
  .footer { font-size:12px; color:rgba(242,235,224,0.35); }
</style>
</head>
<body>
<div class="wrap">
  <p class="wordmark">Chariot</p>

  <p class="number">${formatted}</p>
  <p class="label">${isFounder ? 'Founding Member' : 'Member'} — Drop 0 confirmed</p>

  <p class="body-text">Your order is confirmed. This is your permanent member number — it travels with you across every drop.</p>

  <p class="body-text">$30 in store credit has been applied to your account and will be available at checkout.</p>

  ${isFounder ? `<p class="body-text">Your account has been marked as a Founding Member. This distinction is permanent.</p>` : ''}

  <p class="body-text">Shipping details and tracking will follow once your order ships. Questions: <a href="mailto:hello@chariotarchive.com">hello@chariotarchive.com</a></p>

  <hr class="divider" />
  <p class="footer">Chariot Archive &mdash; chariotarchive.com</p>
</div>
</body>
</html>`
}
