-- The webhook uses upsert with onConflict: 'referrer_id,referred_id'.
-- Without this constraint the upsert silently inserts duplicates instead.
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_unique_pair UNIQUE (referrer_id, referred_id);
