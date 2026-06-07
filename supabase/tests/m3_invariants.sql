-- ============================================================
-- M3 — balance & referral invariants test
--
-- Verifies the DB-layer guarantees: $45 ceiling (BAL-6), no-negative
-- balance (BAL-4), anti self-referral (REF-6), reconciliation bypass,
-- and recompute_credit_balance. Transactional; ROLLs BACK.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/m3_invariants.sql
-- ============================================================

BEGIN;
SET LOCAL client_min_messages = WARNING;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'm3-d1@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'm3-d2@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'm3-d3@example.com');
INSERT INTO public.users (id, email, referral_code, member_number, tc_agreed_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'm3-d1@example.com', 'M3DDDD11', 11, NOW()),
  ('00000000-0000-0000-0000-0000000000d2', 'm3-d2@example.com', 'M3DDDD22', 12, NOW()),
  ('00000000-0000-0000-0000-0000000000d3', 'm3-d3@example.com', 'M3DDDD33', 13, NOW());

-- ---- (1) $45 ceiling (BAL-6) ----
-- $30 founding + 3x $5 referral = $45 OK; the 4th $5 grant must be rejected.
INSERT INTO public.credit_events (user_id, amount_cents, reason)
VALUES ('00000000-0000-0000-0000-0000000000d1', 3000, 'founding_member_grant');
INSERT INTO public.credit_events (user_id, amount_cents, reason) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 500, 'referral_grant'),
  ('00000000-0000-0000-0000-0000000000d1', 500, 'referral_grant'),
  ('00000000-0000-0000-0000-0000000000d1', 500, 'referral_grant');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.credit_events (user_id, amount_cents, reason)
    VALUES ('00000000-0000-0000-0000-0000000000d1', 500, 'referral_grant');
    RAISE EXCEPTION 'TEST FAILED: 4th referral grant exceeded $45 ceiling but was allowed';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: $45 ceiling rejects credit beyond cap';
  END;
END $$;

-- ---- (2) no negative balance (BAL-4) ----
INSERT INTO public.credit_events (user_id, amount_cents, reason)
VALUES ('00000000-0000-0000-0000-0000000000d2', 3000, 'founding_member_grant');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.credit_events (user_id, amount_cents, reason)
    VALUES ('00000000-0000-0000-0000-0000000000d2', -3500, 'checkout_redemption');
    RAISE EXCEPTION 'TEST FAILED: spend below zero balance was allowed';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: balance cannot go below zero';
  END;
END $$;
-- a spend exactly to zero is allowed
INSERT INTO public.credit_events (user_id, amount_cents, reason)
VALUES ('00000000-0000-0000-0000-0000000000d2', -3000, 'checkout_redemption');
DO $$
DECLARE v INT;
BEGIN
  SELECT COALESCE(SUM(amount_cents),0) INTO v FROM public.credit_events
    WHERE user_id='00000000-0000-0000-0000-0000000000d2';
  IF v <> 0 THEN RAISE EXCEPTION 'TEST FAILED: balance = % (expected 0)', v; END IF;
  RAISE NOTICE 'PASS: spend down to exactly zero is allowed';
END $$;

-- ---- (3) anti self-referral CHECK (REF-6) ----
DO $$
BEGIN
  BEGIN
    INSERT INTO public.referrals (referrer_id, referred_id, credited)
    VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', true);
    RAISE EXCEPTION 'TEST FAILED: self-referral was allowed';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: self-referral rejected at the DB layer';
  END;
END $$;

-- ---- (4) reconciliation_adjust bypasses invariants ----
INSERT INTO public.credit_events (user_id, amount_cents, reason)
VALUES ('00000000-0000-0000-0000-0000000000d3', 3000, 'founding_member_grant');
-- This would exceed the ceiling for a normal grant, but the correction reason is exempt.
INSERT INTO public.credit_events (user_id, amount_cents, reason)
VALUES ('00000000-0000-0000-0000-0000000000d3', 5000, 'reconciliation_adjust');
DO $$ BEGIN RAISE NOTICE 'PASS: reconciliation_adjust bypasses ceiling/floor (correction escape hatch)'; END $$;

-- ---- (5) recompute_credit_balance writes the cache (cents) ----
DO $$
DECLARE v_cents INT; v_cache INT;
BEGIN
  v_cents := public.recompute_credit_balance('00000000-0000-0000-0000-0000000000d3');
  SELECT credit_balance INTO v_cache FROM public.users WHERE id='00000000-0000-0000-0000-0000000000d3';
  IF v_cents <> 8000 THEN RAISE EXCEPTION 'TEST FAILED: recompute returned % cents (expected 8000)', v_cents; END IF;
  IF v_cache <> 8000 THEN RAISE EXCEPTION 'TEST FAILED: cache = % cents (expected 8000)', v_cache; END IF;
  RAISE NOTICE 'PASS: recompute_credit_balance -> 8000 cents cache';
END $$;

DO $$ BEGIN RAISE NOTICE '=================================='; END $$;
DO $$ BEGIN RAISE NOTICE 'ALL M3 CHECKS PASSED'; END $$;
DO $$ BEGIN RAISE NOTICE '=================================='; END $$;

ROLLBACK;
