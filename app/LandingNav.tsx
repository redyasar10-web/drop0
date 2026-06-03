'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function LandingNav({ isAuthed = false }: { isAuthed?: boolean }) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const hero = document.getElementById('top')
    if (!nav || !hero) return

    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > hero.offsetHeight - 90)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="nav" ref={navRef}>
      <div className="nav__row">
        <Link href="/" className="nav__wordmark" aria-label="Chariot home">
          <img src="/chariot-wordmark-white.png" alt="Chariot" className="nav__logo" />
        </Link>
        <nav className="nav__links" aria-label="Account">
          {isAuthed ? (
            <Link href="/account" className="nav__link">Account</Link>
          ) : (
            <Link href="/login" className="nav__link">Log in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
