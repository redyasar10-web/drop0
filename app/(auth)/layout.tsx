import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <Link href="/" className="auth-wordmark">Chariot</Link>
      {children}
    </div>
  )
}
