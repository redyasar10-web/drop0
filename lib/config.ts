// ============================================================
// Server-authoritative configuration constants (PRD §6).
// The client never sets amounts or limits; these are the single
// source of truth referenced across milestones.
// ============================================================

export const CONFIG = {
  // Pricing (server-authoritative; client never sets amounts)
  DROP0_PRICE_CENTS: parseInt(process.env.DROP0_PRICE_CENTS ?? '2000', 10), // $20.00 Founding Member spot
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
} as const
