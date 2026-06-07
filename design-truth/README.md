# Design Truth — Canonical Front-End Source

**This directory is the single, absolute source of truth for the Chariot front-end design.**

These files were authored as the final design version and copied here from the
`edits` design bundle on 2026-06-06. Any front-end work in this repo — especially
the M6 "Front-end integration" milestone in `Chariot_Backend_PRD` — must port
**from these HTMLs/CSS**, not from the older `app/` JSX or the legacy
`design-system/` directory.

## Authority rules

1. When the design here and any existing JSX/page in `app/` disagree, **this wins.**
   The pre-existing `app/page.tsx`, `app/LandingNav.tsx`, `app/account/`,
   `app/checkout/`, and the `(auth)` pages are being intentionally scrapped and
   rebuilt against these files.
2. The legacy `design-system/` directory is **superseded** by this one. Do not
   port from it.
3. Keep this directory in sync if the design ever changes. It is the reference,
   not a one-time snapshot to be forgotten.

## Page map (design → Next.js route)

| Design file              | Purpose                        | Target route        |
|--------------------------|--------------------------------|---------------------|
| `Drop 0 Landing.html`    | Marketing / landing surface    | `/`                 |
| `login.html`             | Login + signup auth surface    | `/login`, `/signup` |
| `account.html`           | Account dashboard              | `/account`          |
| `checkout.html`          | Embedded checkout              | `/checkout`         |
| `About.html`             | About page                     | `/about`            |
| `Support.html`           | Support page                   | `/support`          |

## Shared assets

- `chariot.css` — shared/global styles
- `chariot.js` — shared interactivity
- `*.page.css` — per-page styles
- `fonts/` — Inter variable font
- `public/` — images and brand assets
- `_ref/` — brand strategy reference (voice, positioning)
