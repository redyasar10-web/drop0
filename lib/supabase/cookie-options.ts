import type { CookieOptions } from '@supabase/ssr'

// ============================================================
// Session cookie hardening (ACC-4 / ASVS 8.3, NF-4).
//
//   HttpOnly     - not readable from JS (blocks XSS session theft)
//   Secure       - only sent over HTTPS (enabled outside local dev)
//   SameSite=Lax - CSRF mitigation; survives top-level navigations
//                  (needed for the email-verify / OAuth-style redirects)
//   Path=/       - available app-wide
//
// HttpOnly is safe here because this app reads the session SERVER-SIDE ONLY
// (server components, server actions, route handlers, middleware). The
// @supabase/ssr browser client is not used anywhere, so nothing on the client
// needs to read the auth cookie via document.cookie. Do NOT introduce
// createBrowserClient for session reads without revisiting this.
// ============================================================

export const SUPABASE_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}
