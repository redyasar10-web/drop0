-- ============================================================
-- M3 — Balance & referral correctness
--
--   * BAL-4  balance can never go below zero (DB-enforced)
--   * BAL-6  $45 total credit ceiling per account (DB-enforced)
--   * REF-6  anti self-referral (DB CHECK)
--   * recompute_credit_balance() for reconciliation reuse
--
-- Referral cap-of-3 (REF-5) and idempotent crediting (REF-7) are already
-- atomic in fulfill_order (referrer row FOR UPDATE + UNIQUE(referrer,referred)
-- + partial unique referral grant per order). Promo cap-of-10 (PROMO-2) is
-- already atomic via the gated UPDATE in redeem_promo_code. The constraints
-- below are the DB-layer backstops the PRD requires regardless of app code.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ---- REF-6: anti self-referral at the DB layer ----
DO $$ BEGIN
  ALTER TABLE public.referrals
    ADD CONSTRAINT referrals_no_self_referral CHECK (referrer_id <> referred_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Credit ledger invariants (BAL-4 floor + BAL-6 ceiling)
--
-- BEFORE INSERT trigger on credit_events. 'reconciliation_adjust' is the
-- escape hatch used by the reconciliation job to correct drift and is
-- exempt. fulfill_order locks the user row before inserting, so per-user
-- inserts are serialized; this trigger is the authoritative backstop.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_credit_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INT;
  v_granted INT;
  v_ceiling INT := 4500;  -- $45.00 (CONFIG.CREDIT_CEILING_CENTS)
BEGIN
  -- Corrections bypass the invariants (they exist to fix drift).
  IF NEW.reason = 'reconciliation_adjust' THEN
    RETURN NEW;
  END IF;

  -- BAL-4: a spend cannot push the available balance below zero.
  IF NEW.amount_cents < 0 THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance
      FROM public.credit_events WHERE user_id = NEW.user_id;
    IF v_balance + NEW.amount_cents < 0 THEN
      RAISE EXCEPTION 'insufficient_credit: balance % + % < 0', v_balance, NEW.amount_cents
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- BAL-6: total granted credit (founding + referral) cannot exceed the ceiling.
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

DROP TRIGGER IF EXISTS trg_enforce_credit_invariants ON public.credit_events;
CREATE TRIGGER trg_enforce_credit_invariants
  BEFORE INSERT ON public.credit_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_credit_invariants();

-- ============================================================
-- recompute_credit_balance(p_user_id)
--
-- Recomputes the denormalized users.credit_balance cache from the ledger and
-- returns the authoritative balance IN CENTS. Cache and ledger are both in
-- cents (= SUM(credit_events.amount_cents)). Used by fulfillment and by the M5
-- reconciliation job.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_credit_balance(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cents INT;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_cents
    FROM public.credit_events WHERE user_id = p_user_id;
  UPDATE public.users SET credit_balance = v_cents WHERE id = p_user_id;
  RETURN v_cents;
END;
$$;

-- ---- Conservative backfill -----------------------------------
-- Recompute the cache from the ledger ONLY for users who already have ledger
-- events (post-M2 fulfillments). Users with no credit_events keep their
-- existing cache untouched, so legacy test balances that predate the ledger
-- are not silently wiped. Per PRD §12.7, if real historical data exists,
-- backfill orders/credit_events first, then run a full recompute.
UPDATE public.users u
SET credit_balance = sub.cents
FROM (
  SELECT user_id, COALESCE(SUM(amount_cents), 0) AS cents
  FROM public.credit_events GROUP BY user_id
) sub
WHERE u.id = sub.user_id;

-- ---- Execution hardening (service role only) ----
REVOKE ALL ON FUNCTION public.recompute_credit_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.recompute_credit_balance(uuid) TO service_role;
