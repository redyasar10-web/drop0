-- ============================================================
-- M2 — fulfill_order integrity test
--
-- Exercises the keystone fulfillment function for: free path,
-- idempotency, webhook dedup, ledger grants, and referral credit.
-- Self-contained and SAFE: runs in a transaction and ROLLs BACK.
-- Run as the postgres/service owner (SECURITY DEFINER + REVOKEs mean
-- anon/authenticated cannot call fulfill_order; the owner can):
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/m2_fulfillment.sql
--
-- Prints "ALL M2 CHECKS PASSED" on success; any divergence raises.
-- ============================================================

BEGIN;
SET LOCAL client_min_messages = WARNING;

-- ---- fixtures ----
-- userA = referrer (already a member), userB = paid buyer referred by A,
-- userC = free (zarathustra) buyer.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'm2-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'm2-b@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'm2-c@example.com');

-- userA is pre-existing with a member number already (so they can earn referral credit).
INSERT INTO public.users (id, email, referral_code, referred_by, member_number, tc_agreed_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'm2-a@example.com', 'REFAAAA1', NULL, 7, NOW());
INSERT INTO public.users (id, email, referral_code, referred_by, tc_agreed_at) VALUES
  ('00000000-0000-0000-0000-0000000000b2', 'm2-b@example.com', 'REFBBBB2', 'REFAAAA1', NOW()),
  ('00000000-0000-0000-0000-0000000000c3', 'm2-c@example.com', 'REFCCCC3', NULL, NOW());

-- ---- (1) FREE PATH: zarathustra fulfillment ----
DO $$
DECLARE r jsonb;
BEGIN
  r := public.fulfill_order(
    p_user_id => '00000000-0000-0000-0000-0000000000c3',
    p_source  => 'promo_zarathustra',
    p_promo_code => 'zarathustra'
  );
  IF (r->>'already_processed')::boolean THEN
    RAISE EXCEPTION 'free path: unexpectedly already_processed';
  END IF;
  IF (r->>'member_number') IS NULL THEN
    RAISE EXCEPTION 'free path: no member number assigned';
  END IF;
  IF (r->>'founder_status')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'free path: founder_status not set';
  END IF;
  IF (r->>'credit_balance')::int <> 3000 THEN
    RAISE EXCEPTION 'free path: balance = % cents (expected 3000)', r->>'credit_balance';
  END IF;
  RAISE NOTICE 'PASS: free path -> member %, founder, $30 (3000c)', r->>'member_number';
END $$;

-- one completed promo order + one founding grant
DO $$
DECLARE o INT; g INT;
BEGIN
  SELECT count(*) INTO o FROM public.orders
    WHERE user_id='00000000-0000-0000-0000-0000000000c3' AND status='completed' AND source='promo_zarathustra';
  SELECT count(*) INTO g FROM public.credit_events
    WHERE user_id='00000000-0000-0000-0000-0000000000c3' AND reason='founding_member_grant';
  IF o <> 1 OR g <> 1 THEN
    RAISE EXCEPTION 'free path ledger wrong: orders=%, grants=% (expected 1,1)', o, g;
  END IF;
  RAISE NOTICE 'PASS: free path wrote 1 order + 1 founding grant';
END $$;

