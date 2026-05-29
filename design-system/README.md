# Chariot — Design System

> **What the rest of the world is already wearing.**

Chariot is a cross‑border fashion commerce and trust layer. It brings independent global fashion brands — starting with Accra‑based labels **1Nri** and **Jireh** — to U.S. consumers through curated, community‑validated preorder drops. Chariot acts as the U.S. retailer of record, handling import, customs, pricing clarity, fulfillment, returns, and post‑purchase support so shoppers can buy international independent fashion with domestic confidence.

Core editorial POV: **"Fashion is already global. The stores just haven't caught up."**

This design system is the ground‑truth reference for any surface that carries the Chariot name — ecommerce, editorial, social, founder/community comms, physical packaging. It is a translation of the brand documents (`CHARIOT_BRAND_V3_SYSTEM.md`, `CHARIOT_CONTENT_PLAYBOOK.md`) into usable tokens, components, and examples.

---

## Sources

The system is derived from:

- **`uploads/CHARIOT_BRAND_V3_SYSTEM.md`** — ground truth for identity, color, type, logo, photography, voice. Status: supersedes all prior brand docs.
- **`uploads/CHARIOT_CONTENT_PLAYBOOK.md`** — content & voice execution. Founder channel vs. `@chariotarchive` distinction, post formats, caption system.
- **(pending attachment)** Prototype codebase: `index.html`, `about.html`, `shop.html`, `jireh.html`, `1nri.html`, `styles.css`, `script.js` — described as the current working frontend and the reference for UI‑kit recreation.
- **(pending attachment)** `Logos 2/` directory and 1Nri / Jireh editorial + product assets.
- **(pending attachment)** `CHARIOT_FINAL_MARKETING_PACKET.md` — marketing packet referenced by the brand doc.

Local origin of these files: `/Users/red/Downloads/everything-chariot`. Reader of this doc is assumed to have view access only via the project; paths above are recorded so the owner can re‑attach if something needs to be traced back.

---

## The brand in one page

| Element | Value |
|---|---|
| Slogan | "What the rest of the world is already wearing." |
| Short form | "Already wearing it." |
| Editorial POV | "Fashion is already global. The stores just haven't caught up." |
| Manifesto anchor | "Where did you get that?" |
| Business model | Retailer of record. Wholesale at 45–50%, sold at 1.8–2.2× domestic. |
| Launch model | Community pre‑order. 50% deposit. 14‑day window. Hard cap at MOQ. |
| Founding brands | 1Nri, Jireh (Ghana) |
| Primary color | Ink `#111111` |
| Background | Harmattan `#F2EBE0` |
| Signal | Kente `#C9921E` |
| Accent | Laterite `#9B4523` |
| Display type | ABC Monument Grotesk (Söhne backup) |
| Body type | Freight Text Pro (Spectral free alternative) |
| Utility type | Söhne Mono (DM Mono free alternative) |
| Logo | CHARIOT wordmark, tracked +80, Ink on Harmattan |

---

## Content fundamentals

Chariot's voice is **specific, insider, culturally literate, warm but not casual, confident but not loud**. The test for any sentence: would a Parisian concept store website or a thoughtful editor at _The Cut_ publish it? If it reads like a startup, a TED talk, or a travel agency, it is wrong.

### Two voices, never blended

- **Voice A — The Channel (`@chariotarchive`, product pages, community).** Third person. Complete‑state. Never says "I." Never hedges. Never announces — shows. Assumes you already know.
- **Voice B — The Founder (personal LinkedIn, TikTok, direct outreach).** First person. In‑progress. Shares what didn't work. The only place "I" is permitted.

The founder is building the house. `@chariotarchive` **is** the house.

### Rules

