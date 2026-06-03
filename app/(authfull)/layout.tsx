import './auth-design.css'

// Full-bleed auth pages (login / create account) own their entire layout —
// the editorial split lives inside each page, so this is a passthrough.
export default function AuthFullLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