-- ---- (2) IDEMPOTENT re-run of the free path ----
DO $$
DECLARE r jsonb; g INT; o INT;
BEGIN
  r := public.fulfill_order(
    p_user_id => '00000000-0000-0000-0000-0000000000c3',
    p_source  => 'promo_zarathustra',
    p_promo_code => 'zarathustra'
  );
  IF (r->>'already_processed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'idempotency: re-run not flagged already_processed';
  END IF;
  SELECT count(*) INTO g FROM public.credit_events
    WHERE user_id='00000000-0000-0000-0000-0000000000c3' AND reason='founding_member_grant';
  SELECT count(*) INTO o FROM public.orders
    WHERE user_id='00000000-0000-0000-0000-0000000000c3' AND source='promo_zarathustra';
  IF g <> 1 OR o <> 1 THEN
    RAISE EXCEPTION 'idempotency: duplicated rows grants=%, orders=% (expected 1,1)', g, o;
  END IF;
  RAISE NOTICE 'PASS: free path re-run is idempotent (no double grant/order)';
END $$;

-- ---- (3) PAID PATH + webhook dedup + referral credit ----
-- Simulate PI-creation order for userB (referred by A).
INSERT INTO public.orders (
  user_id, status, amount_charged_cents, list_price_cents, credit_applied_cents,
  promo_code, source, stripe_payment_intent_id, items)
VALUES (
  '00000000-0000-0000-0000-0000000000b2', 'pending', 2000, 2000, 0,
  NULL, 'stripe', 'pi_test_b2', '[{"sku":"founding-member","qty":1}]'::jsonb);

DO $$
DECLARE r jsonb;
BEGIN
  r := public.fulfill_order(
    p_user_id => '00000000-0000-0000-0000-0000000000b2',
    p_source  => 'stripe',
    p_stripe_payment_intent_id => 'pi_test_b2',
    p_event_id => 'evt_test_1',
    p_event_type => 'payment_intent.succeeded'
  );
  IF (r->>'already_processed')::boolean THEN
    RAISE EXCEPTION 'paid path: unexpectedly already_processed on first run';
  END IF;
  RAISE NOTICE 'PASS: paid path completed -> member %', r->>'member_number';
END $$;

-- order completed; referrer A got +$5 referral grant + referrals row
DO $$
DECLARE ostatus public.order_status; rg INT; rr INT;
BEGIN
  SELECT status INTO ostatus FROM public.orders WHERE stripe_payment_intent_id='pi_test_b2';
  IF ostatus <> 'completed' THEN
    RAISE EXCEPTION 'paid path: order status = % (expected completed)', ostatus;
  END IF;
  SELECT count(*) INTO rg FROM public.credit_events
    WHERE user_id='00000000-0000-0000-0000-0000000000a1' AND reason='referral_grant';
  SELECT count(*) INTO rr FROM public.referrals
    WHERE referrer_id='00000000-0000-0000-0000-0000000000a1'
      AND referred_id='00000000-0000-0000-0000-0000000000b2' AND credited;
  IF rg <> 1 OR rr <> 1 THEN
    RAISE EXCEPTION 'referral wrong: grants=%, referral_rows=% (expected 1,1)', rg, rr;
  END IF;
  RAISE NOTICE 'PASS: referrer A earned 1 referral grant + 1 referrals row';
END $$;

-- replay SAME event id -> dedup, no double referral grant
DO $$
DECLARE r jsonb; rg INT;
BEGIN
  r := public.fulfill_order(
    p_user_id => '00000000-0000-0000-0000-0000000000b2',
    p_source  => 'stripe',
    p_stripe_payment_intent_id => 'pi_test_b2',
    p_event_id => 'evt_test_1',
    p_event_type => 'payment_intent.succeeded'
  );
  IF (r->>'already_processed')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'dedup: replayed event not flagged already_processed';
  END IF;
  SELECT count(*) INTO rg FROM public.credit_events
    WHERE user_id='00000000-0000-0000-0000-0000000000a1' AND reason='referral_grant';
  IF rg <> 1 THEN
    RAISE EXCEPTION 'dedup: referral grant double-fired (count=%)', rg;
  END IF;
  RAISE NOTICE 'PASS: replayed Stripe event deduped (no double referral credit)';
END $$;

DO $$ BEGIN RAISE NOTICE '=================================='; END $$;
DO $$ BEGIN RAISE NOTICE 'ALL M2 CHECKS PASSED'; END $$;
DO $$ BEGIN RAISE NOTICE '=================================='; END $$;

ROLLBACK;
