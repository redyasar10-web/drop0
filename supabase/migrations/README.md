# Supabase migrations

Apply in filename order. There is no Supabase CLI config in this repo, so apply
either via the **Supabase dashboard → SQL Editor** (paste each file in order) or
`supabase db push` if you wire up the CLI. All migrations are written to be
**idempotent / safe to re-run**.

| Order | File | Milestone | What it does |
|------:|------|-----------|--------------|
| 1 | `20260531_001_users_table.sql` | pre-M0 | `users`, `member_sequence`, `referrals`, `promo_codes` + base RLS |
| 2 | `002_member_number_rpc.sql` | pre-M0 | `assign_member_number`, `redeem_promo_code` |
| 3 | `003_referrals_unique_constraint.sql` | pre-M0 | UNIQUE(referrer_id, referred_id) |
| 4 | `004_m0_ledger_and_rls.sql` | **M0** | `orders`, `credit_events`, `processed_webhook_events`, enums, default-deny owner-only RLS |
| 5 | `005_m0_functions.sql` | **M0** | `assign_member_number` 50-cap (FM-4), `available_balance` (BAL-2), `promo_codes.kind` |
| 6 | `006_m1_rate_limit.sql` | **M1** | `auth_rate_limits` table + `check_rate_limit()` for auth rate limiting (ACC-7) |
| 7 | `007_m2_fulfill_order.sql` | **M2** | transactional idempotent `fulfill_order()` (§3.5) + locks down EXECUTE on definer functions to `service_role` |
| 8 | `008_m3_balance_referral.sql` | **M3** | $45 ceiling + no-negative-balance trigger, anti-self-referral CHECK, `recompute_credit_balance()`, ledger backfill |
| 9 | `009_m5_audit_and_reconcile.sql` | **M5** | `audit_log` table, `detect_balance_drift()` for the reconciliation job |
| 10 | `010_concession_referred_by_uuid.sql` | concessions | `users.referred_by` TEXT → UUID (PRD §4) |

> Concessions pass also edited `007`/`008`/`009` in place (not yet applied) to unify
> `users.credit_balance` on **cents** (= `SUM(credit_events.amount_cents)`).

> `007` redefines `fulfill_order` and **revokes EXECUTE** on `fulfill_order`,
> `assign_member_number`, `redeem_promo_code`, `check_rate_limit` from
> anon/authenticated, granting only `service_role`. Must run after `002`, `005`, `006`.

> `005` redefines `assign_member_number` with `CREATE OR REPLACE`, so it must run
> **after** `002`. Re-running `002` afterward would revert the 50-cap — don't.

## Verifying RLS (AC-7)

After applying M0, run the verification test. It is transactional and rolls back,
leaving no data behind:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/m0_rls_verification.sql
# expect: NOTICE ... ALL RLS CHECKS PASSED
```

(Or paste `supabase/tests/m0_rls_verification.sql` into the SQL Editor.)

## M0 deviation from PRD §4 (intentional, documented)

The PRD data model shows `users.referred_by uuid REFERENCES users(id)`. The
existing schema stores `referred_by text` holding the referrer's **public
`referral_code`** (set at signup; consumed by `fulfillOrder` → `creditReferrer`).
M0 must produce **no visible behavior change**, so `referred_by` is left as
`text` for now. Migrating it to `uuid` cascades into `app/actions/auth.ts`
(signup) and `lib/order-fulfillment.ts` (referral lookup); that change, if
desired, is scoped to **M3 (referral correctness)** where those paths are
already being reworked — not M0. Functionally equivalent and privacy-equivalent
(the code is non-guessable and is the only identifier in the referral link).
