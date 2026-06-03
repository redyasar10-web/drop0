'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const LINKS = [
  { label: 'The Drop', href: '/#selection' },
  { label: 'The Brand', href: '/#brands' },
  { label: 'How It Works', href: '/#process' },
]

export default function LandingNav({ isAuthed = false }: { isAuthed?: boolean }) {
  const navRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)

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

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const accountLink = isAuthed
    ? { label: 'Account', href: '/account' }
    : { label: 'Log in', href: '/login' }

  return (
    <header className={`nav${open ? ' is-open' : ''}`} ref={navRef}>
      <div className="nav__row">
        {/* Left links (desktop) */}
        <nav className="nav__links nav__links--left" aria-label="Primary">
          <Link href={LINKS[0].href} className="nav__link">{LINKS[0].label}</Link>
          <Link href={LINKS[1].href} className="nav__link">{LINKS[1].label}</Link>
        </nav>

        {/* Hamburger (mobile) */}
        <button
          className="nav__burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>

        {/* Centered wordmark */}
        <Link href="/" className="nav__wordmark" aria-label="Chariot home" onClick={() => setOpen(false)}>
          <img src="/chariot-wordmark-white.png" alt="Chariot" className="nav__logo" />
        </Link>

        {/* Right links (desktop) */}
        <nav className="nav__links nav__links--right" aria-label="Account">
          <Link href={LINKS[2].href} className="nav__link">{LINKS[2].label}</Link>
          <Link href={accountLink.href} className="nav__link">{accountLink.label}</Link>
        </nav>
      </div>

      {/* Mobile overlay menu */}
      <div className="nav__overlay" aria-hidden={!open}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav__overlaylink" onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <Link href={accountLink.href} className="nav__overlaylink" onClick={() => setOpen(false)}>
          {accountLink.label}
        </Link>
      </div>
    </header>
  )
}
