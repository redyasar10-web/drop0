import { requireAdmin } from '@/lib/admin-guard'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ============================================================
// /admin/setup — live deployment checklist.
//
// Each row is a single thing that must be true for the backend to work
// end-to-end. Pass = green, fail = red with the exact remediation.
// ============================================================

type Check = { name: string; ok: boolean; detail?: string; how?: string }

async function checkStripeKey(): Promise<Check> {
  if (!process.env.STRIPE_SECRET_KEY) return { name: 'STRIPE_SECRET_KEY set', ok: false, how: 'Set in Vercel env vars.' }
  if (process.env.STRIPE_SECRET_KEY.includes('dummy'))
    return { name: 'STRIPE_SECRET_KEY set', ok: false, how: 'Replace the placeholder with the real sk_live_… or sk_test_… key.' }
  try {
    const accountsApi = stripe.accounts as unknown as { retrieve: () => Promise<{ id: string; charges_enabled: boolean }> }
    const acct = await accountsApi.retrieve()
    return { name: 'Stripe key works', ok: !!acct.charges_enabled, detail: acct.id, how: acct.charges_enabled ? undefined : 'Account is not yet activated for charges. Finish onboarding in dashboard.stripe.com.' }
  } catch (err) {
    return { name: 'Stripe key works', ok: false, detail: err instanceof Error ? err.message : String(err), how: 'Check the key is current and not revoked.' }
  }
}

async function checkPublishableKey(): Promise<Check> {
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
  if (!pk) return { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set', ok: false, how: 'Set in Vercel env vars (matching the secret key\'s account).' }
  if (/dummy/i.test(pk)) return { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set', ok: false, how: 'Replace placeholder with the real pk_live_… or pk_test_… key.' }
  return { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY set', ok: true, detail: pk.slice(0, 14) + '…' }
}

async function checkWebhook(): Promise<Check> {
  if (!process.env.STRIPE_WEBHOOK_SECRET || /dummy/i.test(process.env.STRIPE_WEBHOOK_SECRET)) {
    return { name: 'Webhook signing secret', ok: false, how: 'Set STRIPE_WEBHOOK_SECRET in Vercel (Stripe Dashboard → Webhooks → [endpoint] → Signing secret).' }
  }
  try {
    const list = await stripe.webhookEndpoints.list({ limit: 10 })
    const expected = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/stripe/webhook`
    const ours = list.data.find((e) => e.url === expected)
    if (!ours) return { name: 'Webhook endpoint registered', ok: false, how: `No webhook endpoint matches ${expected}. Create one in Stripe Dashboard pointing at that path.` }
    const needs = ['payment_intent.succeeded', 'payment_intent.payment_failed']
    const missing = needs.filter((e) => !ours.enabled_events.includes(e))
    if (missing.length) return { name: 'Webhook endpoint registered', ok: false, detail: ours.id, how: `Endpoint is missing required events: ${missing.join(', ')}` }
    return { name: 'Webhook endpoint registered', ok: ours.status === 'enabled', detail: ours.id }
  } catch (err) {
    return { name: 'Webhook endpoint registered', ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function checkSupabase(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || url.includes('127.0.0.1')) return { name: 'Supabase URL set', ok: false, how: 'Set NEXT_PUBLIC_SUPABASE_URL in Vercel.' }
  if (!key || key === 'dummy') return { name: 'Supabase service role key', ok: false, how: 'Set SUPABASE_SERVICE_ROLE_KEY in Vercel.' }
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('users').select('id', { count: 'exact', head: true })
    if (error) return { name: 'Supabase reachable', ok: false, detail: error.message }
    return { name: 'Supabase reachable', ok: true, detail: url.replace(/^https?:\/\//, '') }
  } catch (err) {
    return { name: 'Supabase reachable', ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function checkMigrations(): Promise<Check> {
  try {
    const admin = createAdminClient()
    // Probe the products table — only exists after migration 015.
    const { error } = await admin.from('products').select('id', { count: 'exact', head: true })
    if (error) {
      return { name: 'Migrations 011–016 applied', ok: false, how: 'Run all SQL files under supabase/migrations/ in order via the Supabase SQL editor or supabase db push.' }
    }
    return { name: 'Migrations 011–016 applied', ok: true }
  } catch (err) {
    return { name: 'Migrations 011–016 applied', ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function checkResend(): Promise<Check> {
  const key = process.env.RESEND_API_KEY ?? ''
  if (!key || key === 're_dummy') return { name: 'Resend API key set', ok: false, how: 'Set RESEND_API_KEY in Vercel. Verify the chariotarchive.com domain in Resend before launch.' }
  return { name: 'Resend API key set', ok: true }
}

async function checkCronSecret(): Promise<Check> {
  const cs = process.env.CRON_SECRET ?? ''
  if (!cs || cs === 'dummy') return { name: 'CRON_SECRET set', ok: false, how: 'Generate with `openssl rand -hex 32` and set in Vercel. Without it, the reconcile cron returns 401 and never runs.' }
  return { name: 'CRON_SECRET set', ok: true }
}

async function checkHashPepper(): Promise<Check> {
  return { name: 'EMAIL_HASH_PEPPER set', ok: !!process.env.EMAIL_HASH_PEPPER, how: process.env.EMAIL_HASH_PEPPER ? undefined : 'Generate with `openssl rand -hex 32` and set in Vercel so audit-log hashes are stable across deploys.' }
}

function StatusRow({ check }: { check: Check }) {
  return (
    <tr>
      <td><span className={`admin-status admin-status--${check.ok ? 'active' : 'archived'}`}>{check.ok ? 'OK' : 'FAIL'}</span></td>
      <td style={{ fontWeight: 500 }}>{check.name}</td>
      <td style={{ fontSize: 13, color: 'var(--ad-fg-2)' }}>
        {check.detail && <div style={{ fontFamily: 'Menlo, monospace', fontSize: 12 }}>{check.detail}</div>}
        {check.how && <div style={{ marginTop: 4 }}>{check.how}</div>}
      </td>
    </tr>
  )
}

export default async function SetupPage() {
  await requireAdmin()
  const checks = await Promise.all([
    checkStripeKey(),
    checkPublishableKey(),
    checkWebhook(),
    checkSupabase(),
    checkMigrations(),
    checkResend(),
    checkCronSecret(),
    checkHashPepper(),
  ])
  const allGreen = checks.every((c) => c.ok)

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Setup checklist</h1>
          <p className="admin-head__sub">Every row must be green before customers can complete a purchase.</p>
        </div>
        <div className={`admin-status admin-status--${allGreen ? 'active' : 'archived'}`} style={{ fontSize: 14, padding: '8px 14px' }}>
          {allGreen ? 'All systems go' : 'Action required'}
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <tbody>
            {checks.map((c) => <StatusRow key={c.name} check={c} />)}
          </tbody>
        </table>
      </div>

      <div className="admin-card" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Quick links</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li><a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">Stripe API keys</a> — copy the publishable + secret keys</li>
          <li><a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer">Stripe webhooks</a> — copy the signing secret for your endpoint</li>
          <li><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase dashboard</a> — Settings → API for the project URL + service_role key, SQL Editor to run migrations</li>
          <li><a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel</a> — Project Settings → Environment Variables</li>
          <li><a href="https://resend.com/api-keys" target="_blank" rel="noreferrer">Resend</a> — API key + verify the chariotarchive.com domain</li>
        </ul>
      </div>
    </>
  )
}