- Specific over generic. Name places (Accra, Bed‑Stuy, Ponce City Market), fabrics, founders, constructions, street references, operational facts. Never "African fashion" as a category — name the brand.
- Left‑aligned. Never centered blocks.
- Display ≤ 5 words per line. If longer, break it.
- Bold is a decision, not a default. Italic is for founders' names and editorial emphasis only.
- Trust signals (price, shipping, duties, returns, SKU) are always set in Mono. Always.
- Caption formula for `@chariotarchive`:
  1. Specific cultural fact.
  2. Transit fact — "Made in Accra. Ships from New York."
  3. Community frame — who chose this, why it matters.
  4. Operational signal — one trust fact.
  5. CTA, only if a drop is live. `@brandtag`.

### Banned vocabulary (permanent)

Redefining · bridging (worlds / the gap) · empowering · celebrating · honoring · discover · explore · stunning · beautiful · incredible · "African fashion" (as category) · "emerging" (of the market).

### Example — before / after

> ❌ "We're celebrating the incredible designs of African fashion by bridging the gap between African designers and American consumers. Discover stunning pieces today."
>
> ✓ "1Nri has been dressing Accra's creative class for six years. Their US debut is here. One drop. 14 days. No customs chaos."

### Casing

- Wordmark: **UPPERCASE**, tracked +80.
- Section labels, badges, nav: **UPPERCASE**, tracked +60 to +100, Mono.
- Display headlines: Sentence case — not Title Case — in Monument Grotesk.
- Editorial body: Sentence case, Freight Text Pro.
- Trust signals: Mono, mixed case as written ("Ships in 3 days.", "Duties paid.").

### Emoji

No. Not in product, not in email, not in `@chariotarchive` captions. The founder channel may use them once in a while if it actually sounds like the person, but default off.

---

## Visual foundations

The system is **warm monochromatic** — every neutral shares a yellow‑brown undertone (hues 17–38°) so the palette photographs together and reads as designed rather than assembled. The two chromatic accents (Kente gold, Laterite red) earn their power by scarcity.

### Color behavior

- Page backgrounds: **Harmattan**. Secondary surfaces and cards: **Dust**. Never Ash as a fill — Ash is structural (borders, dividers) only.
- Body text: **Ink**. Subordinate text / metadata / captions: **Shadow**. Reversed text: **Salt** on **Ink**.
- **Kente** is a headline and badge color only. Max one instance per screen section. Never body.
- **Laterite** is used for urgency (closing states, sold‑out, deadline type) — never with Kente on the same surface.
- No pure `#000` or pure `#fff`. Use Ink / Salt.
- No cold blues, greens, greys, or purples. No Pan‑African red/gold/green system.

### Type

Three families, three jobs.

- **Display** — Monument Grotesk. Headlines, wordmark, hero moments. Geometric, sharp, masthead‑feeling. Fallback: Söhne.
- **Editorial body** — Freight Text Pro. Long‑form copy, brand stories, founder narratives. Fallback: Spectral (free).
- **Operational / labels** — Söhne Mono. Prices, SKUs, shipping windows, duties, return policy, timestamps. Fallback: DM Mono (free).

Note on substitutes: the prototype uses Inter + Playfair as stand‑ins because Monument / Freight / Söhne are licensed. This system now ships with a **local Inter variable file (`fonts/Inter-opsz-wght.ttf`, opsz + wght axes)** for all display type, and loads **Spectral (body)** and **DM Mono (operational)** from Google Fonts as stand‑ins for Freight Text Pro and Söhne Mono. **Body and mono substitutions are still flagged** — please attach licensed Freight Text and Söhne Mono files to `fonts/` when available and the `@font-face` block will pick them up.

### Spacing & layout

- Baseline unit: **4px**. Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128.
- Content widths: 560 (editorial text), 960 (standard), 1280 (site max), 1440 (full‑bleed editorial grids).
- Gutters: 24 on mobile, 32 tablet, 48 desktop.
- Align left. Rag right. No full‑justified blocks.
- Layouts borrow magazine logic: wide columns for imagery, narrow measures for text (60–72 char line length for Freight Text), strong whitespace, asymmetric grids.

