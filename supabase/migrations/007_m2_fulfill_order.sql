-- ============================================================
-- M2 — Transactional, idempotent fulfillment (§3.5)
--
-- fulfill_order(...) is the single shared fulfillment path called by
-- BOTH the Stripe webhook (paid) and the zarathustra free path. It runs
-- entirely inside ONE transaction (the function body), so every side
-- effect commits together or rolls back together — fail closed (PAY-4,
-- NF-7). Money/identity writes go to the M0 ledgers; the legacy
-- users.credit_balance column is kept only as a recomputed cache.
--
-- Idempotency (PAY-3, LED-2, BAL-3, REF-7):
--   * processed_webhook_events dedups Stripe event retries
--   * order.status = 'completed' is the second guard
--   * assign_member_number is idempotent per user
--   * partial unique indexes guard the once-only founding & referral grants
--
-- Returns jsonb: { already_processed, member_number, founder_status,
--                  credit_balance (CENTS), email, referral_code }
--
-- NOTE (units): everything is in CENTS. credit_events.amount_cents is the
-- authoritative ledger; users.credit_balance is a recomputed cache equal to
-- SUM(credit_events.amount_cents). Presentation layers divide by 100 for display.
--
-- Idempotent DDL: CREATE OR REPLACE. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fulfill_order(
  p_user_id                  UUID,
  p_source                   public.order_source,
  p_stripe_payment_intent_id TEXT  DEFAULT NULL,
  p_event_id                 TEXT  DEFAULT NULL,
  p_event_type               TEXT  DEFAULT NULL,
  p_promo_code               TEXT  DEFAULT NULL,
  p_items                    JSONB DEFAULT '[{"sku":"founding-member","qty":1}]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user           public.users%ROWTYPE;
  v_order          public.orders%ROWTYPE;
  v_referrer       public.users%ROWTYPE;
  v_member_number  INT;
  v_is_first       BOOLEAN;
  v_promo          TEXT;
  v_applied        INT;
  v_credited_count INT;
  v_balance_cents  INT;
  v_rowcount       INT;
BEGIN
  -- 0. Lock the buyer row (idempotency anchor; serializes retries per user).
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  -- 1. Webhook dedup (PAY-3). If this event was already handled, no-op.
  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.processed_webhook_events (event_id, type)
    VALUES (p_event_id, COALESCE(p_event_type, 'unknown'))
    ON CONFLICT (event_id) DO NOTHING;
    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    IF v_rowcount = 0 THEN
      v_balance_cents := COALESCE(
        (SELECT SUM(amount_cents) FROM public.credit_events WHERE user_id = p_user_id), 0);
      RETURN jsonb_build_object(
        'already_processed', true,
        'member_number',     v_user.member_number,
        'founder_status',    v_user.founder_status,
        'credit_balance',    v_balance_cents,
        'email',             v_user.email,
        'referral_code',     v_user.referral_code
      );
    END IF;
  END IF;

  -- 2. Find the order (paid path: created at PI creation) or create it (free path).
  IF p_source = 'stripe' THEN
    SELECT * INTO v_order FROM public.orders
      WHERE stripe_payment_intent_id = p_stripe_payment_intent_id
      FOR UPDATE;
    IF NOT FOUND THEN
      -- Defensive: PI-creation order missing (e.g. reconciliation). Create minimal.
      INSERT INTO public.orders (
        user_id, status, amount_charged_cents, list_price_cents,
        credit_applied_cents, promo_code, source, stripe_payment_intent_id, items)
      VALUES (
        p_user_id, 'pending', 0, 2000, 0, p_promo_code, 'stripe',
        p_stripe_payment_intent_id, p_items)
      RETURNING * INTO v_order;
    END IF;
  ELSE
    -- Free promo path: at most one promo order per user.
    SELECT * INTO v_order FROM public.orders
      WHERE user_id = p_user_id AND source = 'promo_zarathustra'
      FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.orders (
        user_id, status, amount_charged_cents, list_price_cents,
        credit_applied_cents, promo_code, source, stripe_payment_intent_id, items)
      VALUES (
        p_user_id, 'pending', 0, 2000, 0, COALESCE(p_promo_code, 'zarathustra'),
        'promo_zarathustra', NULL, p_items)
      RETURNING * INTO v_order;
    END IF;
  END IF;

  -- 3. Idempotent: already completed -> return current state, no side effects.
  IF v_order.status = 'completed' THEN
    v_balance_cents := COALESCE(
      (SELECT SUM(amount_cents) FROM public.credit_events WHERE user_id = p_user_id), 0);
    RETURN jsonb_build_object(
      'already_processed', true,
      'member_number',     v_user.member_number,
      'founder_status',    v_user.founder_status,
      'credit_balance',    v_balance_cents / 100,
      'email',             v_user.email,
      'referral_code',     v_user.referral_code
    );
  END IF;

  v_is_first := v_user.member_number IS NULL;
  v_promo    := lower(COALESCE(v_order.promo_code, ''));
  v_applied  := COALESCE(v_order.credit_applied_cents, 0);

  -- 4. Member number — atomic, idempotent, capped at 50 (FM-1..FM-4).
  --    Raises 'sold_out' if exhausted -> whole txn rolls back (fail closed).
  v_member_number := public.assign_member_number(p_user_id);

  -- 5. Founding-member grant (+$30), exactly once per user (BAL-3).
  --    Partial unique index credit_events_one_founding_grant_per_user guards it.
  IF v_is_first THEN
    INSERT INTO public.credit_events (user_id, amount_cents, reason, order_id)
    VALUES (p_user_id, 3000, 'founding_member_grant', v_order.id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 6. Checkout redemption (negative) for any credit applied at this purchase (BAL-4).
  IF v_applied > 0 THEN
    INSERT INTO public.credit_events (user_id, amount_cents, reason, order_id)
    VALUES (p_user_id, -v_applied, 'checkout_redemption', v_order.id);
  END IF;

  -- 7. Promo redemption + founder status (PAY-7, PROMO-4). Transactional: a
  --    failed fulfillment does not consume a redemption.
  IF v_promo = 'zarathustra' THEN
    IF public.redeem_promo_code('zarathustra') THEN
      UPDATE public.users SET founder_status = true WHERE id = p_user_id;
      v_user.founder_status := true;
    ELSE
      RAISE EXCEPTION 'promo_unavailable' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- 8. Referral credit on first purchase (REF-4..REF-7). Basic cap/idempotency
  --    here; M3 hardens the ceiling, atomic cap, and anti-self-referral CHECK.
  IF v_is_first AND v_user.referred_by IS NOT NULL THEN
    -- referred_by is the referrer's user id (uuid), resolved from their public
    -- referral_code at signup (see 010_concession_referred_by_uuid.sql).
    SELECT * INTO v_referrer FROM public.users
      WHERE id = v_user.referred_by
      FOR UPDATE;
    IF FOUND AND v_referrer.id <> p_user_id THEN     -- anti self-referral (basic)
      SELECT count(*) INTO v_credited_count FROM public.referrals
        WHERE referrer_id = v_referrer.id AND credited = true;
      IF v_credited_count < 3 THEN
        INSERT INTO public.referrals (referrer_id, referred_id, credited)
        VALUES (v_referrer.id, p_user_id, true)
        ON CONFLICT (referrer_id, referred_id) DO NOTHING;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount > 0 THEN
          -- One referral grant per originating order (partial unique index guards).
          INSERT INTO public.credit_events (user_id, amount_cents, reason, order_id)
          VALUES (v_referrer.id, 500, 'referral_grant', v_order.id)
          ON CONFLICT DO NOTHING;
          UPDATE public.users SET credit_balance = COALESCE(
            (SELECT SUM(amount_cents) FROM public.credit_events WHERE user_id = v_referrer.id), 0)
          WHERE id = v_referrer.id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 9. Complete the order (LED-2). Only pending -> completed reaches here.
  UPDATE public.orders
    SET status = 'completed', completed_at = NOW(), amount_charged_cents = v_order.amount_charged_cents
    WHERE id = v_order.id;

  -- 10. Recompute the buyer's denormalized balance cache (CENTS, = ledger sum).
  v_balance_cents := COALESCE(
    (SELECT SUM(amount_cents) FROM public.credit_events WHERE user_id = p_user_id), 0);
  UPDATE public.users SET credit_balance = v_balance_cents WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'member_number',     v_member_number,
    'founder_status',    v_user.founder_status,
    'credit_balance',    v_balance_cents / 100,
    'email',             v_user.email,
    'referral_code',     v_user.referral_code
  );
END;
$$;

-- ============================================================
-- Function execution hardening (CRITICAL — A01/A08)
--
-- SECURITY DEFINER functions default to EXECUTE for PUBLIC, and PostgREST
-- exposes public-schema functions over the REST API. Without this, a
-- logged-in (or anon) client could call fulfill_order / assign_member_number
-- / redeem_promo_code directly and mint a free founding spot or burn a promo
-- without paying. Restrict these to the service role only; server code uses
-- the service-role key. (available_balance stays callable: it is SECURITY
-- INVOKER and RLS-scoped to the caller's own rows.)
-- ============================================================
REVOKE ALL ON FUNCTION public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.assign_member_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.assign_member_number(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.redeem_promo_code(text) TO service_role;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;
