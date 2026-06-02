'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function LandingNav() {
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
        <Link href="/" className="nav__wordmark">Chariot</Link>
      </div>
    </header>
  )
}
