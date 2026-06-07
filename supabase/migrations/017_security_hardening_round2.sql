-- ============================================================
-- M7.2 — Round-2 security hardening for the products catalog
--
-- Lands findings from the post-015 review pass:
--   * touch_updated_at lacked SECURITY DEFINER + SET search_path
--     (only function in this codebase missing the standard guards).
--     Attacker with public-schema write rights could shadow public.NOW().
--   * drops_read_all used USING (TRUE), exposing planned + archived
--     drops to anonymous visitors. Narrowed to user-facing statuses.
--
-- Idempotent.
-- ============================================================

-- ---- C1: pin search_path + SECURITY DEFINER on the touch trigger ----
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---- H1: drops_read_all leaked planned + archived drops ----
-- Anonymous visitors should see drops that are visible on the live site
-- (open, closed, shipped — i.e. anything customers might link to from
-- order receipts), NOT planned drops that haven't been announced and
-- NOT archived drops we're keeping for history.
DROP POLICY IF EXISTS "drops_read_all" ON public.drops;
CREATE POLICY "drops_read_visible" ON public.drops FOR SELECT
  USING (status IN ('open', 'closed', 'shipped'));

-- ============================================================
-- M2 (informational): manual admin-promote fallback if migration 016
-- ran before caleb@chariotarchive.com signed up:
--
--   UPDATE public.users SET is_admin = TRUE
--   WHERE id = (SELECT id FROM auth.users
--               WHERE lower(email) = 'caleb@chariotarchive.com');
-- ============================================================
