-- ============================================================
-- M2/M3 security & correctness hardening
--
-- Lands the findings from the post-launch debug pass. Idempotent —
-- safe to re-run. Reviewed against:
--   * Security audit (CRITICAL #1, #2; HIGH #3, #5)
--   * DB / RLS audit (CRITICAL #1 promo race, #2 referral TOCTOU,
--                     #3 trigger search_path; HIGH #4 unit bug)
--
-- Touched objects:
--   * redeem_promo_code              — collapse two-step UPDATE into one
--   * fulfill_order                  — fix unit bug, lock referrals before
--                                      count, assert userId == order.user_id
--   * enforce_credit_invariants      — pin search_path + SECURITY DEFINER
--   * users_update_own RLS           — block client-side writes to sensitive
--                                      columns (tc_agreed_at, founder_status,
--                                      credit_balance, member_number,
--                                      referral_code, referred_by, email)
--   * orders                         — UNIQUE constraint guarding the
--                                      promo_zarathustra free path
-- ============================================================

-- ------------------------------------------------------------
-- 1. redeem_promo_code — single-statement atomic redemption.
--    Previous version split increment and expiry across two UPDATEs,
--    leaving a window where a third concurrent call could see
--    `use_count = max_uses` with `active = true` and slip through.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.promo_codes
  SET use_count = use_count + 1,
      active    = CASE WHEN use_count + 1 >= max_uses THEN FALSE ELSE active END
  WHERE code      = p_code
    AND active    = TRUE
    AND use_count < max_uses;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.redeem_promo_code(text) TO service_role;

-- ------------------------------------------------------------
-- 2. enforce_credit_invariants — pin search_path and run with
--    elevated rights so a malicious authenticated role can't shadow
--    public.credit_events with a local table to bypass BAL-4/BAL-6.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_credit_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INT;
  v_granted INT;
  v_ceiling INT := 4500;  -- $45.00 (CONFIG.CREDIT_CEILING_CENTS)
BEGIN
  IF NEW.reason = 'reconciliation_adjust' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_cents < 0 THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance
      FROM public.credit_events WHERE user_id = NEW.user_id;
    IF v_balance + NEW.amount_cents < 0 THEN
      RAISE EXCEPTION 'insufficient_credit: balance % + % < 0', v_balance, NEW.amount_cents
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.amount_cents > 0 AND NEW.reason IN ('founding_member_grant', 'referral_grant') THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_granted
      FROM public.credit_events
      WHERE user_id = NEW.user_id
        AND reason IN ('founding_member_grant', 'referral_grant');
    IF v_granted + NEW.amount_cents > v_ceiling THEN
      RAISE EXCEPTION 'credit_ceiling_exceeded: granted % + % > %', v_granted, NEW.amount_cents, v_ceiling
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3. orders — prevent two `promo_zarathustra` rows for the same user.
--    Closes the concurrent free-path window where two parallel POSTs
--    each find no existing order and INSERT their own.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_promo_per_user
  ON public.orders (user_id)
  WHERE source = 'promo_zarathustra';

-- ------------------------------------------------------------
-- 4. fulfill_order — three corrections:
--    (a) the `already_processed` returns in cases (1) and (3) must
--        agree on units; ledger is cents, contract is cents.
--    (b) lock the referrals table for the referrer before counting,
--        so concurrent first-purchases can't both pass the cap-of-3.
--    (c) assert webhook-supplied user_id matches the order's user_id;
--        defends against tampered Stripe metadata redirecting
--        fulfillment to a different account.
-- ------------------------------------------------------------
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
        'credit_balance',    v_balance_cents,  -- CENTS (matches RPC contract)
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
      INSERT INTO public.orders (
        user_id, status, amount_charged_cents, list_price_cents,
        credit_applied_cents, promo_code, source, stripe_payment_intent_id, items)
      VALUES (
        p_user_id, 'pending', 0, 2000, 0, p_promo_code, 'stripe',
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

  -- Server-authoritative identity check: the order's user_id is what we trust,
  -- never the metadata-supplied p_user_id. If they disagree, refuse the call —
  -- a real divergence indicates tampered metadata or a programming error.
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
      'credit_balance',    v_balance_cents,  -- CENTS (matches RPC contract)
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
      -- Lock the referrer's referrals BEFORE counting, so two concurrent
      -- first-purchases referred to the same person can't both pass the cap.
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
    'credit_balance',    v_balance_cents,  -- CENTS (matches RPC contract)
    'email',             v_user.email,
    'referral_code',     v_user.referral_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fulfill_order(uuid, public.order_source, text, text, text, text, jsonb) TO service_role;

-- ------------------------------------------------------------
-- 5. users_update_own — restrict to non-sensitive columns only.
--    Without this, an authenticated client can PATCH their own row via
--    the Supabase JS client and set founder_status = true, push
--    credit_balance to any value, fast-forward tc_agreed_at, or rewrite
--    referred_by to claim someone else's referral. All identity / money
--    fields must be writable only by the service role through
--    server-side actions.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "users_update_own" ON public.users;
-- No replacement policy is added on purpose: server actions use the
-- service-role client which bypasses RLS, so legitimate updates still
-- work. If a user-mutable field is ever introduced, add a narrowly
-- scoped policy at that time.
