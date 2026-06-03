-- ============================================================
-- Fulfillment idempotency
-- Ensures fulfillOrder() runs exactly once per payment, even when
-- Stripe re-delivers payment_intent.succeeded (at-least-once delivery
-- with retries). Without this, incremental credit math is re-applied
-- on every retry and corrupts customer balances.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fulfilled_orders (
  idempotency_key TEXT PRIMARY KEY,           -- PaymentIntent id, or 'zara:<user_id>'
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fulfilled_orders_user_idx
  ON public.fulfilled_orders (user_id);

-- Service-role only (written exclusively by the webhook / payment-intent route
-- via the admin client). RLS on with no policies = no anon/auth access.
ALTER TABLE public.fulfilled_orders ENABLE ROW LEVEL SECURITY;
