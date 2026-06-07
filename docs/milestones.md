# Milestone notes — operational / manual steps

Code and migrations are implemented per `Chariot_Backend_PRD.md`. Some
acceptance criteria depend on **Supabase/Stripe/DNS dashboard settings** that
cannot live in code. Those are tracked here so launch isn't blocked on memory.

---

## M0 — Schema + RLS foundation  ✅ code complete

- Apply migrations `004` and `005` (see `supabase/migrations/README.md`).
- Run `supabase/tests/m0_rls_verification.sql` → expect `ALL RLS CHECKS PASSED`.
- ⚠️ Do not re-run `002` after `005` (it would revert the 50-cap).

---

## M1 — Auth hardening  ✅ code complete

### Implemented in code
- **ACC-6** password policy: min length 12 + HaveIBeenPwned breach check
  (`lib/password.ts`), no composition rules. Enforced in `signupAction` and
  `resetPasswordAction`; client `minLength` bumped to 12.
- **ACC-7** rate limiting: DB-backed fixed-window limiter (`006_m1_rate_limit.sql`
  + `lib/rate-limit.ts`), applied per-IP and per-account to login, signup, and
  password-reset-request. 10 attempts / 60s (`CONFIG.AUTH_RATE_LIMIT_PER_IP_PER_MIN`).
  Fails open on limiter infra error (protection layer, not auth itself).
- **ACC-4** cookie hardening: `Secure` + `SameSite=Lax` + `Path=/` on all SSR
  clients (`lib/supabase/cookie-options.ts`). See HttpOnly note below.

### Manual dashboard steps (required to fully satisfy ACC-1, ACC-3)
In **Supabase → Authentication → settings**:
1. **Confirm email = ON** (ACC-1: email verification required before active).
2. **Email OTP / link expiry = 3600s (1 hour)** (ACC-3: reset links expire ≤ 1h).
   Supabase reset links are already single-use (PKCE code exchange).
3. **Leaked password protection = ON** (defense in depth alongside our in-app
   HIBP check in `lib/password.ts`).
4. Minimum password length: set to **12** to match the app (optional; the app
   enforces it server-side regardless).

