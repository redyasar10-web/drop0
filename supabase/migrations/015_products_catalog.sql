-- ============================================================
-- M7 — Product catalog
--
-- Lets the team add / edit / archive products without code changes.
-- Drives the landing carousel and (Drop 1+) the checkout SKU line items.
-- Stripe product / price IDs are stored alongside the canonical row so
-- the sync helper is idempotent and re-syncable.
--
-- Tables:
--   * brands             — Chariot's stable of independent labels
--   * drops              — release windows (Drop 0, Drop 1, ...)
--   * products           — one canonical row per SKU
--   * product_images     — many-per-product, ordered
--   * product_variants   — sized / coloured variants with inventory
--
-- Admin gating happens at the app layer (lib/admin-guard.ts) AND at
-- RLS — anon may read active products only; service-role does writes.
-- ============================================================

-- ---- brands -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT         NOT NULL UNIQUE,         -- '1nri', 'jireh'
  name         TEXT         NOT NULL,                -- '1NRI'
  city         TEXT,                                 -- 'Accra'
  bio          TEXT,
  status       TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order   INT          NOT NULL DEFAULT 100,
  hero_image   TEXT,                                 -- /brands/brand-1nri.jpg
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brands_status_sort_idx ON public.brands (status, sort_order);

-- Seed the existing brands so the landing page can render against this
-- table immediately rather than waiting for someone to populate manually.
INSERT INTO public.brands (slug, name, city, bio, sort_order, hero_image) VALUES
  ('1nri',  '1NRI',  'Berekuso, Accra',
   'Faith-rooted streetwear by Nana Kwadwo Osei Nyarko. Six years dressing Accra''s creative class.',
   10, '/brands/brand-1nri.jpg'),
  ('jireh', 'Jireh', 'Accra, Ghana',
   'Tailored, considered, unmistakably Accra.',
   20, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ---- drops --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drops (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT         NOT NULL UNIQUE,         -- 'drop-0', 'drop-1'
  number       INT          NOT NULL UNIQUE,         -- 0, 1, 2
  name         TEXT         NOT NULL,                -- 'Founding Fifty', 'Drop 1'
  status       TEXT         NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'open', 'closed', 'shipped', 'archived')),
  window_opens_at  TIMESTAMPTZ,
  window_closes_at TIMESTAMPTZ,
  founder_early_access_hours INT NOT NULL DEFAULT 24,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS drops_status_idx ON public.drops (status);

INSERT INTO public.drops (slug, number, name, status, window_closes_at)
VALUES
  ('drop-0', 0, 'The Founding Fifty', 'open', '2026-06-14T23:59:59Z'),
  ('drop-1', 1, 'Drop 1',             'planned', NULL)
ON CONFLICT (slug) DO NOTHING;

-- ---- products -----------------------------------------------
-- sku is the human-stable identifier used in orders.items JSON and the
-- Stripe product metadata. Never rename — issue a new sku instead.
CREATE TABLE IF NOT EXISTS public.products (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  sku              TEXT         NOT NULL UNIQUE,
  slug             TEXT         NOT NULL UNIQUE,
  name             TEXT         NOT NULL,
  subtitle         TEXT,
  description      TEXT,
  brand_id         UUID         REFERENCES public.brands(id) ON DELETE RESTRICT,
  drop_id          UUID         REFERENCES public.drops(id)  ON DELETE RESTRICT,
  -- Money in cents to match the rest of the system.
  price_cents      INT          NOT NULL CHECK (price_cents >= 0),
  retail_cents     INT          CHECK (retail_cents IS NULL OR retail_cents >= 0),
  currency         TEXT         NOT NULL DEFAULT 'usd' CHECK (currency = lower(currency)),
  status           TEXT         NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  sort_order       INT          NOT NULL DEFAULT 100,
  -- Stripe sync state.
  stripe_product_id TEXT        UNIQUE,
  stripe_price_id   TEXT        UNIQUE,
  -- Free-form JSON for variant model decisions, badge text, etc.
  metadata         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_status_sort_idx ON public.products (status, sort_order);
CREATE INDEX IF NOT EXISTS products_brand_idx       ON public.products (brand_id);
CREATE INDEX IF NOT EXISTS products_drop_idx        ON public.products (drop_id);

-- Touch updated_at automatically.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brands_touch   ON public.brands;
DROP TRIGGER IF EXISTS trg_drops_touch    ON public.drops;
DROP TRIGGER IF EXISTS trg_products_touch ON public.products;

CREATE TRIGGER trg_brands_touch   BEFORE UPDATE ON public.brands   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_drops_touch    BEFORE UPDATE ON public.drops    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---- product_images ----------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url          TEXT         NOT NULL,                 -- '/products/dusk-tee-black.jpg' or absolute
  alt          TEXT,
  sort_order   INT          NOT NULL DEFAULT 100,
  is_primary   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_images_product_sort_idx
  ON public.product_images (product_id, sort_order);
-- At most one primary image per product.
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary
  ON public.product_images (product_id) WHERE is_primary = TRUE;

-- ---- product_variants --------------------------------------
-- For Drop 0 the founding-member SKU has no variant. Drop 1 apparel will.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku             TEXT         NOT NULL UNIQUE,       -- 'dusk-tee-black-M'
  size            TEXT,                                -- 'S', 'M', 'L'
  color           TEXT,                                -- 'Black'
  inventory_count INT          NOT NULL DEFAULT 0 CHECK (inventory_count >= 0),
  stripe_price_id TEXT         UNIQUE,                 -- variant-level override; usually null
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants (product_id);

DROP TRIGGER IF EXISTS trg_variants_touch ON public.product_variants;
CREATE TRIGGER trg_variants_touch BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- RLS — public read for active rows, service-role writes only.
-- ============================================================
ALTER TABLE public.brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_read_active"   ON public.brands;
DROP POLICY IF EXISTS "drops_read_all"       ON public.drops;
DROP POLICY IF EXISTS "products_read_active" ON public.products;
DROP POLICY IF EXISTS "images_read_active"   ON public.product_images;
DROP POLICY IF EXISTS "variants_read_active" ON public.product_variants;

CREATE POLICY "brands_read_active"   ON public.brands   FOR SELECT USING (status = 'active');
CREATE POLICY "drops_read_all"       ON public.drops    FOR SELECT USING (TRUE);
CREATE POLICY "products_read_active" ON public.products FOR SELECT USING (status = 'active');
CREATE POLICY "images_read_active"   ON public.product_images   FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'));
CREATE POLICY "variants_read_active" ON public.product_variants FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'));

-- All writes go through the service-role client (server actions). No policy
-- needed — service role bypasses RLS.

-- ============================================================
-- is_admin column on users so the admin guard has somewhere to read.
-- Default false. The deploy script / runbook seeds caleb@chariotarchive.com.
-- ============================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
