'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function ArchiveButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const onArchive = () => {
    if (!confirm('Archive this product? It will hide from the live site and Stripe immediately.')) return
    start(async () => {
      setErr(null)
      const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setErr(data.error ?? 'Archive failed.')
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <button className="admin-btn admin-btn--danger" onClick={onArchive} disabled={pending}>
        {pending ? 'Archiving…' : 'Archive'}
      </button>
      {err && <span style={{ color: 'var(--ad-bad)', fontSize: 12, marginLeft: 8 }}>{err}</span>}
    </>
  )
}
