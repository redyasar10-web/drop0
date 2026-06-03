'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Subtle on-scroll reveal. SSR-rendered with the `reveal` class so content is
 * styled from first paint; an IntersectionObserver adds `is-in` when the
 * element enters the viewport. Honors prefers-reduced-motion (CSS handles the
 * fallback) and degrades to visible without JS (noscript override in CSS).
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  as?: keyof JSX.IntrinsicElements
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true)
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    )
    io.observe(el)
    // Fail-safe: never leave content hidden if the observer doesn't fire
    // (e.g. very fast scroll, headless capture, observer quirks).
    const fallback = setTimeout(() => setShown(true), 1600)
    return () => { io.disconnect(); clearTimeout(fallback) }
  }, [])

  const Comp = Tag as any
  return (
    <Comp
      ref={ref}
      className={`reveal ${shown ? 'is-in' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Comp>
  )
}
