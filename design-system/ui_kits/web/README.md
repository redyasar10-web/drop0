# UI Kit — Chariot (Web)

A working storefront prototype for **Chariot** — the U.S. retailer of record for independent Accra fashion labels. Buy in dollars, ship from New York, duties included.

This is a click-through React prototype mounted from a single `index.html`. It uses the real Chariot logo, real campaign videos, and the actual 1NRI + Jireh product catalogs scraped from each brand's origin store.

## Routes

Hash-based routing — every link/button below is wired:

| Route | Surface | Notes |
|---|---|---|
| `#/` | Home | Video hero · how-it-works · featured drop · brand split · trust block · grid · founding-circle email |
| `#/shop/all` | PLP | Filter segments: All · In stock · Sold out · 1NRI · Jireh · Tops · Outerwear · Bottoms · Accessories |
| `#/brand/1nri` | Brand | 1NRI cover · in-stock grid · sold-out archive |
| `#/brand/jireh` | Brand | Jireh campaign video · Battle Angel grid |
| `#/product/<id>` | PDP | Multi-image gallery · size · duties-included pricing · ships-from-NY trust |
| `#/about` | About | Six-step retailer-of-record explainer |
| `#/order/CHR-21078` | Order | Confirmation timeline (used after checkout) |

The cart drawer is global; it opens on add-to-bag and previews USD shipping over $150.

## Visual direction — Warm Gallery

Tokens live in `tokens.css` (page-local) and override the global `colors_and_type.css` import. Source: `WEBSITE_DESIGN_BRIEF.md`.

- **Cream `#F5F0E8`** page · **Off-white `#FAF7F0`** sections · **Charcoal `#1A1614`** text
- **Forest `#1B4332`** primary CTA · **Gold `#C9A961`** eyebrows and accents
- **Display:** Cormorant Garamond (italic for accents). **Sans:** Inter. **Mono:** JetBrains.
- Generous whitespace; everything image-led.

## Files

- `index.html` — loads React + Babel + the four JSX modules; mounts `<App />`.
- `tokens.css` — Warm Gallery palette + type variables (overrides root tokens).
- `styles.css` — full storefront stylesheet.
- `Data.jsx` — `BRANDS`, `PRODUCTS`, `SHOP_SEGMENTS`. Every product has a real image; sold-out vs. available is honest to the origin store.
- `Primitives.jsx` — `Btn`, `Tag`, `ProductCard`, `Segments`, `TrustBlock`.
- `Chrome.jsx` — `TopBar`, `Header` (with transparent-over-video state), `Footer`.
- `Pages.jsx` — `HomePage`, `ShopPage`, `BrandPage`, `ProductPage`, `AboutPage`, `OrderPage`, `CartDrawer`.
- `App.jsx` — `useRoute`, `useCart`, top-level `<App />`.
- `assets/` — `chariot-logo.png` (header), `chariot-logo-white.png` (footer), `hero.mp4`, `jireh-hero.mp4`, plus `1nri/` and `jireh/` product directories.

## Editing

- **Add a product** → push a new entry to `PRODUCTS` in `Data.jsx`. Required keys: `id, brand, name, colorway, category, us, gh, status, img, images, desc`.
- **Swap the hero video** → replace `assets/hero.mp4` with a 12–25 sec, ≤8 MB MP4. Poster is `assets/jireh/campaign-02.jpg`.
- **Tweak the palette** → edit `tokens.css`. The grayscale, type, and motion scales are inherited from the project root `colors_and_type.css`.

## Known gaps

- Real checkout / payment integration is mocked — the order page renders a fixed confirmation.
- Search and account icons in the header are decorative.
- The brand brief mentions **Lookbook** + **Journal** routes; both are stubbed under the Journal nav link, which currently aliases to About.
