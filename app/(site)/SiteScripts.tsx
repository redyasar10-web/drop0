'use client'

import { useEffect } from 'react'

// Port of design-truth/chariot.js + the landing inline scripts, run against the
// injected static markup after hydration. Pure DOM, idempotent on mount.
export default function SiteScripts() {
  useEffect(() => {
    const cleanups: Array<() => void> = []
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // ---- Nav: transparent over hero -> solid on scroll ----
    const nav = document.querySelector<HTMLElement>('[data-nav]')
    if (nav) {
      const trigger = document.getElementById('top')
      if (nav.hasAttribute('data-nav-solid')) {
        nav.classList.add('is-scrolled')
      } else {
        const onScroll = () => {
          const past = trigger ? window.scrollY > trigger.offsetHeight * 0.58 : window.scrollY > 90
          nav.classList.toggle('is-scrolled', past)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        cleanups.push(() => window.removeEventListener('scroll', onScroll))
      }

      const burger = nav.querySelector<HTMLElement>('[data-burger]')
      if (burger) {
        const onBurger = () => {
          const open = nav.classList.toggle('is-open')
          burger.setAttribute('aria-expanded', open ? 'true' : 'false')
          document.body.style.overflow = open ? 'hidden' : ''
        }
        burger.addEventListener('click', onBurger)
        cleanups.push(() => burger.removeEventListener('click', onBurger))
        nav.querySelectorAll<HTMLElement>('.nav__overlaylink').forEach((a) => {
          const close = () => {
            nav.classList.remove('is-open')
            burger.setAttribute('aria-expanded', 'false')
            document.body.style.overflow = ''
          }
          a.addEventListener('click', close)
          cleanups.push(() => a.removeEventListener('click', close))
        })
      }
    }

    // ---- Scroll reveal ----
    const reveals = document.querySelectorAll<HTMLElement>('.reveal')
    if (reveals.length) {
      if (reduce || !('IntersectionObserver' in window)) {
        reveals.forEach((el) => el.classList.add('is-in'))
      } else {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add('is-in')
                io.unobserve(e.target)
              }
            })
          },
          { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
        )
        reveals.forEach((el) => io.observe(el))
        const failsafe = setTimeout(() => reveals.forEach((el) => el.classList.add('is-in')), 1800)
        cleanups.push(() => {
          io.disconnect()
          clearTimeout(failsafe)
        })
      }
    }

    // ---- Scroll progress bar ----
    const fill = document.querySelector<HTMLElement>('[data-progress]')
    if (fill) {
      const update = () => {
        const h = document.documentElement
        const max = h.scrollHeight - h.clientHeight
        const pct = max > 0 ? (h.scrollTop || window.scrollY) / max : 0
        fill.style.width = Math.max(0, Math.min(1, pct)) * 100 + '%'
      }
      window.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
      update()
      cleanups.push(() => {
        window.removeEventListener('scroll', update)
        window.removeEventListener('resize', update)
      })
    }

    // ---- Footer year ----
    document.querySelectorAll<HTMLElement>('[data-year]').forEach((el) => {
      el.textContent = String(new Date().getFullYear())
    })

    // ---- Account dropdown ----
    const acct = document.querySelector<HTMLElement>('[data-acct]')
    if (acct) {
      const btn = acct.querySelector<HTMLElement>('[data-acct-btn]')
      const close = () => {
        acct.classList.remove('is-open')
        btn?.setAttribute('aria-expanded', 'false')
      }
      const open = () => {
        acct.classList.add('is-open')
        btn?.setAttribute('aria-expanded', 'true')
      }
      const onBtn = (e: Event) => {
        e.stopPropagation()
        acct.classList.contains('is-open') ? close() : open()
      }
      const onDoc = (e: Event) => {
        if (!acct.contains(e.target as Node)) close()
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') close()
      }
      btn?.addEventListener('click', onBtn)
      document.addEventListener('click', onDoc)
      document.addEventListener('keydown', onKey)
      cleanups.push(() => {
        btn?.removeEventListener('click', onBtn)
        document.removeEventListener('click', onDoc)
        document.removeEventListener('keydown', onKey)
      })
    }

    // ---- Copy-to-clipboard (referral link) ----
    document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
      const link = document.querySelector<HTMLElement>('[data-ref-link]')
      const onCopy = () => {
        const text = (link?.textContent ?? '').trim()
        const done = () => {
          const original = btn.textContent
          btn.textContent = 'Copied'
          btn.classList.add('is-done')
          setTimeout(() => {
            btn.textContent = original
            btn.classList.remove('is-done')
          }, 1800)
        }
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(done)
        else done()
      }
      btn.addEventListener('click', onCopy)
      cleanups.push(() => btn.removeEventListener('click', onCopy))
    })

    // ---- Hero background slideshow ----
    const heroWrap = document.querySelector<HTMLElement>('[data-hero-slides]')
    if (heroWrap && !reduce) {
      const slides = heroWrap.querySelectorAll<HTMLElement>('.hero__slide')
      if (slides.length >= 2) {
        let i = 0
        const id = setInterval(() => {
          slides[i].classList.remove('is-on')
          i = (i + 1) % slides.length
          slides[i].classList.add('is-on')
        }, 5200)
        cleanups.push(() => clearInterval(id))
      }
    }

    // ---- Lookbook carousel arrows ----
    const rail = document.querySelector<HTMLElement>('[data-rail]')
    if (rail) {
      const prev = document.querySelector<HTMLButtonElement>('[data-rail-prev]')
      const next = document.querySelector<HTMLButtonElement>('[data-rail-next]')
      const step = () => {
        const card = rail.querySelector<HTMLElement>('.lb')
        const gap = parseFloat(getComputedStyle(rail).columnGap) || 24
        return card ? card.getBoundingClientRect().width + gap : 320
      }
      const update = () => {
        const max = rail.scrollWidth - rail.clientWidth - 2
        if (prev) prev.disabled = rail.scrollLeft <= 2
        if (next) next.disabled = rail.scrollLeft >= max
      }
      const onPrev = () => rail.scrollBy({ left: -step() * 2, behavior: 'smooth' })
      const onNext = () => rail.scrollBy({ left: step() * 2, behavior: 'smooth' })
      prev?.addEventListener('click', onPrev)
      next?.addEventListener('click', onNext)
      rail.addEventListener('scroll', update, { passive: true })
      window.addEventListener('resize', update)
      update()
      cleanups.push(() => {
        prev?.removeEventListener('click', onPrev)
        next?.removeEventListener('click', onNext)
        rail.removeEventListener('scroll', update)
        window.removeEventListener('resize', update)
      })
    }

    // ---- Newsletter inline validation + success ----
    const form = document.querySelector<HTMLFormElement>('[data-news]')
    if (form) {
      const email = form.querySelector<HTMLInputElement>('#news-email')
      const err = form.querySelector<HTMLElement>('[data-news-err]')
      const ok = form.querySelector<HTMLElement>('[data-news-ok]')
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const onSubmit = (e: Event) => {
        e.preventDefault()
        if (!email || !err || !ok) return
        err.textContent = ''
        email.setAttribute('aria-invalid', 'false')
        if (!re.test(email.value.trim())) {
          err.textContent = 'Enter a valid email address.'
          email.setAttribute('aria-invalid', 'true')
          email.focus()
          return
        }
        ok.classList.add('is-on')
        const row = form.querySelector<HTMLElement>('.news__row')
        const note = form.querySelector<HTMLElement>('.news__note')
        if (row) row.style.display = 'none'
        if (note) note.style.display = 'none'
      }
      form.addEventListener('submit', onSubmit)
      cleanups.push(() => form.removeEventListener('submit', onSubmit))
    }

    return () => cleanups.forEach((fn) => fn())
  }, [])

  return null
}
