-- ============================================================
-- Chariot — Drop 0 initial schema
-- Run via Supabase dashboard > SQL Editor, or supabase db push
-- ============================================================

-- ---- users --------------------------------------------------
-- id mirrors auth.users — set by the server action after signUp
-- member_number is null until first Stripe purchase (assigned by webhook)
-- credit_balance starts at 0; set to 30 by webhook on first purchase
-- referral_code auto-assigned at signup; unique
-- referred_by stores the referral_code of the person who referred this user
-- tc_agreed_at NOT NULL enforces server-side T&C gate

CREATE TABLE IF NOT EXISTS public.users (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  member_number   INT         UNIQUE,
  credit_balance  INT         NOT NULL DEFAULT 0,
  referral_code   TEXT        NOT NULL UNIQUE,
  referred_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  founder_status  BOOLEAN     NOT NULL DEFAULT FALSE,
  tc_agreed_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS users_referral_code_idx  ON public.users (referral_code);
CREATE INDEX IF NOT EXISTS users_referred_by_idx    ON public.users (referred_by);
CREATE INDEX IF NOT EXISTS users_member_number_idx  ON public.users (member_number);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users may read their own row
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Users may update their own row (service role bypasses RLS for webhooks)
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- member_sequence ----------------------------------------
-- Single-row table; member numbers assigned sequentially by webhook,
-- never on the frontend.

CREATE TABLE IF NOT EXISTS public.member_sequence (
  id          INT  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_number INT  NOT NULL DEFAULT 1
);

INSERT INTO public.member_sequence (id, next_number)
VALUES (1, 1)
ON CONFLICT DO NOTHING;

-- ---- referrals ----------------------------------------------

CREATE TABLE IF NOT EXISTS public.referrals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credited    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can see referrals where they are the referrer
CREATE POLICY "referrals_select_own" ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_id);

-- ---- promo_codes --------------------------------------------

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code      TEXT    PRIMARY KEY,
  max_uses  INT     NOT NULL DEFAULT 10,
  use_count INT     NOT NULL DEFAULT 0,
  active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- zarathustra: 100% off Drop 0, grants founder_status + $30 credit
-- Expires at 10 uses. Never trust client-side redemption count.
INSERT INTO public.promo_codes (code, max_uses, active)
VALUES ('zarathustra', 10, true)
ON CONFLICT DO NOTHING;

-- Only service role (webhooks, server-side validation) touches promo_codes
-- No RLS policies that grant user access
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
