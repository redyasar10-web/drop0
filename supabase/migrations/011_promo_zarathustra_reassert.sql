-- ============================================================
-- Re-assert ZARATHUSTRA promo row.
--
-- Some prod databases were observed missing the seed row (earlier migration
-- ran before the table existed in that env, or was skipped manually). The
-- checkout validate route returns "invalid or expired" when the row is
-- missing, blocking a key payment path. This migration is idempotent — it
-- only inserts when the row is absent, and never overwrites use_count if
-- redemptions have already happened.
-- ============================================================

INSERT INTO public.promo_codes (code, max_uses, active)
VALUES ('zarathustra', 10, true)
ON CONFLICT (code) DO NOTHING;

-- Intentionally NO update to `active` on existing rows: if an operator
-- manually disabled the code, they almost certainly meant it. Re-enabling
-- it is a runbook action, not a migration step.
