-- ============================================================
-- M3.1 — Hot-path indexes + ledger retention hygiene
--
-- Lands the post-audit DB-performance findings:
--   * Composite (user_id, created_at DESC) indexes for credit_events
--     and orders so the /account page's ordered reads are index-only.
--   * Partial index on (referrer_id) WHERE credited = true so
--     fulfill_order's cap-of-3 count doesn't scan all referrals.
--   * Partial index on users(member_number) WHERE NOT NULL so the
--     landing page's getClaimedCount is an index-only count of the
--     0-50 qualifying rows.
--   * Sweep functions + scheduled-job hooks for auth_rate_limits and
--     processed_webhook_events so they don't grow unboundedly.
--
-- Idempotent. CONCURRENT not used because Supabase migrations run in
-- a transaction; these tables are small at launch and the lock is
-- inconsequential.
-- ============================================================

-- ---------- hot-path indexes ----------

-- Account page: SELECT amount_cents, reason, created_at WHERE user_id=? ORDER BY created_at DESC
-- Also serves the available_balance SUM and the enforce_credit_invariants trigger's SUM.
-- INCLUDE columns lift the query into index-only territory (no heap fetch).
CREATE INDEX IF NOT EXISTS credit_events_user_created_idx
  ON public.credit_events (user_id, created_at DESC)
  INCLUDE (amount_cents, reason);

-- Account page: SELECT amount_charged_cents, status, created_at WHERE user_id=? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS orders_user_created_idx
  ON public.orders (user_id, created_at DESC)
  INCLUDE (amount_charged_cents, status);

-- fulfill_order referral cap-of-3 check + account page credited count:
--   SELECT count(*) FROM referrals WHERE referrer_id=? AND credited=true
-- Partial index keeps it tiny (at most 3 rows per referrer).
CREATE INDEX IF NOT EXISTS referrals_referrer_credited_idx
  ON public.referrals (referrer_id)
  WHERE credited = true;

-- Landing getClaimedCount:
--   SELECT count(*) FROM users WHERE member_number IS NOT NULL
-- Partial index turns this into an index-only count of 0-50 rows.
CREATE INDEX IF NOT EXISTS users_member_number_nn_idx
  ON public.users (member_number)
  WHERE member_number IS NOT NULL;

-- referred_by FK index: the original migration 010 conditional may not
-- have run on fresh installs. Add an unconditional create so the FK is
-- always backed by an index — silent slow cascades otherwise.
CREATE INDEX IF NOT EXISTS users_referred_by_fk_idx
  ON public.users (referred_by);

-- ---------- retention sweepers ----------

-- auth_rate_limits accumulates one row per (action, ip|email) bucket.
-- Each row is only meaningful inside its sliding window (60s for auth
-- buckets, currently). Anything older is dead weight that fattens the
-- (key) btree and slows check_rate_limit. Hourly sweep is generous.
CREATE OR REPLACE FUNCTION public.sweep_expired_rate_limits()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  DELETE FROM public.auth_rate_limits
   WHERE window_start < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.sweep_expired_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sweep_expired_rate_limits() TO service_role;

-- processed_webhook_events accumulates one row per Stripe event id forever.
-- At Drop-0 volume (≤ ~200 events) this is trivial, but document and bound
-- it now so it doesn't bite at Drop-1+ scale. Stripe retries for 3 days, so
-- 30d is comfortably safe.
CREATE OR REPLACE FUNCTION public.sweep_old_webhook_events(p_age_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  DELETE FROM public.processed_webhook_events
   WHERE received_at < NOW() - (p_age_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
REVOKE ALL ON FUNCTION public.sweep_old_webhook_events(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sweep_old_webhook_events(INT) TO service_role;

-- ============================================================
-- NOTE on detect_balance_drift (009): the function scans every user and
-- joins against credit_events. Acceptable at ≤ 50 founding members; if
-- public.users ever exceeds ~10k rows, rewrite to paginate.
-- ============================================================
