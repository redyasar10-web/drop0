-- ============================================================
-- M5 — Observability + reconciliation support
--
--   * audit_log           — structured, queryable audit trail (NF-6/A09)
--   * detect_balance_drift — finds cache≠ledger drift for REC-2
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ---- audit_log ----------------------------------------------
-- Auditable events with NO sensitive data (no passwords, no card data,
-- no session tokens). level: 'info' | 'warn' | 'alert'. Service-role only.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event      TEXT        NOT NULL,
  level      TEXT        NOT NULL DEFAULT 'info',
  user_id    UUID        REFERENCES public.users(id),
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_event_idx   ON public.audit_log (event);
CREATE INDEX IF NOT EXISTS audit_log_level_idx   ON public.audit_log (level);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at);

-- Service-role only (RLS on, no policies for anon/auth).
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ---- detect_balance_drift -----------------------------------
-- Returns one row per user whose denormalized cache (credit_balance, CENTS)
-- disagrees with the ledger (SUM(credit_events.amount_cents), CENTS). The
-- reconciliation job corrects each via recompute_credit_balance and logs it.
CREATE OR REPLACE FUNCTION public.detect_balance_drift()
RETURNS TABLE (user_id UUID, cache_cents INT, ledger_cents INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
         u.credit_balance  AS cache_cents,
         COALESCE(ce.s, 0)  AS ledger_cents
  FROM public.users u
  LEFT JOIN (
    SELECT user_id, SUM(amount_cents)::INT AS s
    FROM public.credit_events GROUP BY user_id
  ) ce ON ce.user_id = u.id
  WHERE u.credit_balance <> COALESCE(ce.s, 0);
$$;

-- Execution hardening (service role only).
REVOKE ALL ON FUNCTION public.detect_balance_drift() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_balance_drift() TO service_role;
