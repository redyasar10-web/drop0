-- ============================================================
-- M0 — Atomic Postgres functions + promo kind
--
-- 1. assign_member_number(p_user_id)  — adds the 50-spot cap (FM-4)
--    on top of the existing idempotent, race-safe assignment.
-- 2. available_balance(p_user_id)     — ledger-derived balance (BAL-2).
-- 3. promo_codes.kind                 — promo effect discriminator (§4).
--
-- Idempotent: safe to re-run. CREATE OR REPLACE for functions.
-- ============================================================

-- ---- assign_member_number -----------------------------------
-- Atomically claims the next member number 1..50 from member_sequence
-- and stamps it on users.member_number. Idempotent: if the user already
-- has a number it is returned without consuming a sequence value
-- (safe for retried webhooks). Raises 'sold_out' once 50 are assigned.
-- (ASVS 11.1.6 — no TOCTOU/race; the gated UPDATE is the atomic claim.)
CREATE OR REPLACE FUNCTION public.assign_member_number(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing INT;
  v_number   INT;
BEGIN
  -- Lock the user row so concurrent webhook retries for the SAME user queue up.
  SELECT member_number INTO v_existing
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent: return the already-assigned number, no sequence consumed.
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Atomic claim + cap: only succeeds while the sequence is within 1..50.
  -- next_number is the NEXT value to hand out; after handing out #50 it
  -- becomes 51 and this UPDATE matches no rows -> sold out.
  UPDATE public.member_sequence
  SET next_number = next_number + 1
  WHERE id = 1
    AND next_number <= 50
  RETURNING next_number - 1 INTO v_number;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'sold_out' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.users
  SET member_number = v_number
  WHERE id = p_user_id;

  RETURN v_number;
END;
$$;

-- ---- available_balance --------------------------------------
-- Ledger-derived balance in cents: SUM(credit_events.amount_cents).
-- SECURITY INVOKER so RLS applies: a browser/auth caller sees only their
-- own events (others sum to 0); the service role bypasses RLS and gets the
-- true total. This is the authoritative balance; users.credit_balance is a cache.
CREATE OR REPLACE FUNCTION public.available_balance(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_cents), 0)::INT
  FROM public.credit_events
  WHERE user_id = p_user_id;
$$;

-- ---- redeem_promo_code (unchanged behavior, restated for completeness)
-- Already defined in 002_member_number_rpc.sql with an atomic gated UPDATE
-- and FOR-the-cap semantics. Left as-is. (PROMO-2)

-- ---- promo_codes.kind ---------------------------------------
DO $$ BEGIN
  CREATE TYPE public.promo_kind AS ENUM ('free_founding_spot', 'amount_off', 'percent_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS kind public.promo_kind NOT NULL DEFAULT 'free_founding_spot';

-- zarathustra grants a free founding spot.
UPDATE public.promo_codes SET kind = 'free_founding_spot' WHERE code = 'zarathustra';
