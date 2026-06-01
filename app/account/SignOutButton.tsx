'use client'

import { signoutAction } from '@/app/actions/auth'

export default function SignOutButton() {
  return (
    <form action={signoutAction}>
      <button type="submit" className="account-signout-btn">
        Sign Out
      </button>
    </form>
  )
}
