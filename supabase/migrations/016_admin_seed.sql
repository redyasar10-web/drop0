-- ============================================================
-- M7.1 — Seed Caleb as admin.
--
-- The is_admin column on users defaults to FALSE. This migration
-- elevates the operator account so they can sign in and use /admin
-- the moment the site is deployed. Idempotent: it's a no-op until
-- the account actually exists in auth.users, and a no-op afterward
-- once is_admin is already TRUE.
--
-- To add additional admins later: insert their auth user, then run
--   UPDATE public.users SET is_admin = TRUE WHERE email = '<them>';
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'caleb@chariotarchive.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users SET is_admin = TRUE WHERE id = v_user_id;
  END IF;
END $$;
