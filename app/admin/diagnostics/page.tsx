import { requireAdmin } from '@/lib/admin-guard'
import { probeStripeAccount } from '@/lib/stripe-products'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Probe = Awaited<ReturnType<typeof probeStripeAccount>> | { error: string }

async function probe(): Promise<Probe> {
  try { return await probeStripeAccount() }
  catch (err) { return { error: err instanceof Error ? err.message : String(err) } }
}

async function listWebhooks() {
  try {
    const r = await stripe.webhookEndpoints.list({ limit: 10 })
    return r.data.map((e) => ({
      id: e.id, url: e.url, status: e.status,
      events: e.enabled_events,
    }))
  } catch (err) {
    return [{ id: 'error', url: err instanceof Error ? err.message : String(err), status: 'error', events: [] }]
  }
}

function StatusPill({ ok }: { ok: boolean }) {
  return <span className={`admin-status admin-status--${ok ? 'active' : 'archived'}`}>{ok ? 'OK' : 'fail'}</span>
}

export default async function DiagnosticsPage() {
  await requireAdmin()
  const [account, webhooks] = await Promise.all([probe(), listWebhooks()])
  const accountOk = !('error' in account)

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Diagnostics</h1>
          <p className="admin-head__sub">Live state of the integrations the backend depends on.</p>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Stripe account</h2>
        {!accountOk ? (
          <div className="admin-banner admin-banner--err">Could not reach Stripe: {(account as { error: string }).error}</div>
        ) : (
          <dl className="admin-kv">
            <dt>Account ID</dt><dd>{account.id}</dd>
            <dt>Country / currency</dt><dd>{account.country} · {account.defaultCurrency}</dd>
            <dt>Charges enabled</dt><dd><StatusPill ok={!!account.chargesEnabled} /></dd>
            <dt>Payouts enabled</dt><dd><StatusPill ok={!!account.payoutsEnabled} /></dd>
            <dt>Details submitted</dt><dd><StatusPill ok={!!account.detailsSubmitted} /></dd>
            <dt>Livemode</dt><dd>{String(account.livemode)}</dd>
            {account.requirements && (
              <>
                <dt>Requirements</dt>
                <dd><pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(account.requirements, null, 2)}</pre></dd>
              </>
            )}
          </dl>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Webhook endpoints</h2>
        {webhooks.length === 0 ? (
          <p>No webhook endpoints configured. Create one pointed at <code>/api/stripe/webhook</code>.</p>
        ) : (
          <table className="admin-table">
            <thead><tr><th>ID</th><th>URL</th><th>Status</th><th>Events</th></tr></thead>
            <tbody>
              {webhooks.map((e) => (
                <tr key={e.id}>
                  <td><code style={{ fontSize: 11 }}>{e.id}</code></td>
                  <td><code style={{ fontSize: 12 }}>{e.url}</code></td>
                  <td><span className={`admin-status admin-status--${e.status === 'enabled' ? 'active' : 'archived'}`}>{e.status}</span></td>
                  <td style={{ fontSize: 12 }}>{e.events.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Environment</h2>
        <dl className="admin-kv">
          <dt>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</dt>
          <dd><StatusPill ok={!!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !/dummy/i.test(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)} /></dd>
          <dt>STRIPE_SECRET_KEY</dt>
          <dd><StatusPill ok={!!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('dummy')} /></dd>
          <dt>STRIPE_WEBHOOK_SECRET</dt>
          <dd><StatusPill ok={!!process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.includes('dummy')} /></dd>
          <dt>SUPABASE_SERVICE_ROLE_KEY</dt>
          <dd><StatusPill ok={!!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'dummy'} /></dd>
          <dt>RESEND_API_KEY</dt>
          <dd><StatusPill ok={!!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_dummy'} /></dd>
          <dt>EMAIL_HASH_PEPPER</dt>
          <dd><StatusPill ok={!!process.env.EMAIL_HASH_PEPPER} /></dd>
          <dt>CRON_SECRET</dt>
          <dd><StatusPill ok={!!process.env.CRON_SECRET && process.env.CRON_SECRET !== 'dummy'} /></dd>
        </dl>
      </div>

      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Operator helpers</h2>
        <p style={{ marginTop: 0, color: 'var(--ad-fg-2)' }}>
          Snippets you may need from time to time — paste them in the Supabase SQL Editor.
        </p>
        <h3 style={{ marginBottom: 4 }}>Promote a user to admin</h3>
        <pre style={{ background: '#1F1F1F', color: '#FAFAF8', padding: 14, fontSize: 12, overflow: 'auto', margin: 0 }}>{`UPDATE public.users SET is_admin = TRUE WHERE email = 'caleb@chariotarchive.com';`}</pre>
        <h3 style={{ marginBottom: 4, marginTop: 18 }}>Recompute a stale credit balance</h3>
        <pre style={{ background: '#1F1F1F', color: '#FAFAF8', padding: 14, fontSize: 12, overflow: 'auto', margin: 0 }}>{`SELECT public.recompute_credit_balance('00000000-0000-0000-0000-000000000000'::uuid);`}</pre>
        <h3 style={{ marginBottom: 4, marginTop: 18 }}>Manually trigger the reconcile cron</h3>
        <pre style={{ background: '#1F1F1F', color: '#FAFAF8', padding: 14, fontSize: 12, overflow: 'auto', margin: 0 }}>{`curl -H "Authorization: Bearer $CRON_SECRET" https://${process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '') ?? 'YOUR_DOMAIN'}/api/cron/reconcile`}</pre>
        <h3 style={{ marginBottom: 4, marginTop: 18 }}>Export a customer's data (GDPR/CCPA)</h3>
        <pre style={{ background: '#1F1F1F', color: '#FAFAF8', padding: 14, fontSize: 12, overflow: 'auto', margin: 0 }}>{`SELECT u.*, o.*, ce.*, r.*
  FROM public.users u
  LEFT JOIN public.orders o          ON o.user_id = u.id
  LEFT JOIN public.credit_events ce  ON ce.user_id = u.id
  LEFT JOIN public.referrals r       ON r.referrer_id = u.id
  WHERE u.email = '<their-email>';`}</pre>
      </div>
    </>
  )
}