### Backgrounds, imagery, texture

- Warm backgrounds only — Harmattan and Dust. Photography uses linen, raw concrete, oiled wood, unbleached paper. **No white lightbox ever.**
- Product imagery has four required shots: flat‑lay (Harmattan), on‑body 3/4, macro detail, in‑context worn. See `CHARIOT_BRAND_V3_SYSTEM.md → Photography Direction V3`.
- Full‑bleed imagery is permitted on editorial/about/drop pages. Grid layouts on product. Never collage or scrapbook treatments.
- Occasional subtle film grain or paper noise on editorial hero imagery is acceptable. No Instagram filters. No gradients as background.

### Borders, shadows, corners

- Border default: **1px Ash** (`#C8C0B5`). Hairline emphasis: `0.5px` on Retina, used for "stamp" chrome and hangtag outlines.
- **No drop shadows** as a rule. Chariot is a flat, print‑rooted system. The only elevation treatment is the `stamp` border: 1px hairline, 8–16px inner padding, uppercase Mono label top‑left.
- Corner radius: **0** is default. Pill shapes (radius `9999px`) are allowed for filter chips and trust badges only. Small radius (`2px`) on inputs. Never 8–16px "app card" rounding.
- No inner shadows. No glow. No neumorphism.

### Motion & interaction

- Motion is restrained and unsentimental. Default easing: `cubic-bezier(.2, .6, .2, 1)` ("calm out"). Durations: 120ms (state), 220ms (position), 400ms (reveal).
- Preferred transitions: cross‑fades on hover, subtle opacity and letter‑spacing shifts on links. No bounces, no springs, no parallax.
- **Hover:** text links — underline on, letter‑spacing stays. Buttons — Ink surface lightens to Shadow (10% lift), or outline fills with Ink. Cards — surrounding chrome holds; a thin 1px Ink rule appears under the label; no scale or shadow.
- **Press:** opacity drops to 85%. No scale‑down.
- **Focus:** 2px outline in Ink offset 2px. Never a blue native ring.
- Page transitions: a 220ms opacity fade. Never slide‑in drawers for primary nav.

### Transparency & blur

- Used sparingly. The drop status bar and the trust strip may sit over imagery with a `rgba(17,17,17,0.72)` overlay and 12px backdrop blur. Protection gradients (linear, Ink 0→60%) are permitted on full‑bleed hero imagery where headline legibility demands it. Never decorative.

### Fixed elements

- Primary navigation: fixed top, Harmattan surface, 1px Ash bottom border when scrolled past hero.
- Drop countdown strip: fixed top above nav when a drop is live. Ink surface, Salt type, Mono. Single line. Dismissible.
- Footer: static, deep Ink slab, Salt type, Mono for operational lines, Freight Text for editorial.

### Cards

The house style card is a **flat tile** on Dust with 1px Ash border and no shadow. Product cards are image‑first — the image IS the card. Text below the image is left‑aligned, Monument Grotesk for name, Mono for price. The only chrome allowed around a product image is a thin Ink hairline frame used on the flat‑lay reference shot.

### Imagery color vibe

Warm, not cool. Golden hour > studio flash. Natural skin tones with a warm cast. Film grain acceptable; heavy B&W only for founder portraits or archival editorial. Never cyan, never teal, never heavily desaturated.

---

## Iconography

**Chariot's default is no icons.** The brand relies on typography, photography, and operational Mono labels to carry meaning. Where an icon is genuinely clarifying, use a minimal, hairline, **1.25px stroke** line icon in Ink on Harmattan. No filled icons. No colored icons. No multicolor illustrations. No emoji anywhere in product surfaces.

