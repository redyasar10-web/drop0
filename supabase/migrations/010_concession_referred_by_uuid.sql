-- ============================================================
-- Concession resolution — users.referred_by  TEXT -> UUID  (PRD §4)
--
-- The column historically stored the referrer's public referral_code (text).
-- PRD §4 specifies `referred_by uuid REFERENCES users(id)`. This migration
-- resolves existing codes to user ids and converts the column. Signup now
-- resolves the code to the referrer's id (see app/actions/auth.ts), and
-- fulfill_order looks the referrer up by id (007).
--
-- The public referral LINK still carries only the referral_code (REF-2);
-- the uuid is an internal detail set server-side.
--
-- Idempotent-ish: guarded so re-running is safe.
-- ============================================================

DO $$
BEGIN
  -- Only run the conversion if the column is still text.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND column_name = 'referred_by' AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_uuid UUID REFERENCES public.users(id);

    -- Resolve each stored referral_code to the referrer's id.
    UPDATE public.users u
    SET referred_by_uuid = r.id
    FROM public.users r
    WHERE u.referred_by IS NOT NULL
      AND r.referral_code = u.referred_by
      AND r.id <> u.id;   -- never self-reference

    DROP INDEX IF EXISTS public.users_referred_by_idx;
    ALTER TABLE public.users DROP COLUMN referred_by;
    ALTER TABLE public.users RENAME COLUMN referred_by_uuid TO referred_by;
    CREATE INDEX IF NOT EXISTS users_referred_by_idx ON public.users (referred_by);
  END IF;
END $$;
