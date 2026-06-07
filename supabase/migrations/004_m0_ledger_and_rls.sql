-- ============================================================
-- M0 — Schema + RLS foundation (keystone)
--
-- Introduces the append-only ledgers the PRD is built around:
--   * orders                    (§3.2 — the order ledger)
--   * credit_events             (§3.3 — the credit ledger; balance = SUM)
--   * processed_webhook_events  (§3.5 — webhook idempotency guard)
--
-- Plus default-deny, owner-only RLS on every user-facing table.
-- No application behavior changes when this lands; it only adds
-- tables, policies, and indexes. Writes to the ledgers happen in M2/M3.
--
-- Apply via Supabase dashboard > SQL Editor, or `supabase db push`.
-- Idempotent: safe to re-run.
-- ============================================================

-- ---- enums --------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'completed', 'failed', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_source AS ENUM ('stripe', 'promo_zarathustra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.credit_reason AS ENUM (
    'founding_member_grant',   -- +3000 once, on first completed purchase
    'referral_grant',          -- +500 per converted referral (max 3)
    'checkout_redemption',     -- negative, credit spent at checkout
    'reconciliation_adjust'    -- manual/automated correction
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- orders  (APPEND-ONLY order ledger) ---------------------
-- One row per purchase attempt that reaches Stripe (or the free
-- promo path). The account "remembers" purchases through this table;
-- balances are reconciled against it. Orders are never deleted.
CREATE TABLE IF NOT EXISTS public.orders (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID          NOT NULL REFERENCES public.users(id),
  status                   public.order_status NOT NULL DEFAULT 'pending',
  amount_charged_cents     INT           NOT NULL,        -- what Stripe actually charged (after credit/promo)
  list_price_cents         INT           NOT NULL,        -- Drop 0 price before discounts (2000)
  credit_applied_cents     INT           NOT NULL DEFAULT 0,
  promo_code               TEXT,                          -- e.g. 'zarathustra' or NULL
  source                   public.order_source NOT NULL DEFAULT 'stripe',
  stripe_payment_intent_id TEXT          UNIQUE,          -- NULL for free (promo) orders
  items                    JSONB         NOT NULL,        -- [{ sku:'founding-member', qty:1 }]
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ,
  CONSTRAINT orders_amounts_nonneg CHECK (
    amount_charged_cents >= 0 AND list_price_cents >= 0 AND credit_applied_cents >= 0
  )
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx  ON public.orders (status);
-- Partial unique already covered by column UNIQUE; index aids reconciliation lookups.
CREATE INDEX IF NOT EXISTS orders_pi_idx      ON public.orders (stripe_payment_intent_id);

-- ---- credit_events  (APPEND-ONLY credit ledger) -------------
-- balance(user) = SUM(amount_cents). Positive = grant, negative = spend.
-- Never mutated; corrections are new 'reconciliation_adjust' rows.
CREATE TABLE IF NOT EXISTS public.credit_events (
  id            UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID                 NOT NULL REFERENCES public.users(id),
  amount_cents  INT                  NOT NULL,
  reason        public.credit_reason NOT NULL,
  order_id      UUID                 REFERENCES public.orders(id),
  created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_events_user_id_idx  ON public.credit_events (user_id);
CREATE INDEX IF NOT EXISTS credit_events_order_id_idx ON public.credit_events (order_id);

-- Idempotency guards for once-only grants (M3 relies on these):
--   * the $30 founding grant fires exactly once per user
CREATE UNIQUE INDEX IF NOT EXISTS credit_events_one_founding_grant_per_user
  ON public.credit_events (user_id)
  WHERE reason = 'founding_member_grant';
--   * one referral grant per originating order
CREATE UNIQUE INDEX IF NOT EXISTS credit_events_one_referral_grant_per_order
  ON public.credit_events (order_id)
  WHERE reason = 'referral_grant';

-- ---- processed_webhook_events  (idempotency ledger) ---------
-- Records every Stripe event.id already handled so retries are no-ops.
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id     TEXT        PRIMARY KEY,   -- Stripe event.id
  type         TEXT        NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security — default-deny, owner-only (§3.8, AC-1)
-- The service-role key (admin client) bypasses RLS for webhook
-- and reconciliation writes; these policies govern the anon/auth
-- (browser) clients only.
-- ============================================================

-- orders: a user may read only their own orders. No client writes.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- credit_events: a user may read only their own events. No client writes.
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credit_events_select_own ON public.credit_events;
CREATE POLICY credit_events_select_own ON public.credit_events
  FOR SELECT USING (auth.uid() = user_id);

-- processed_webhook_events: no user ever touches this. RLS on, no policies
-- => default-deny for anon/auth; service role bypasses.
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- member_sequence holds no user data, but lock it down anyway: RLS on,
-- no policies. Only the SECURITY DEFINER function / service role touch it.
ALTER TABLE public.member_sequence ENABLE ROW LEVEL SECURITY;
