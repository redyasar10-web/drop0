import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { isAdmin } from '@/lib/admin-guard'
import { signoutAction } from '@/app/actions/auth'
import './admin.css'

export const metadata = {
  title: 'Chariot — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) {
    // Middleware stamps x-pathname; fall back to /admin if unavailable so
    // post-login lands the user somewhere sensible regardless.
    const pathname = headers().get('x-pathname') ?? '/admin'
    const safeNext = pathname.startsWith('/admin') ? pathname : '/admin'
    redirect(`/login?next=${encodeURIComponent(safeNext)}`)
  }

  return (
    <>
      <header className="admin-nav">
        <div className="admin-nav__in">
          <Link href="/admin/products" className="admin-nav__brand">Chariot · Admin</Link>
          <nav className="admin-nav__links">
            <Link href="/admin/products">Products</Link>
            <Link href="/admin/setup">Setup</Link>
            <Link href="/admin/diagnostics">Diagnostics</Link>
            <Link href="/" target="_blank">View site →</Link>
          </nav>
          <form action={signoutAction}>
            <button type="submit" className="admin-nav__signout">Sign out</button>
          </form>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </>
  )
}
