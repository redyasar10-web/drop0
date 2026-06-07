import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================
// Structured audit logging (NF-6 / OWASP A09 / ASVS 7.1).
//
// Writes a queryable row to audit_log AND emits a structured console line
// (captured by Vercel log drains for alerting). NEVER pass sensitive data
// (passwords, card data, tokens) in `detail`. Audit failures are swallowed —
// logging must never break the operation it observes.
// ============================================================

export type AuditLevel = 'info' | 'warn' | 'alert'

export async function logAudit(params: {
  event: string
  level?: AuditLevel
  userId?: string | null
  detail?: Record<string, unknown>
}): Promise<void> {
  const { event, level = 'info', userId = null, detail = {} } = params

  // Structured console line (alerting can key off level=alert).
  const line = JSON.stringify({ audit: true, event, level, userId, detail, ts: new Date().toISOString() })
  if (level === 'alert' || level === 'warn') console.warn(line)
  else console.log(line)

  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({ event, level, user_id: userId, detail })
  } catch (err) {
    console.error('[audit] failed to persist audit_log row:', err)
  }
}
