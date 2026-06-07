> **For Claude Code:** This PRD is the single source of truth for the Chariot backend. This is **not a greenfield build** — there is an existing Next.js + Supabase + Stripe codebase (repo `drop0site`) with a working but incomplete backend. Implement in milestone order (M0 → M6); each milestone is a self-contained, runnable unit. Do not invent scope beyond what's specified. The single most important structural change is introducing an **append-only order ledger** and a **webhook-event dedup table**, and deriving store-credit balance from the ledger rather than mutating a single column — sections 3.2, 3.3, and 4 cover this. If a section is ambiguous, raise it as a question rather than silently deciding. The Resolved Decisions table (§9) captures *why* things are the way they are — consult it before changing settled choices. Security requirements are mapped to OWASP Top 10 (2025) categories and OWASP ASVS 4.0.3 control IDs; treat the ASVS-cited rows as acceptance criteria, not suggestions.

# Chariot — Backend Product Requirements Document

**Version:** 1.0
**Last Updated:** June 6, 2026
**Status:** Draft

---

## 1. Overview

Chariot Archive is a cross-border commerce platform that imports independent international fashion brands (initially Ghana-based 1NRI and Jireh) to U.S. customers through a scarcity-based "drop" model. **Drop 0** is the first launch: a $20 digital "Founding Member" purchase that grants the buyer a permanent founding number (#001–#050), a $30 store credi tusable on Drop 1, and 24-hour early access to all future drops, for life.

This PRD specifies the **backend** that powers the account and commerce experience and the integration of that backend with the existing front-end. The front-end design (the marketing/landing surface) is provided separately by the team (see §12). The backend's job is to make the account experience as smooth and predictable as any mainstream e-commerce site: a customer can create an account, buy the Founding Member spot, always see their purchase and their balance, refer friends and watch credit accrue, and redeem a promo code — with every one of those operations being durable, idempotent, and correct under failure.

The animating principle is **fail-closed durability of money and identity.** A member number must be assigned exactly once and never reissued. A balance must never be silently lost. A purchase must always be recoverable. The system achieves this by treating purchases as **append-only ledger events** and deriving mutable state (balance, founder status, member number) from those events, rather than mutating columns in place and hoping nothing goes wrong.

**Platform:** Web application (responsive, mobile-first). **Environment:** Next.js 14 App Router on Node 18+, deployed to Vercel. **Persistence:** Supabase (managed Postgres) as the system of record; Stripe as the payment processor and secondary source of truth for payment events; Resend for transactional email. **Global constraints:** All money math is computed server-side only; the client never sets an amount. All authorization is enforced at the database layer (Postgres Row Level Security) in addition to the application layer.

---

## 2. Glossary

| Term | Definition |
|------|-----------|
| **Drop** | A time-boxed, limited release of products. Drop 0 is the Founding Member pre-sale; Drop 1 is the first apparel drop (July 2026). |
| **Founding Member spot** | The single digital product sold in Drop 0. Price $20. Grants a member number, $30 store credit, founder status, and lifetime early access. |
| **Member number** | A permanent integer 1–50 (displayed `#001`–`#050`) assigned to a buyer in the order purchases complete. Never reissued, never skipped. |
| **Store credit** | A dollar balance attached to an account, applied at checkout on a future order. Base $30 from the Founding Member spot, plus up to $15 from referrals. |
| **Order** | A single completed (or attempted) purchase, recorded as an immutable row in the order ledger. The unit the account "remembers." |
| **Order ledger** | The append-only `orders` table. The authoritative record of what was bought; the basis from which balances are reconciled. |
| **Credit ledger** | The append-only `credit_events` table recording every grant or spend of store credit. Balance = sum of credit events. |
| **Fulfillment** | The set of post-payment side effects: assign member number, write credit events, set founder status, credit referrer, send confirmation email. Encapsulated in one shared function, `fulfillOrder`. |
| **Idempotency** | The property that repeating an operation (e.g., a retried Stripe webhook) produces the same end state as performing it once. |
| **PaymentIntent (PI)** | The Stripe object representing an attempt to collect payment. Chariot uses embedded PaymentIntents + the Payment Element (on-site), not hosted Checkout Sessions. |
| **Webhook event dedup** | The `processed_webhook_events` table that records each Stripe `event.id` already handled, so retries are ignored. |
| **Referral code** | A unique, public, non-guessable string on each account. The only identifier exposed in a referral link. |
| **zarathustra** | A promo code granting a free Founding Member spot (founder status + $30 credit), capped at 10 total redemptions. |
| **RLS** | Postgres Row Level Security — per-row authorization enforced by the database itself, independent of application code. |
| **Reconciliation** | A scheduled job that compares Stripe's record of succeeded payments against the order ledger and repairs any drift (e.g., a fulfillment that never ran). |
| **Service role key** | The Supabase secret that bypasses RLS. Server-only. Must never reach the browser. |

---

## 3. Feature Requirements

### 3.1 Accounts & Identity

#### Description
User accounts backed by Supabase Auth (email + password). An account is the durable home for a customer's member number, balance, purchase history, and referral data. Accounts must verify email, support password reset, and persist sessions across visits.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| ACC-1 | A visitor can create an account with email + password. Email verification is required before the account is considered active. | ⏳ Not implemented |
| ACC-2 | Account creation requires an explicit Terms & Conditions agreement; the agreement timestamp is stored as `users.tc_agreed_at`. The form cannot submit without it. | ✅ Exists (verify) |
| ACC-3 | A user can log in, log out, and reset a forgotten password via emailed link. Reset links are single-use and expire within 1 hour. | ⏳ Not implemented |
| ACC-4 | Sessions persist across page refreshes and return visits via secure, HttpOnly cookies. Session cookies are `Secure` and `SameSite=Lax` or stricter. | ⏳ Not implemented |
| ACC-5 | On signup the account is issued a unique, non-guessable `referral_code` (see 3.6). | ✅ Exists (verify) |
| ACC-6 | Passwords are validated against a minimum length (≥ 12 chars) and checked against a known-breached-password list; arbitrary composition rules (forced symbols) are NOT imposed. (NIST SP 800-63B; ASVS 2.1.1, 2.1.7) | ⏳ Not implemented |
| ACC-7 | Authentication endpoints (login, signup, password reset request) are rate-limited per IP and per account to resist brute force and credential stuffing. (ASVS 11.1.4) | ⏳ Not implemented |
| ACC-8 | A user can view and close their own account. Closing an account does not delete order-ledger history (financial records are retained), but may forfeit unspent credit per the T&C. | ⏳ Not implemented |

---

### 3.2 Order Ledger & Purchase History

#### Description
The structural keystone of this PRD. Every purchase attempt that reaches Stripe — and every completed purchase — is recorded as an immutable row in the `orders` table. This is what the account "remembers." Without it, balances have nothing to reconcile against and purchases cannot be displayed or audited. **This table does not exist in the current codebase and must be created in M0.**

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| LED-1 | An `orders` row is created at PaymentIntent creation time with status `pending`, linked to the buyer via `user_id`, recording amount, items, applied credit, and promo code. | ⏳ Not implemented |
| LED-2 | On successful fulfillment the order's status transitions to `completed`; on failure/cancellation it transitions to `failed` or `canceled`. Orders are never deleted. | ⏳ Not implemented |
| LED-3 | Every order stores its originating `stripe_payment_intent_id` (unique), enabling exact reconciliation against Stripe. For zarathustra free orders, this is null and `source = 'promo_zarathustra'`. | ⏳ Not implemented |
| LED-4 | The account page displays the user's complete purchase history (date, item, amount paid, status) read from the order ledger. | ⏳ Not implemented |
| LED-5 | The order ledger is the authoritative record of purchases; no purchase exists without a corresponding `orders` row. | ⏳ Not implemented |

#### Order State Transitions
```
pending ──(payment_intent.succeeded, fulfillment ok)──▶ completed
pending ──(payment fails / abandoned)──────────────────▶ failed
pending ──(user/admin cancels before capture)──────────▶ canceled
```
Only `pending → completed` triggers fulfillment side effects. Reaching `completed` is idempotent: re-processing the same PI does not re-run side effects (see 3.5).

---

### 3.3 Store Credit & Balance

#### Description
Store credit is recorded as an append-only series of credit events; the displayed balance is their sum. This makes the balance reconcilable and impossible to silently lose by an errant overwrite. The previous design — a single mutable `credit_balance` column updated by read-modify-write — is replaced. (`credit_balance` MAY be retained as a denormalized cache, but only if it is recomputed from `credit_events`, never trusted as the source of truth.)

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| BAL-1 | Every grant or spend of store credit is recorded as an immutable `credit_events` row (positive for grants, negative for spends) with a reason and a link to the originating order. | ⏳ Not implemented |
| BAL-2 | A user's available balance is computed as `SUM(credit_events.amount_cents)` for that user. The account page displays this value. | ⏳ Not implemented |
| BAL-3 | The $30 Founding Member credit is granted exactly once, as a single `credit_events` row tied to the completing order. Idempotent: re-processing the order does not grant it twice. | ⏳ Not implemented |
| BAL-4 | Applying credit at checkout records a negative `credit_events` row equal to the credit consumed; available balance can never go below zero. | ⏳ Not implemented |
| BAL-5 | Credit math (how much credit applies to a given order) is computed server-side only. The client never submits a credit amount or a price. (OWASP A08; ASVS 4.1.2) | ⏳ Not implemented |
| BAL-6 | The total credit ceiling per account is enforced: $30 base + $15 referral max = $45. No sequence of events can exceed it. | ⏳ Not implemented |

#### Balance Reconciliation Rule
The displayed/denormalized balance must always equal `SUM(credit_events.amount_cents)`. A scheduled reconciliation (see 3.9) recomputes and corrects any denormalized `users.credit_balance` that has drifted from the ledger sum, and logs the drift as an alertable event.

---

### 3.4 Founding Member Numbering

#### Description
Each completed Founding Member purchase is assigned the next sequential integer 1–50. Numbers are permanent, never reissued, never skipped, and assignment is safe under concurrency (two simultaneous purchases must not collide).

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FM-1 | A member number is assigned to a user exactly once, on the first completed purchase, via an atomic Postgres function (`assign_member_number`) that locks the sequence row. (ASVS 11.1.6 — no TOCTOU/race) | ✅ Exists (verify atomicity) |
| FM-2 | Member numbers are assigned strictly sequentially with no gaps under normal operation; concurrent purchases receive distinct consecutive numbers. | ⏳ Verify |
| FM-3 | A member number, once assigned, is never changed or reused, even if the order is later refunded. (Refund policy on the number is a business decision — default: number is retained.) | ⏳ Verify |
| FM-4 | When all 50 numbers are assigned, further purchases are refused at the API layer with a clear "sold out" response before any charge is attempted. | ⏳ Not implemented |
| FM-5 | The number is displayed to the user (account page, confirmation email, success screen) formatted as `#001`–`#050`. | ✅ Exists (verify) |

#### Member Number Assignment Algorithm
```
BEGIN (DB transaction)
  SELECT next_val FROM member_sequence FOR UPDATE;        -- row lock
  IF next_val > 50 THEN RAISE 'sold_out'; END IF;
  assigned := next_val;
  UPDATE member_sequence SET next_val = next_val + 1;
  UPDATE users SET member_number = assigned WHERE id = p_user_id
    AND member_number IS NULL;                            -- idempotent guard
COMMIT
RETURN assigned (or existing member_number if already set)
```
If the user already has a `member_number`, the function returns it without consuming a new sequence value (idempotency for retried webhooks).

---

### 3.5 Payment Processing & Webhook Integrity

#### Description
Payments use embedded Stripe PaymentIntents + the Payment Element (customer stays on-site). The webhook listening for `payment_intent.succeeded` is the single trigger for fulfillment of paid orders. This is the highest-risk surface in the system: it must verify authenticity, tolerate retries, fail closed, and never double-apply.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| PAY-1 | The PaymentIntent amount is computed server-side from the Drop 0 price minus server-validated credit/promo. The client cannot influence the charged amount. (OWASP A08; ASVS 4.1.2) | ✅ Exists (verify) |
| PAY-2 | The webhook verifies the Stripe signature on every request using `STRIPE_WEBHOOK_SECRET` and rejects any unsigned or invalid request with 400. (OWASP A08) | ✅ Exists (verify) |
| PAY-3 | The webhook records each handled `event.id` in `processed_webhook_events`. If an event ID has already been processed, it returns 200 immediately without re-running fulfillment. (OWASP A10; ASVS 11.1.6) | ⏳ Not implemented |
| PAY-4 | Fulfillment (member number, credit events, founder status, referral credit, email) runs inside a single database transaction and is encapsulated in one shared function, `fulfillOrder`, called by both the webhook and the zarathustra free path. If any step fails, the transaction rolls back and the webhook returns non-200 so Stripe retries. (OWASP A10 — fail closed, roll back incomplete transactions) | ⏳ Partially exists (verify transaction boundary) |
| PAY-5 | The webhook asserts the event type is `payment_intent.succeeded`; any other event type returns 200 and is ignored. | ✅ Exists (verify) |
| PAY-6 | The Stripe Dashboard webhook endpoint is configured to send `payment_intent.succeeded` and NOT `checkout.session.completed`. (Operational — see §12.) | ⚠️ Manual step |
| PAY-7 | The zarathustra free path ($0) bypasses Stripe entirely, calling `fulfillOrder` directly in the API route, and creates an order with `source = 'promo_zarathustra'`. | ✅ Exists (verify it calls the shared function) |
| PAY-8 | Confirmation email failure is non-fatal: it is logged and retried, but does not roll back fulfillment or fail the webhook. (Money/identity state must commit even if email is down.) | ✅ Exists (verify) |

#### Idempotent Fulfillment Algorithm (`fulfillOrder`)
```
BEGIN (DB transaction)
  IF event.id already in processed_webhook_events THEN RETURN ok; END IF;   -- dedup
  INSERT event.id INTO processed_webhook_events;

  order := find order by stripe_payment_intent_id (or create for free path);
  IF order.status == 'completed' THEN RETURN ok; END IF;                    -- idempotent

  member_number := assign_member_number(user_id);          -- atomic, idempotent (3.4)

  IF first purchase THEN
    INSERT credit_events(+3000, reason='founding_member_grant', order_id);  -- once
  END IF;
  IF credit applied at checkout THEN
    INSERT credit_events(-applied, reason='checkout_redemption', order_id);
  END IF;
  IF promo == 'zarathustra' THEN
    redeem_promo_code('zarathustra');                       -- atomic cap check (3.7)
    SET users.founder_status = true;
  END IF;
  IF user.referred_by IS NOT NULL AND first purchase THEN
    credit_referrer(user.referred_by, user.id);             -- capped, idempotent (3.6)
  END IF;

  UPDATE orders SET status='completed' WHERE id = order.id;
COMMIT
-- after commit, outside transaction:
send_confirmation_email(...)   -- failure logged + retried, never rolls back
```

---

### 3.6 Referral Program

#### Description
Each account has a unique public referral link. When a referred friend completes a Founding Member purchase, the referrer earns $5 store credit, capped at 3 referrals ($15). Referral credit must attach to the correct account, resist self-referral and gaming, and only pay out on a *completed* purchase.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| REF-1 | Each account has a unique, non-guessable `referral_code`. The referral link is `https://chariotarchive.com/ref/{referral_code}` and resolves on the Chariot domain only. | ✅ Exists (verify code is non-guessable) |
| REF-2 | The referral link carries ONLY the public `referral_code` — never a user ID, email, or other private identifier. (OWASP A01; privacy) | ⏳ Verify |
| REF-3 | When a new user signs up via a referral link, the referrer's identity is stored on the new account as `referred_by` (resolved from the code). | ✅ Exists (verify) |
| REF-4 | Referral credit ($5) is granted to the referrer ONLY when the referred user's first purchase reaches `completed`, recorded as a `credit_events` row and a `referrals` row. | ✅ Exists (verify it keys off completed purchase) |
| REF-5 | A maximum of 3 referrals per account are credited ($15 max). The 4th and beyond record the referral relationship but grant no credit. (ASVS 11.1.3) | ✅ Exists (verify cap is enforced atomically) |
| REF-6 | Self-referral is rejected (a user cannot be credited for referring themselves; the same email/account cannot be both referrer and referred). | ⏳ Not implemented |
| REF-7 | Referral crediting is idempotent: a retried webhook does not double-credit. Enforced by a unique constraint on `(referrer_id, referred_id)` and a `credited` flag. | ✅ Exists (verify) |
| REF-8 | The account page shows the user's referral link and how many of their 3 referrals have converted, with the resulting credit. | ⏳ Not implemented |

---

### 3.7 Promo Codes

#### Description
Promo codes are server-validated and use-limited. `zarathustra` grants a free Founding Member spot (founder status + $30 credit) and is capped at 10 total redemptions. Caps must hold under concurrency.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| PROMO-1 | Promo codes are validated server-side; the client never determines validity or discount. (OWASP A08) | ✅ Exists (verify) |
| PROMO-2 | `zarathustra` is capped at 10 redemptions. The cap is enforced by an atomic Postgres function (`redeem_promo_code`) that locks the promo row and rejects the 11th. (ASVS 11.1.3, 11.1.6) | ⏳ Verify atomicity |
| PROMO-3 | A lightweight validation endpoint lets the checkout "Apply" button check a code against the DB before payment, with no side effects (read-only). | ✅ Exists (verify read-only) |
| PROMO-4 | Promo redemption is recorded transactionally as part of `fulfillOrder`; a failed fulfillment does not consume a redemption. | ⏳ Verify |
| PROMO-5 | Codes are case-insensitive on input, non-transferable, and cannot be combined with other discounts unless explicitly configured. | ⏳ Verify |

#### Promo Redemption Algorithm (`redeem_promo_code`)
```
BEGIN (DB transaction)
  SELECT use_count, max_uses, active FROM promo_codes WHERE code = p_code FOR UPDATE;
  IF NOT active OR use_count >= max_uses THEN RETURN false; END IF;
  UPDATE promo_codes SET use_count = use_count + 1 WHERE code = p_code;
COMMIT
RETURN true
```

---

### 3.8 Access Control & Privacy

#### Description
Every read and write is authorized at the database layer (RLS) as well as the application layer. A user can only ever see or modify their own data. This directly addresses the "private link is actually public" failure mode.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| AC-1 | Row Level Security is enabled on every table containing user data, default-deny, with explicit policies granting a user access only to rows they own. (OWASP A01; ASVS 4.1.1, 4.1.3) | ⏳ Not implemented |
| AC-2 | All primary keys for user-facing records (users, orders) are UUIDs, not sequential integers, to prevent enumeration/IDOR. (ASVS 4.2.1) | ⏳ Verify |
| AC-3 | Every API route and Server Action authenticates the caller as its first action and returns 401 if there is no valid session. Server Actions are treated as public endpoints. (OWASP A01; ASVS 4.1.1) | ⏳ Verify all routes |
| AC-4 | No private identifier (user ID, email, session token) ever appears in a URL, query string, or referral link. (Privacy; ASVS 8.3.x) | ⏳ Verify |
| AC-5 | The Supabase service-role key is used only in server-side code (webhooks, admin queries) and is never bundled into client JavaScript. Only `NEXT_PUBLIC_`-prefixed env vars reach the browser. (OWASP A02) | ⏳ Verify |
| AC-6 | Access controls fail securely: if an authorization check errors, access is denied, not granted. (ASVS 4.1.5) | ⏳ Verify |
| AC-7 | An automated test verifies that an anonymous (logged-out) client and a different logged-in user both receive zero rows when querying another user's account, orders, and credit data. (RLS verification) | ⏳ Not implemented |

---

### 3.9 Reconciliation & Recovery

#### Description
A safety net for the cases where the happy path doesn't complete: a webhook never arrives, fulfillment partially failed, or a denormalized balance drifted. Addresses the "webhook doesn't fire" and "balance doesn't get saved" failure modes.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| REC-1 | A scheduled job queries Stripe for `payment_intent.succeeded` payments in the last N hours and verifies each has a corresponding `completed` order; any missing fulfillment is completed via `fulfillOrder`. (OWASP A10) | ⏳ Not implemented |
| REC-2 | The job recomputes each affected user's denormalized balance from `credit_events` and corrects drift, logging any correction as an alertable event. | ⏳ Not implemented |
| REC-3 | A `pending` order older than a configurable timeout with no successful payment is transitioned to `failed`. | ⏳ Not implemented |
| REC-4 | Reconciliation is itself idempotent and safe to run repeatedly. | ⏳ Not implemented |

---

### 3.10 Transactional Email

#### Description
Verification, password-reset, and order-confirmation emails must arrive reliably, from a single consistent sender, in the brand voice.

#### Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| EMAIL-1 | All transactional email sends from a single sender address, `no-reply@chariotarchive.com`, across Supabase auth emails and Resend order emails. | ⏳ Not implemented (currently split orders@ / supabase default) |
| EMAIL-2 | The sending domain has valid SPF, DKIM, and DMARC records so mail authenticates and avoids spam. (Operational — DNS access required, see §12.) | ⚠️ Manual / blocked on DNS |
| EMAIL-3 | Supabase auth emails (confirm signup, reset password, email change) route through custom SMTP (Resend) and use Chariot-voice templates: calm, no exclamation marks. | ⏳ Not implemented |
| EMAIL-4 | The order confirmation email includes member number, founder status, store-credit balance, and the user's referral link, and fires from the webhook (not the client). | ✅ Exists (verify sender address) |
| EMAIL-5 | Email send failures are logged and retried; they never block or roll back fulfillment. | ✅ Exists (verify) |

---

## 4. Data Model

```sql
-- ─────────────────────────────────────────────────────────────
-- users  (extends Supabase auth.users; one row per account)
-- ─────────────────────────────────────────────────────────────
users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id),
  email           text NOT NULL,
  member_number   int  UNIQUE,                 -- NULL until first completed purchase; 1..50
  credit_balance  int  NOT NULL DEFAULT 0,     -- DENORMALIZED CACHE in cents; = SUM(credit_events). Never source of truth.
  referral_code   text NOT NULL UNIQUE,        -- public, non-guessable (e.g., 10+ random chars)
  referred_by     uuid REFERENCES users(id),   -- the referrer, resolved from referral_code at signup
  founder_status  boolean NOT NULL DEFAULT false,
  tc_agreed_at    timestamptz,                 -- T&C agreement timestamp; required at signup
  created_at      timestamptz NOT NULL DEFAULT now()
)

-- ─────────────────────────────────────────────────────────────
-- orders  (APPEND-ONLY order ledger — NEW; the keystone table)
-- ─────────────────────────────────────────────────────────────
orders (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES users(id),
  status                   order_status NOT NULL DEFAULT 'pending',
  amount_charged_cents     int  NOT NULL,       -- what Stripe actually charged (after credit/promo)
  list_price_cents         int  NOT NULL,       -- the Drop 0 price before discounts (2000)
  credit_applied_cents     int  NOT NULL DEFAULT 0,
  promo_code               text,                -- e.g., 'zarathustra' or NULL
  source                   order_source NOT NULL DEFAULT 'stripe',
  stripe_payment_intent_id text UNIQUE,         -- NULL for free (promo) orders
  items                    jsonb NOT NULL,      -- [{ sku:'founding-member', qty:1 }]
  created_at               timestamptz NOT NULL DEFAULT now(),
  completed_at             timestamptz
)
enum order_status  { 'pending', 'completed', 'failed', 'canceled' }
enum order_source  { 'stripe', 'promo_zarathustra' }

-- ─────────────────────────────────────────────────────────────
-- credit_events  (APPEND-ONLY credit ledger — NEW)
-- balance = SUM(amount_cents) per user
-- ─────────────────────────────────────────────────────────────
credit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  amount_cents  int  NOT NULL,                  -- positive = grant, negative = spend
  reason        credit_reason NOT NULL,
  order_id      uuid REFERENCES orders(id),     -- the order that caused this event
  created_at    timestamptz NOT NULL DEFAULT now()
)
enum credit_reason {
  'founding_member_grant',   -- +3000 once, on first completed purchase
  'referral_grant',          -- +500 per converted referral (max 3)
  'checkout_redemption',     -- negative, credit spent at checkout
  'reconciliation_adjust'    -- manual/automated correction
}

-- ─────────────────────────────────────────────────────────────
-- member_sequence  (single row; atomic source of member numbers)
-- ─────────────────────────────────────────────────────────────
member_sequence (
  id        int PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- enforce single row
  next_val  int NOT NULL DEFAULT 1                       -- next number to assign; max 50
)

-- ─────────────────────────────────────────────────────────────
-- referrals  (one row per referral relationship)
-- ─────────────────────────────────────────────────────────────
referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES users(id),
  referred_id  uuid NOT NULL REFERENCES users(id),
  credited     boolean NOT NULL DEFAULT false,  -- did the $5 grant fire?
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_id),            -- idempotency + anti-double-credit
  CHECK  (referrer_id <> referred_id)           -- anti self-referral
)

-- ─────────────────────────────────────────────────────────────
-- promo_codes
-- ─────────────────────────────────────────────────────────────
promo_codes (
  code       text PRIMARY KEY,                  -- 'zarathustra'
  max_uses   int  NOT NULL,                     -- 10
  use_count  int  NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  kind       promo_kind NOT NULL                -- determines effect
)
enum promo_kind { 'free_founding_spot', 'amount_off', 'percent_off' }

-- ─────────────────────────────────────────────────────────────
-- processed_webhook_events  (idempotency ledger — NEW)
-- ─────────────────────────────────────────────────────────────
processed_webhook_events (
  event_id     text PRIMARY KEY,                -- Stripe event.id
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
)
```

**Relationships:** `users 1—N orders`, `users 1—N credit_events`, `orders 1—N credit_events`, `users 1—N referrals` (as referrer), `member_sequence` is a singleton. Balance is derived: `available_balance(user) = SELECT COALESCE(SUM(amount_cents),0) FROM credit_events WHERE user_id = user`.

---

## 5. Persistence Schema

All persistence is in Supabase (managed Postgres). The tables in §4 constitute the schema. Key constraints and indexes:

| Object | Detail |
|--------|--------|
| `orders.stripe_payment_intent_id` | UNIQUE — guarantees one order per PI; basis of reconciliation. |
| `processed_webhook_events.event_id` | PRIMARY KEY — the webhook dedup guard. |
| `referrals (referrer_id, referred_id)` | UNIQUE — prevents double-crediting a referral. |
| `referrals` CHECK `referrer_id <> referred_id` | Anti self-referral at the DB layer. |
| `users.member_number` | UNIQUE — no two accounts share a number. |
| `member_sequence` single-row CHECK | Guarantees one source of truth for numbering. |
| Index on `orders.user_id`, `credit_events.user_id` | Fast purchase-history and balance reads. |
| RLS policies on `users`, `orders`, `credit_events`, `referrals` | Default-deny; owner-only SELECT/UPDATE. Server (service role) bypasses for webhook/reconciliation writes. |

Postgres functions (server-side, SECURITY DEFINER where needed): `assign_member_number(user_id)` (§3.4), `redeem_promo_code(code)` (§3.7), `available_balance(user_id)`.

---

## 6. Configuration Constants

```javascript
const CONFIG = {
  // Pricing (server-authoritative; client never sets amounts)
  DROP0_PRICE_CENTS: 2000,            // $20.00 Founding Member spot
  FOUNDING_MEMBER_CREDIT_CENTS: 3000, // $30.00 store credit grant
  REFERRAL_CREDIT_CENTS: 500,         // $5.00 per converted referral
  MAX_REFERRALS_CREDITED: 3,          // → $15.00 referral ceiling
  CREDIT_CEILING_CENTS: 4500,         // $45.00 total per account ($30 + $15)

  // Founding Member supply
  TOTAL_FOUNDING_SPOTS: 50,

  // Promo
  ZARATHUSTRA_MAX_USES: 10,

  // Auth / security
  MIN_PASSWORD_LENGTH: 12,            // NIST 800-63B; no forced composition rules
  RESET_TOKEN_TTL_MINUTES: 60,
  AUTH_RATE_LIMIT_PER_IP_PER_MIN: 10, // login/signup/reset attempts

  // Reconciliation
  RECONCILE_LOOKBACK_HOURS: 24,
  PENDING_ORDER_TIMEOUT_MINUTES: 60,  // pending → failed after this

  // Email
  TRANSACTIONAL_FROM: 'no-reply@chariotarchive.com',
}
```

---

## 7. Non-Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| NF-1 | **Access control (A01):** RLS default-deny on all user tables; every route authenticates first; least privilege for the service role. (ASVS 4.1.1, 4.1.3, 4.2.1) | ⏳ |
| NF-2 | **Misconfiguration / secrets (A02):** No secret reaches the client bundle; `.env.local` is gitignored; a secret scanner runs in CI. | ⏳ |
| NF-3 | **Supply chain (A03):** Dependencies are pinned; `npm audit` (or SCA) runs in CI; no install scripts from untrusted packages. | ⏳ |
| NF-4 | **Cryptographic / data protection (A04):** All traffic over HTTPS/TLS; passwords hashed by Supabase; no sensitive data in logs or URLs. (ASVS 9.1, 8.3) | ⏳ |
| NF-5 | **Data integrity (A08):** Stripe webhook signature verified; all money math server-side; payment amounts never trusted from the client. | ⏳ |
| NF-6 | **Logging & alerting (A09):** Every auditable event (auth success/failure, fulfillment, credit change, promo redemption, reconciliation correction) is logged without sensitive data; webhook and reconciliation failures raise alerts. (ASVS 7.1) | ⏳ |
| NF-7 | **Exceptional conditions (A10):** Fulfillment is transactional and fails closed (rolls back); webhooks and fulfillment are idempotent; no TOCTOU on member numbers or promo caps; a global error handler returns generic messages (no stack traces / internals to the client). (ASVS 11.1.6, 7.4) | ⏳ |
| NF-8 | **Consistency:** After a write that changes balance/number, the user's next read reflects it (read-from-primary or poll-until-consistent); the landing-page spots-remaining, checkout price, and DB never visibly diverge. | ⏳ |
| NF-9 | **Performance:** Account page and checkout render server-side in < 1s on a typical connection; balance/history reads are indexed. | ⏳ |
| NF-10 | **Responsiveness & accessibility:** Mobile-first; forms keyboard-navigable; inputs labeled; error states announced (aria-live). | ⏳ |
| NF-11 | **Backups:** Supabase point-in-time recovery / daily backups enabled. | ⏳ |

---

## 8. Out of Scope (v1)

- **Physical fulfillment / shipping logic** — Drop 0 is a digital purchase. No inventory, addresses, shipping rates, or carrier integration. (Drop 1 concern.)
- **Multiple products / variants / cart** — Drop 0 sells exactly one digital line item. The order schema is generic enough for future products, but multi-item carts are not built now.
- **Admin dashboard / back office** — No admin UI in v1. Operators use Supabase/Stripe dashboards and the reconciliation job. (No investor or analytics dashboard.)
- **Promo codes beyond zarathustra** — The `promo_codes` table supports more, but only zarathustra is configured for v1.
- **Drop 1 commerce** — Voting, apparel catalog, credit redemption against real garments — all deferred.
- **Social login / OAuth providers / passkeys** — Email + password only for v1 (architecture leaves room to add later).
- **Account-to-account credit transfer or gifting** — Credit is non-transferable.
- **The second/third brand onboarding** — Out of scope.

---

## 9. Resolved Decisions

| # | Question | Resolution |
|---|----------|------------|
| 1 | Hosted Stripe Checkout vs. embedded Payment Element? | **Embedded** Payment Element — keeps customers on-site, matches the brand. Webhook listens for `payment_intent.succeeded`. |
| 2 | How is store-credit balance stored? | **Derived from an append-only `credit_events` ledger.** `users.credit_balance` is at most a recomputed cache, never the source of truth — this is the fix for "balance gets silently lost." |
| 3 | Are purchases recorded as entities? | **Yes — a new `orders` ledger.** Required so the account can "remember purchases" and so balances are reconcilable. This table did not previously exist. |
| 4 | How is the zarathustra $0 path handled? | **In the API route, not through Stripe** — creating a $0 PaymentIntent is unnecessary and adds a failure mode. It calls the same `fulfillOrder` function as the paid path. |
| 5 | One fulfillment code path or two? | **One shared `fulfillOrder` function** called by both the webhook and the free path, so the two cannot drift. |
| 6 | How are member numbers kept unique under concurrency? | **Atomic Postgres function with a row lock** on `member_sequence`; idempotent if the user already has a number. (ASVS 11.1.6) |
| 7 | How are retried/duplicate webhooks handled? | **`processed_webhook_events` dedup table** + idempotent fulfillment; the order's `completed` status is the second guard. |
| 8 | Where is authorization enforced? | **Both layers:** Postgres RLS (default-deny, owner-only) AND an auth check as the first line of every route/Server Action. |
| 9 | What identifier goes in a referral link? | **Only the public `referral_code`** — never a user ID. Primary keys are UUIDs to prevent enumeration. |
| 10 | Single transactional sender address? | **`no-reply@chariotarchive.com`** for all transactional mail (auth + orders), standardizing the current split. |
| 11 | Password policy? | **Length-based (≥12) + breached-password check**, no forced composition rules, per NIST 800-63B. |

---

## 10. Architecture & Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript. Server Components for data-backed pages (account, checkout); Client Components only where interactivity requires it (Stripe Payment Element, forms).
- **Backend:** Next.js Route Handlers (App Router) + server-side functions. No separate backend service.
- **Database:** Supabase (managed Postgres) with Row Level Security. Postgres functions for atomic operations (`assign_member_number`, `redeem_promo_code`, `available_balance`).
- **Payments:** Stripe — PaymentIntents + Stripe.js Payment Element (embedded). Webhook at `/api/stripe/webhook`.
- **Email:** Resend, via API for order confirmation and via SMTP for Supabase auth emails. Single sender `no-reply@chariotarchive.com`.
- **Scheduling:** Vercel Cron (or Supabase scheduled function) for the reconciliation job.
- **Hosting:** Vercel. **Package manager:** npm. **Language:** TypeScript.
- **Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` — server-only. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-safe.

### Module Layout
```
app/
  page.tsx                          # Landing (Red's front-end, ported) — §12
  (auth)/
    login/ signup/ verify-email/
    forgot-password/ reset-password/
  account/page.tsx                  # Dashboard: number, balance, purchase history, referrals
  checkout/
    page.tsx  CheckoutForm.tsx      # Embedded Stripe Payment Element
  ref/[code]/route.ts               # Referral link → /signup?ref=CODE
  auth/callback/route.ts            # Supabase email-verify callback
  api/
    payment-intent/route.ts         # Create PI (server-side amount), zarathustra free path
    payment-intent/validate/route.ts# Read-only promo check for "Apply"
    stripe/webhook/route.ts         # payment_intent.succeeded → fulfillOrder
    cron/reconcile/route.ts         # Reconciliation job (NEW)
lib/
  order-fulfillment.ts              # fulfillOrder (shared by webhook + free path)
  stripe.ts  email.ts
  supabase/server.ts  supabase/admin.ts
supabase/
  migrations/                       # orders, credit_events, processed_webhook_events,
                                    # RLS policies, atomic functions
```

---

## 11. Milestones

| # | Scope | Includes |
|---|---|---|
| M0 | **Schema + RLS foundation** | Create `orders`, `credit_events`, `processed_webhook_events` tables; convert user-facing PKs to UUID; enable RLS default-deny + owner-only policies on all user tables; write the atomic Postgres functions; add the RLS verification test (AC-7). App still runs; no behavior change visible yet. |
| M1 | **Auth hardening** | Email verification, password reset (single-use, 1h), session cookie hardening, password length + breach check, rate limiting on auth endpoints. |
| M2 | **Payment integrity** | Webhook signature verification (confirm), `processed_webhook_events` dedup, write `orders` row at PI creation, wrap `fulfillOrder` in a single DB transaction that fails closed, atomic member-number assignment, $0 zarathustra path through the shared function. |
| M3 | **Balance & referral correctness** | Move balance to `credit_events` (grants/spends), enforce $45 ceiling, atomic referral cap (3) + anti-self-referral + idempotent crediting, atomic promo cap (10). Recompute denormalized `credit_balance` cache. |
| M4 | **Account experience** | Account page: member number, ledger-derived balance, purchase history (LED-4), referral link + conversion count (REF-8). Wire into the front-end (M6 may interleave). |
| M5 | **Reconciliation + observability** | Stripe↔ledger reconciliation cron, pending-order timeout, balance-drift correction + alerting, structured audit logging of all auditable events, generic error handler. |
| M6 | **Front-end integration** | Port Red's Drop 0 front-end design into Next.js pages (HTML → JSX), make it the public surface, wire CTAs to signup/checkout, ensure funnel consistency (spots-remaining/price/DB agree). Standardize transactional email sender; complete DNS/SMTP per §12. |

Each milestone produces something runnable and independently verifiable. M0 produces a running app with the new schema and RLS in place even though no new user-facing behavior appears yet.

---

## 12. Open Questions / Risks

1. **Red's front-end design is not in this PRD.** M6 assumes the design lands in the same repo/context as static HTML/CSS (as prior Chariot front-ends did) and is ported to Next.js pages. Confirm format (static HTML vs. a component library) and whether it replaces the existing ported landing page or extends it.
2. **DNS access for `chariotarchive.com`** is the blocker for EMAIL-2/EMAIL-3 (SPF/DKIM/DMARC + custom SMTP). Until DNS records are added by whoever controls the domain, Supabase auth emails keep coming from the default sender. Not a code blocker; a delivery/polish blocker.
3. **Stripe Dashboard webhook event (PAY-6)** must be set to `payment_intent.succeeded` (and `checkout.session.completed` removed) by editing the existing endpoint — editing preserves `STRIPE_WEBHOOK_SECRET`. If skipped, payments succeed but nothing fulfills. Operational, not code.
4. **Refund policy vs. member number (FM-3):** default is that a refunded buyer keeps their number; confirm this is the business intent before implementing refund handling.
5. **Reconciliation scheduling:** Vercel Cron vs. Supabase scheduled functions — pick based on the chosen hosting plan. Either satisfies REC-1.
6. **Legal review of the T&C** is recommended before accepting real money; outside the scope of this build but on the critical path to launch.
7. **Existing data migration:** if any real accounts/purchases already exist from testing, M0/M3 must backfill `orders` and `credit_events` for them so historical balances reconcile. Confirm whether any production data exists.
