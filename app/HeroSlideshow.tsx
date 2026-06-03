'use client'

import { useEffect, useState } from 'react'

const SLIDES = [
  '/hero/slide-1.jpg',
  '/hero/slide-2.jpg',
  '/hero/slide-4.jpg',
  '/hero/slide-3.jpg',
]

const INTERVAL = 5500

/**
 * Full-bleed editorial hero slideshow — crossfades through 1NRI campaign
 * photography. Headline/CTA live above this (in page.tsx) and stay fixed while
 * the images change. Auto-advances, pauses on hover, honors reduced-motion.
 */
export default function HeroSlideshow() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL)
    return () => clearInterval(t)
  }, [paused])

  return (
    <div
      className="slides"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className={`slides__img${i === index ? ' is-active' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : undefined}
        />
      ))}
      <div className="slides__dots" role="tablist" aria-label="Hero slides">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`slides__dot${i === index ? ' is-active' : ''}`}
            aria-label={`Show slide ${i + 1}`}
            aria-selected={i === index}
            role="tab"
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}
