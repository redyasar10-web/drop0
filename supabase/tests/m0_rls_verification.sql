-- ============================================================
-- AC-7 — RLS verification test
--
-- Proves default-deny, owner-only RLS on users, orders, and
-- credit_events: an anonymous client and a *different* logged-in
-- user both receive ZERO rows when querying another user's data.
--
-- Self-contained and SAFE: runs entirely inside a transaction and
-- ROLLs BACK at the end, leaving no test data behind. Run as the
-- postgres/service owner:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/m0_rls_verification.sql
--
-- or paste into the Supabase SQL Editor. On success it prints
-- "ALL RLS CHECKS PASSED" via a deliberate ROLLBACK-as-failure-free.
-- Any policy hole raises an exception and aborts.
-- ============================================================

BEGIN;

-- Quiet the expected FK/role noise; we want only our NOTICEs.
SET LOCAL client_min_messages = WARNING;

-- ---- fixtures: two users, each with an order + a credit event ----
-- Fixed UUIDs so we can reference them across role switches.
\set userA '00000000-0000-0000-0000-0000000000aa'
\set userB '00000000-0000-0000-0000-0000000000bb'

-- auth.users rows (FK target). Minimal insert; other columns default/nullable.
INSERT INTO auth.users (id, email)
VALUES (:'userA', 'rls-test-a@example.com'),
       (:'userB', 'rls-test-b@example.com');

INSERT INTO public.users (id, email, referral_code, tc_agreed_at)
VALUES (:'userA', 'rls-test-a@example.com', 'RLSAAAA1', NOW()),
       (:'userB', 'rls-test-b@example.com', 'RLSBBBB2', NOW());

INSERT INTO public.orders (user_id, status, amount_charged_cents, list_price_cents, items)
VALUES (:'userA', 'completed', 2000, 2000, '[{"sku":"founding-member","qty":1}]'::jsonb),
       (:'userB', 'completed', 2000, 2000, '[{"sku":"founding-member","qty":1}]'::jsonb);

INSERT INTO public.credit_events (user_id, amount_cents, reason)
VALUES (:'userA', 3000, 'founding_member_grant'),
       (:'userB', 3000, 'founding_member_grant');

-- ---- helper assertions via DO blocks ----------------------------
-- Each switches identity, counts what is visible, and raises on leak.

-- (1) ANONYMOUS client sees nothing in any user table.
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', NULL, true);
DO $$
DECLARE u INT; o INT; c INT;
BEGIN
  SELECT count(*) INTO u FROM public.users;
  SELECT count(*) INTO o FROM public.orders;
  SELECT count(*) INTO c FROM public.credit_events;
  IF u <> 0 OR o <> 0 OR c <> 0 THEN
    RAISE EXCEPTION 'ANON LEAK: users=%, orders=%, credit_events=% (expected 0,0,0)', u, o, c;
  END IF;
  RAISE NOTICE 'PASS: anonymous sees 0 users / 0 orders / 0 credit_events';
END $$;

-- (2) USER A, authenticated, sees ONLY their own rows — never user B's.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000aa', 'role', 'authenticated')::text,
  true
);
DO $$
DECLARE own_orders INT; other_orders INT; own_credit INT; other_credit INT; other_users INT;
BEGIN
  SELECT count(*) INTO own_orders   FROM public.orders        WHERE user_id = '00000000-0000-0000-0000-0000000000aa';
  SELECT count(*) INTO other_orders FROM public.orders        WHERE user_id = '00000000-0000-0000-0000-0000000000bb';
  SELECT count(*) INTO own_credit   FROM public.credit_events WHERE user_id = '00000000-0000-0000-0000-0000000000aa';
  SELECT count(*) INTO other_credit FROM public.credit_events WHERE user_id = '00000000-0000-0000-0000-0000000000bb';
  SELECT count(*) INTO other_users  FROM public.users         WHERE id      = '00000000-0000-0000-0000-0000000000bb';

  IF own_orders <> 1 OR own_credit <> 1 THEN
    RAISE EXCEPTION 'OWNER DENIED OWN ROWS: orders=%, credit=% (expected 1,1)', own_orders, own_credit;
  END IF;
  IF other_orders <> 0 OR other_credit <> 0 OR other_users <> 0 THEN
    RAISE EXCEPTION 'CROSS-USER LEAK to A: B.orders=%, B.credit=%, B.users=% (expected 0,0,0)',
      other_orders, other_credit, other_users;
  END IF;
  RAISE NOTICE 'PASS: user A sees own rows (1 order, 1 credit) and 0 of user B''s';
END $$;

-- (3) USER B symmetric check.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000bb', 'role', 'authenticated')::text,
  true
);
DO $$
DECLARE other_orders INT; other_credit INT; other_users INT;
BEGIN
  SELECT count(*) INTO other_orders FROM public.orders        WHERE user_id = '00000000-0000-0000-0000-0000000000aa';
  SELECT count(*) INTO other_credit FROM public.credit_events WHERE user_id = '00000000-0000-0000-0000-0000000000aa';
  SELECT count(*) INTO other_users  FROM public.users         WHERE id      = '00000000-0000-0000-0000-0000000000aa';
  IF other_orders <> 0 OR other_credit <> 0 OR other_users <> 0 THEN
    RAISE EXCEPTION 'CROSS-USER LEAK to B: A.orders=%, A.credit=%, A.users=% (expected 0,0,0)',
      other_orders, other_credit, other_users;
  END IF;
  RAISE NOTICE 'PASS: user B sees 0 of user A''s rows';
END $$;

-- (4) available_balance() honors RLS: user A cannot read user B's balance.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000aa', 'role', 'authenticated')::text,
  true
);
DO $$
DECLARE own_bal INT; other_bal INT;
BEGIN
  own_bal   := public.available_balance('00000000-0000-0000-0000-0000000000aa');
  other_bal := public.available_balance('00000000-0000-0000-0000-0000000000bb');
  IF own_bal <> 3000 THEN
    RAISE EXCEPTION 'OWN BALANCE WRONG: % (expected 3000)', own_bal;
  END IF;
  IF other_bal <> 0 THEN
    RAISE EXCEPTION 'BALANCE LEAK: user A read user B balance = % (expected 0)', other_bal;
  END IF;
  RAISE NOTICE 'PASS: available_balance is RLS-scoped (own=3000, other=0)';
END $$;

RESET ROLE;
DO $$ BEGIN RAISE NOTICE '=========================================='; END $$;
DO $$ BEGIN RAISE NOTICE 'ALL RLS CHECKS PASSED'; END $$;
DO $$ BEGIN RAISE NOTICE '=========================================='; END $$;

-- Leave no trace.
ROLLBACK;
