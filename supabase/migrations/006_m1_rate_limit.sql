-- ============================================================
-- M1 — Auth rate limiting (ACC-7 / ASVS 11.1.4)
--
-- DB-backed fixed-window limiter so limits hold across ephemeral
-- serverless instances (in-memory counters would not). Each caller
-- supplies a bucket key like 'login:ip:1.2.3.4' or 'login:email:foo@x'.
--
-- Only the service role touches this table (called from server actions
-- via the admin client). RLS on, no policies => default-deny for
-- anon/auth.
--
-- Idempotent: safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket_key   TEXT        PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  count        INT         NOT NULL DEFAULT 0
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Sweep helper for old buckets (optional; reconciliation/cron may call it).
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_idx
  ON public.auth_rate_limits (window_start);

-- ------------------------------------------------------------
-- check_rate_limit(p_key, p_max, p_window_seconds)
--
-- Atomically records one attempt against the bucket and returns
-- TRUE if the attempt is ALLOWED (still under the limit), FALSE if
-- it should be REJECTED. Fixed window: when the current window has
-- elapsed it resets. The row lock (ON CONFLICT ... ) makes the
-- read-modify-write race-free under concurrency (ASVS 11.1.6).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            TEXT,
  p_max            INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count        INT;
BEGIN
  -- Upsert the bucket. On first hit, insert a fresh window at count 1.
  INSERT INTO public.auth_rate_limits (bucket_key, window_start, count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET
      -- If the existing window has expired, reset it; else carry it forward.
      window_start = CASE
        WHEN public.auth_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          THEN v_now
        ELSE public.auth_rate_limits.window_start
      END,
      count = CASE
        WHEN public.auth_rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE public.auth_rate_limits.count + 1
      END
  RETURNING window_start, count INTO v_window_start, v_count;

  -- Allowed if this attempt is within the cap.
  RETURN v_count <= p_max;
END;
$$;
