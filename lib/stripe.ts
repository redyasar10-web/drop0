// server-only so a future `'use client'` import doesn't try to instantiate
// the Stripe SDK in the browser with an empty STRIPE_SECRET_KEY (silent
// failure mode). Closes the gap the TS reviewer flagged in round 4.
import 'server-only'
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})
