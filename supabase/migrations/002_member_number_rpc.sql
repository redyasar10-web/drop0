-- ============================================================
-- assign_member_number(p_user_id)
--
-- Atomically claims the next member number from member_sequence
-- and writes it to users.member_number. Safe to call multiple
-- times for the same user — idempotent via FOR UPDATE lock.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_member_number(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing INT;
  v_number   INT;
BEGIN
  -- Lock the user row so concurrent webhook retries queue up
  SELECT member_number INTO v_existing
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Idempotent: return the already-assigned number
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Atomically claim the next sequence value
  UPDATE public.member_sequence
  SET next_number = next_number + 1
  WHERE id = 1
  RETURNING next_number - 1 INTO v_number;

  -- Stamp the user
  UPDATE public.users
  SET member_number = v_number
  WHERE id = p_user_id;

  RETURN v_number;
END;
$$;

-- ============================================================
-- redeem_promo_code(p_code)
--
-- Atomically increments use_count for the given code, only if
-- it is still active and under the max_uses limit.
-- Returns TRUE if the redemption was recorded, FALSE otherwise.
-- Disables the code when max_uses is reached.
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.promo_codes
  SET use_count = use_count + 1
  WHERE code    = p_code
    AND active  = TRUE
    AND use_count < max_uses;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Expire code once max_uses is reached
  UPDATE public.promo_codes
  SET active = FALSE
  WHERE code = p_code
    AND use_count >= max_uses;

  RETURN v_rows > 0;
END;
$$;