Because the codebase had not landed at authoring time, **no native icon font or SVG sprite was found in the project.** Until the real set arrives, the system links **[Lucide](https://lucide.dev)** (via its web component CDN) as the closest match — hairline stroke, editorial feel, open source. Usage in `ui_kits/web/index.html` and throughout is `<i data-lucide="arrow-right"></i>`.

**Icon usage rules:**
- Use icons only for: external link arrows, cart / bag, close (×), drop countdown marker, chevron pagination, share. Nothing decorative.
- Size: 16px (inline with Mono), 20px (buttons), 24px (hero/nav). Stroke stays 1.25px regardless of size.
- Color: inherits `currentColor`. Default Ink. Never Kente, never Laterite.
- Unicode: acceptable for typographic marks only — `·` (bullet), `—` (em dash), `→` (arrow in editorial captions), `×` (close), `⁄` (fraction). Use the real Unicode, not `-`, `->`, or `x`.
- Emoji: never.

**Flagged substitution:** Lucide stands in for whatever the prototype's actual icon set is. Please confirm the final set when the codebase lands.

---

## Index

### Root
- `README.md` — this file.
- `SKILL.md` — portable skill manifest (works in Claude Code).
- `colors_and_type.css` — base + semantic tokens, font faces, reset.

### `assets/`
Logos and brand marks (`chariot-wordmark.svg`, `chariot-wordmark-salt.svg`, `chariot-stamp.svg`). Awaiting the licensed `Logos 2/` upload — current marks are typeset placeholders that match the spec (UPPERCASE, tracked +80, Ink on Harmattan).

Real product photography lives in `ui_kits/web/assets/` — 14 hero shots from the 1Nri archive, used across the storefront, brand pages, and PDP.

### `fonts/`
Web fonts. Currently **empty** — Google Fonts substitutes are loaded via CDN in `colors_and_type.css`. When licensed Monument / Freight / Söhne files arrive, drop them in and the `@font-face` block will pick them up.

### `preview/`
Design‑system cards that populate the Design System tab. Each file is a small HTML specimen (~700×150–400). Grouped: Type, Colors, Spacing, Components, Brand.

### `ui_kits/web/`
The Chariot site UI kit — **Warm Gallery** direction. A retail-rooted prototype with reservation flow, founder-channel ribbon, drop counter, brand pages for 1Nri and Jireh, and an editorial-leaning PDP. Built around the real product photography in `ui_kits/web/assets/` (14 hero shots from the 1Nri archive). `index.html` is the click-through entry. Components are small JSX files loaded into the page (`Data.jsx`, `Chrome.jsx`, `Primitives.jsx`, `Pages.jsx`, `App.jsx`).

The Warm Gallery direction commits to:
- **Real imagery first.** Every above-the-fold module uses a real product or editorial photo. No stylized fallback tiles in primary positions.
- **Slogan-led hero.** The H1 is the brand slogan ("What the rest of the world is already wearing.") set in display, with a single supporting paragraph and one primary CTA. No manifesto.
- **Drop counter strip.** Fixed-top Mono ribbon with units sold / units left and a deadline timestamp. Always present when a drop is live.
- **Reservation-style PDP.** "Reserve your size" replaces "Add to cart" during pre-order windows. Trust signals (deposit %, ship-by date, duties paid, returns) are Mono and stacked.
- **Founder voice band.** A single short paragraph from the founder, in Freight Text, separated by a hairline rule. Never blended with `@chariotarchive` voice.

### `SKILL.md`
Portable skill manifest so this folder works as a Claude Code skill.

### `slides/`
Not included. No deck template was provided.

---

## How to iterate on this system

1. Read `CHARIOT_BRAND_V3_SYSTEM.md` and `CHARIOT_CONTENT_PLAYBOOK.md` first. They are the source of truth.
2. Use `colors_and_type.css` variables. Never hard‑code a hex or a px font size — the tokens are the system.
3. When in doubt on voice: write the sentence twice, once as founder, once as `@chariotarchive`. Ship whichever register matches the surface.
4. New components live in `ui_kits/web/` as small JSX files and in `preview/` as specimen cards.
5. Flag every substitution (icons, fonts, placeholder imagery) with a comment and an asset request.
