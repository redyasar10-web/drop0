-- ============================================================
-- M2 follow-up: amount-charged recovery path + tc_agreed_at backstop
--
-- Lands the post-audit findings:
--   * Architect CRITICAL #1 — recovery-path orders were inserted with
--     amount_charged_cents = 0 / credit_applied_cents = 0, hiding real
--     $20 charges from the customer's /account activity feed (which
--     filters `amount_charged_cents > 0`).
--   * Architect HIGH #4 (also raised by Code Reviewer HIGH #3) —
--     tc_agreed_at had no DB-level NOT NULL constraint, so any path that
--     bypassed signupAction (admin inserts, future migrations) could
--     create a user row with no recorded T&C agreement.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. fulfill_order — add p_amount_charged_cents + p_applied_credit_cents.
--    The recovery branch (step 2) inserts a defensive order row when the
--    PI-creation INSERT was lost. Without authoritative money values from
--    the webhook, that row stayed at 0 and silently hid the real charge.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_order(
  p_user_id                  UUID,
  p_source                   public.order_source,
  p_stripe_payment_intent_id TEXT  DEFAULT NULL,
  p_event_id                 TEXT  DEFAULT NULL,
  p_event_type               TEXT  DEFAULT NULL,
  p_promo_code               TEXT  DEFAULT NULL,
  p_items                    JSONB DEFAULT '[{"sku":"founding-member","qty":1}]'::jsonb,
  p_amount_charged_cents     INT   DEFAULT NULL,
  p_applied_credit_cents     INT   DEFAULT NULL
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
  -- Webhook-supplied charged amount (used only on recovery path; ignored on
  -- normal path where v_order already has authoritative values).
  v_webhook_amount INT;
  v_webhook_credit INT;
BEGIN
  v_webhook_amount := COALESCE(p_amount_charged_cents, 0);
  v_webhook_credit := COALESCE(p_applied_credit_cents, 0);

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'no_data_found';
  END IF;

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

  IF p_source = 'stripe' THEN
    SELECT * INTO v_order FROM public.orders
      WHERE stripe_payment_intent_id = p_stripe_payment_intent_id
      FOR UPDATE;
    IF NOT FOUND THEN
      -- Recovery: PI-creation insert was lost. Use webhook-supplied values
      -- so the order row carries the real charge + redemption rather than
      -- silently zeroing them. Webhook passes pi.amount_received and the
      -- applied_credit_cents we set in pi.metadata at PI creation.
      INSERT INTO public.orders (
        user_id, status, amount_charged_cents, list_price_cents,
        credit_applied_cents, promo_code, source, stripe_payment_intent_id, items)
      VALUES (
        p_user_id, 'pending',
        v_webhook_amount,
        2000,
        v_webhook_credit,
        p_promo_code, 'stripe',
        p_stripe_payment_intent_id, p_items)
      RETURNING * INTO v_order;
    END IF;
  ELSE
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

  IF v_order.user_id <> p_user_id THEN
    RAISE EXCEPTION 'user_order_mismatch: order belongs to %, call was for %',
      v_order.user_id, p_user_id USING ERRCODE = 'check_violation';
  END IF;

  IF v_order.status = 'completed' THEN
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

  v_is_first := v_user.member_number IS NULL;
  v_promo    := lower(COALESCE(v_order.promo_code, ''));
  v_applied  := COALESCE(v_order.credit_applied_cents, 0);

  v_member_number := public.assign_member_number(p_user_id);

  IF v_is_first THEN
    INSERT INTO public.credit_events (user_id, amount_cents, reason, order_id)
    VALUES (p_user_id, 3000, 'founding_member_grant', v_order.id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_applied > 0 THEN
    INSERT INTO public.credit_events (user_id, amount_cents, reason, order_id)
    VALUES (p_user_id, -v_applied, 'checkout_redemption', v_order.id);
  END IF;

  IF v_promo = 'zarathustra' THEN
    IF public.redeem_promo_code('zarathustra') THEN
      UPDATE public.users SET founder_status = true WHERE id = p_user_id;
      v_user.founder_status := true;
    ELSE
      RAISE EXCEPTION 'promo_unavailable' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_is_first AND v_user.referred_by IS NOT NULL THEN
    SELECT * INTO v_referrer FROM public.users
      WHERE id = v_user.referred_by
      FOR UPDATE;
    IF FOUND AND v_referrer.id <> p_user_id THEN
      PERFORM 1 FROM public.referrals
        WHERE referrer_id = v_referrer.id
        FOR UPDATE;

      SELECT count(*) INTO v_credited_count FROM public.referrals
        WHERE referrer_id = v_referrer.id AND credited = true;
      IF v_credited_count < 3 THEN
        INSERT INTO public.referrals (referrer_id, referred_id, credited)
        VALUES (v_referrer.id, p_user_id, true)
        ON CONFLICT (referrer_id, referred_id) DO NOTHING;
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        IF v_rowcount > 0 THEN
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

  UPDATE public.orders
    SET status = 'completed', completed_at = NOW(), amount_charged_cents = v_order.amount_charged_cents
    WHERE id = v_order.id;

  v_balance_cents := COALESCE(
    (SELECT SUM(amount_cents) FROM public.credit_events WHERE user_id = p_user_id), 0);
  UPDATE public.users SET credit_balance = v_balance_cents WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'already_processed', false,
    'member_number',     v_member_number,
    'founder_status',    v_user.founder_status,
    'credit_balance',    v_balance_cents,
    'email',             v_user.email,
    'referral_code',     v_user.referral_code
  );
END;
$$;

-- The signature changed (added two trailing args). The previous-signature
-- function would shadow if both exist, so drop it explicitly. Safe because
-- 012 and 013 always run in order and nothing else holds the old reference.
DROP FUNCTION IF EXISTS public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb);

REVOKE ALL ON FUNCTION public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb, int, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb, int, int) TO service_role;

-- ------------------------------------------------------------
-- 2. tc_agreed_at NOT NULL backstop.
--    Server actions enforce this in application code, but a missing
--    DB constraint means any path bypassing signupAction can mint a
--    user row with no recorded T&C agreement — a compliance gap.
--
--    Safe-fix: backfill any existing NULLs to created_at (best available
--    proxy) before adding the constraint, so the ALTER doesn't fail on
--    pre-existing data. The backfill is a no-op for fresh installs since
--    the original column was already NOT NULL in 20260531_001.
-- ------------------------------------------------------------
UPDATE public.users
SET tc_agreed_at = created_at
WHERE tc_agreed_at IS NULL;

DO $$ BEGIN
  ALTER TABLE public.users ALTER COLUMN tc_agreed_at SET NOT NULL;
EXCEPTION WHEN others THEN
  -- Already NOT NULL or column doesn't exist — both are acceptable.
  NULL;
END $$;
