# Chariot — Claude Code Instructions

## What this is
Chariot Archive is a fashion import platform. This repo is the customer-facing website.
Drop 0 is the first launch — a limited pre-order of curated pieces from Ghana-based brands.

## Stack
- Framework: Next.js 14 (App Router)
- Auth + DB: Supabase
- Payments: Stripe (Checkout + Webhooks)
- Email: Resend
- Styling: existing design system in tokens.css — DO NOT deviate from it

## Design system rules (non-negotiable)
- Colors: --color-ink (#111111), --color-harmattan (#F2EBE0), --color-kente (#C9921E), --color-laterite (#9B4523)
- Fonts: Inter Variable (display), Spectral (body), DM Mono (mono)
- No rounded corners except --radius-pill on filter chips only
- No pure black (#000) or pure white (#fff) anywhere
- Brand voice: calm authority. No exclamation marks. No "excited to introduce" language.

## Database schema (Supabase)
- users: id, email, member_number (nullable), credit_balance (default 0), referral_code (unique), referred_by (nullable), founder_status (boolean default false), tc_agreed_at (timestamp)
- member_sequence: single-row table tracking next available member number
- referrals: id, referrer_id, referred_id, credited (boolean), created_at
- promo_codes: code, max_uses, use_count, active

## Business logic rules
1. T&C checkbox is REQUIRED at signup. Store tc_agreed_at timestamp. Block account creation without it.
2. Member numbers are assigned sequentially on first completed Stripe purchase via webhook — NEVER on the frontend, NEVER before payment confirms.
3. Member numbers are permanent. Never reassign. Format as #001, #002 etc.
4. Referral credits: $5 per referred friend who completes a purchase, max 3 referrals = $15 from referrals. Base credit after first purchase = $30. Credits applied as Stripe discount at checkout.
5. Referral links: chariot.com/ref/[referral_code] — must resolve on Chariot domain only.
6. Promo code "zarathustra": 100% off Drop 0, grants founder_status = true and credit_balance = 30. Tracked server-side in promo_codes table. Expires at 10 uses. Never trust client-side redemption count.
7. Confirmation email fires from Stripe webhook, not from frontend.

## Out of scope — do not build
- Paid advertising infrastructure
- Press/media features
- Investor dashboard
- Anything requiring Drop 1 data
- Second brand

## Team contacts
- Caleb Silver — caleb@chariotarchive.com (Creative Director)
- Red — red@chariotarchive.com (CEO)
- Seth — seth@chariotarchive.com