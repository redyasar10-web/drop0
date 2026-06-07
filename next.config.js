/** @type {import('next').NextConfig} */

// Stricter than the Next default: hides "X-Powered-By", forces HTTPS for two
// years (HSTS preload), prevents iframing of the checkout, scopes script /
// frame / connect origins for Stripe + Supabase + Resend, and pins the
// referrer policy. Adjust the CSP if you add an analytics pixel — the
// landing page uses dangerouslySetInnerHTML, so a relaxed CSP is the
// last line of defense against a future markup edit gone wrong.
// Next dev mode evaluates code strings for HMR, which would be blocked by a
// strict CSP. In production this isn't needed — Next ships pre-compiled code.
const isDev = process.env.NODE_ENV !== 'production'
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com"
  : "script-src 'self' 'unsafe-inline' https://js.stripe.com"

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options',        value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=(self "https://js.stripe.com")',
  },
  {
    // 'unsafe-inline' on script-src is required by Next's inlined runtime;
    // tighten with a nonce when the rest of the integration stabilises.
    // Stripe.js + Stripe checkout iframes require js.stripe.com / hooks.stripe.com.
    // Supabase Auth + storage live on *.supabase.co. Resend doesn't render
    // browser-side. Images come from the same origin only.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.stripe.com",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  // Strips the default `X-Powered-By: Next.js` so a casual visitor can't
  // fingerprint the stack from response headers.
  poweredByHeader: false,

  // Auto-serve AVIF/WebP from any future next/image migration without per-call
  // config. The landing/about/support pages currently use raw <img> tags and
  // do not benefit from this yet — but the checkout wordmark does.
  images: {
    formats: ['image/avif', 'image/webp'],
    // No remote origins yet. Add explicit allow-list entries here before
    // referencing any external image (Supabase Storage, Stripe receipt CDN).
    remotePatterns: [],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ]
  },
}

module.exports = nextConfig
