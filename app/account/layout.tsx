import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

// Auth guard only — the account page renders the full design-truth nav + footer.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