### Known limitation (ACC-4 HttpOnly)
`@supabase/ssr`'s browser client reads the auth cookie via `document.cookie`, so
the session cookies cannot be `HttpOnly` without breaking client-side auth.
`Secure` + `SameSite=Lax` are applied (the PRD's explicit clause). Full HttpOnly
would require server-only session reads (dropping the browser client) — deferred
beyond M1.

### How to verify rate limiting
After applying `006`, hammer an auth action > 10x in a minute from one IP/email;
the 11th returns "Too many attempts. Please wait a minute and try again."
Inspect `select * from auth_rate_limits;` to see the buckets.

---

## M2 — Payment integrity  ✅ code complete

### Implemented
- **`fulfill_order()` Postgres function** (`007_m2_fulfill_order.sql`): the whole
  §3.5 algorithm in ONE transaction — webhook dedup (`processed_webhook_events`),
  find/complete the order, atomic capped member number, founding +$30 grant (once),
  checkout redemption, promo redeem + founder status, referral credit, complete
  order, recompute cache. Fails closed (any error rolls back the lot).
- **`lib/order-fulfillment.ts`** is now a thin wrapper over the RPC; the
  confirmation email sends after commit and only when the order actually
  completed (no duplicate emails on retries).
- **Webhook** (`app/api/stripe/webhook/route.ts`): passes `event.id`/`event.type`
  for dedup and reads money fields from the server-stored order, not PI metadata
  (PAY-1). Signature verify + type assertion already present (PAY-2, PAY-5).
- **payment-intent route**: sold-out pre-check (FM-4, 409), creates the **pending
  order at PI creation** (LED-1), free zarathustra path goes through the shared
  function (PAY-7).
- **Execution hardening**: EXECUTE on `fulfill_order`, `assign_member_number`,
  `redeem_promo_code`, `check_rate_limit` revoked from anon/authenticated →
  `service_role` only (closes a direct-RPC free-spot exploit).

### Manual / operational (PAY-6)
In the **Stripe Dashboard → Webhooks**, the endpoint must send
`payment_intent.succeeded` and NOT `checkout.session.completed`. Edit the existing
endpoint (preserves `STRIPE_WEBHOOK_SECRET`). If skipped, payments succeed but
nothing fulfills.

### Boundary with M3 (intentional overlap)
`fulfill_order` already writes the `credit_events` ledger and maintains the
`users.credit_balance` cache (in DOLLARS). Still owned by **M3**: $45 ceiling
enforcement, atomic referral cap + anti-self-referral CHECK, promo-cap edge
hardening, switching checkout credit application + account reads to ledger-derived
**cents**, and reconciling the cache units.

---

## M3 — Balance & referral correctness  ✅ code complete

### Implemented
- **`008_m3_balance_referral.sql`**:
  - `enforce_credit_invariants()` BEFORE INSERT trigger on `credit_events`:
    **$45 ceiling** (BAL-6) on founding+referral grants, and **no-negative
    balance** (BAL-4) on spends. `reconciliation_adjust` is exempt (correction
    escape hatch).
  - **anti self-referral CHECK** on `referrals` (REF-6).
  - `recompute_credit_balance(user_id)` (cents-authoritative; cache in dollars),
    locked to `service_role`. Used by M5 reconciliation.
  - conservative ledger backfill (only users who already have credit_events).
- **Ledger-derived reads (BAL-2)**: account page, checkout page, and
  payment-intent now read balance via `available_balance()` (SUM of
  `credit_events`, cents) instead of the cache column.
- Fixed a latent bug: `checkout/page.tsx` read `member_sequence.next_val`
  (wrong column) → now `next_number`.
- **`supabase/tests/m3_invariants.sql`** proves ceiling, floor, self-referral
  rejection, reconciliation bypass, and recompute.

### Already-atomic (verified, no change needed)
- **REF-5** referral cap of 3 and **REF-7** idempotency: enforced in
  `fulfill_order` (referrer row `FOR UPDATE` + `UNIQUE(referrer_id,referred_id)`
  + partial-unique referral grant per order).
- **PROMO-2** promo cap of 10: `redeem_promo_code` uses a single gated atomic
  `UPDATE ... WHERE use_count < max_uses` (race-free).

### Deferred (concessions pass)
The `users.credit_balance` cache stays in **dollars** while the authoritative
ledger/`available_balance` is in **cents**. Unifying the cache column to cents
(and simplifying the `/100` formatting at read sites) is left for the final
concessions cleanup, per the agreed "defer concessions to the end".

---

## M4 — Account experience  ✅ code complete
- Purchase history (LED-4): account page lists orders (item, date, amount, status)
  from the `orders` ledger, owner-only via RLS.
- Referral conversion display (REF-8): "N of 3 referrals credited — $X earned".
- Styles added to `globals.css` (`.account-orders*`).

## M5 — Reconciliation + observability  ✅ code complete
- **`009_m5_audit_and_reconcile.sql`**: `audit_log` table + `detect_balance_drift()`.
- **`lib/audit.ts`**: structured audit logging (DB row + console line), no sensitive
  data; wired into fulfillment and login success/failure (NF-6).
- **`lib/errors.ts`** + `app/error.tsx` + `app/global-error.tsx`: generic error
  responses/boundaries, no stack traces to the client (NF-7).
- **`app/api/cron/reconcile/route.ts`** (REC-1..REC-4): CRON_SECRET-guarded;
  expires stale pending orders (REC-3), fulfills Stripe-succeeded PIs missing a
  completed order (REC-1), corrects balance drift from the ledger + alerts (REC-2),
  idempotent (REC-4).
- **`vercel.json`**: hourly cron for `/api/cron/reconcile`.
- **`.env.example`**: documents all env vars incl. new `CRON_SECRET`.

### Manual / operational
- Set **`CRON_SECRET`** in Vercel env (and `.env.local`); Vercel Cron must send
  `Authorization: Bearer $CRON_SECRET`.
- Reconciliation scheduling (PRD §12.5): Vercel Cron chosen. Adjust `vercel.json`
  schedule if a different cadence is desired.

---

## M6 — Front-end integration  ✅ code complete
- **Landing** (`/`), **About** (`/about`), **Support** (`/support`) ported from
  `design-truth/` — faithful static markup (`app/(site)/_markup/*`, generated from
  the design HTML) injected with the design CSS (`app/(site)/chariot.css` +
  page CSS) and behaviors ported to `app/(site)/SiteScripts.tsx`. Route-scoped CSS
  (App Router code-splits), so the auth/account/checkout design is untouched.
- **CTAs wired**: checkout → `/checkout`, login → `/login`, About/Support/account
  → their routes; archive (out of scope) → `#`.
- **Funnel consistency (NF-8)**: landing spots-claimed reads live DB (force-dynamic).
- **EMAIL-1**: single transactional sender `no-reply@chariotarchive.com`
  (`lib/email.ts` + `CONFIG.TRANSACTIONAL_FROM`).
- `next build` passes (17 routes).

### Manual / operational (EMAIL-2/-3, §12)
- DNS for `chariotarchive.com`: SPF/DKIM/DMARC + Supabase custom SMTP (Resend),
  sender `no-reply@chariotarchive.com`, Chariot-voice templates.

### M6 concessions (carried into the concessions pass)
1. `login` / `account` / `checkout` pages still use the **existing JSX design**, not
   the design-truth HTML — they are tightly coupled to auth/Stripe logic, so a blind
   visual rebuild was deferred to the resolution pass (preserve logic, restyle).
2. Static port uses `dangerouslySetInnerHTML` (controlled content, no user input) +
   plain `<img>` rather than `next/image`; ~70MB of unoptimized images copied to
   `public/`. Image optimization deferred.
3. Orphaned after the landing swap: `app/LandingNav.tsx`, `app/landing.css`.
4. No browser visual QA possible in this environment — user should eyeball the
   ported pages.

---

## Concessions resolution pass  ✅ (after M6)

| # | Concession (milestone) | Resolution |
|---|------------------------|------------|
| ACC-4 HttpOnly (M1) | session cookies weren't HttpOnly | **Resolved.** Browser Supabase client is unused (session read server-side only), so `httpOnly: true` was added to `SUPABASE_COOKIE_OPTIONS`. Dead `lib/supabase/client.ts` removed. |
| Cache units (M2/M3) | `credit_balance` in dollars vs PRD cents | **Resolved.** `fulfill_order`/`recompute_credit_balance`/`detect_balance_drift` (007–009, not yet applied) + backfill now keep the cache in **cents** (= `SUM(credit_events)`). Email/account divide by 100 for display. |
| referred_by type (M0) | `text` (code) vs PRD `uuid` | **Resolved.** `010_concession_referred_by_uuid.sql` converts the column (resolving codes→ids); signup resolves code→referrer id; `fulfill_order` looks up by id. Link still carries only the code (REF-2). |
| Orphans (M6) | `LandingNav.tsx`, `landing.css` unused | **Resolved.** Removed (plus `account/SignOutButton.tsx`, `account/CopyButton.tsx`). |
| Login/account/checkout (M6) | not on design-truth | **Resolved.** `account` ported to the design (real data); `login`/`signup` + `forgot`/`reset`/`verify` restyled to the design auth layout (OAuth omitted per §8); **checkout was already built on the design-truth `co-*` system** (no change needed). |
| Image optimization (M6) | ~70MB unoptimized in `public/` | **Accepted tradeoff.** Faithful static port uses `<img>`; converting to `next/image` isn't compatible with the injected-HTML approach. Documented; can be optimized later by compressing the `public/lib/*` hero images (each ~10–15MB). |

### Operational concessions — require you (cannot be resolved in code)
- Apply migrations `004`–`010` to Supabase; run the `supabase/tests/*.sql` against the live DB.
- Supabase dashboard: confirm-email ON, reset link expiry 1h, leaked-password protection ON.
- Stripe dashboard: webhook event = `payment_intent.succeeded` (PAY-6).
- DNS: SPF/DKIM/DMARC + custom SMTP for `no-reply@chariotarchive.com` (EMAIL-2/-3).
- Set `CRON_SECRET` in Vercel.
- Browser visual QA of all ported pages (no browser in this environment).
