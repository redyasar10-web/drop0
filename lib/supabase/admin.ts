// `server-only` makes any accidental client import a build-time error.
// Without this guard, a future `'use client'` file importing this module
// would silently bake SUPABASE_SERVICE_ROLE_KEY into the browser bundle.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
