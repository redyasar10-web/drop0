import { redirect } from 'next/navigation'

// /admin has no UI of its own — bounce to the products list.
// The layout's admin role gate runs FIRST (before this redirect), so a
// non-admin visiting /admin still gets sent to /login.
export default function AdminIndexPage() {
  redirect('/admin/products')
}
