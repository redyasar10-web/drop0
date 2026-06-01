import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'
import Link from 'next/link'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <nav className="account-nav">
        <Link href="/account" className="account-nav-wordmark">Chariot</Link>
        <SignOutButton />
      </nav>
      {children}
    </>
  )
}
