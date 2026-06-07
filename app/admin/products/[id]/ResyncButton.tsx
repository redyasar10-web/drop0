'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function ResyncButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const onResync = () => {
    setMsg(null)
    start(async () => {
      const res = await fetch('/api/admin/products/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setMsg({ kind: 'err', text: data.error ?? 'Resync failed.' })
        return
      }
      const note = data.priceRotated
        ? 'Synced. A new Stripe Price was created and the old one archived.'
        : data.productChanged
        ? 'Synced. Stripe Product metadata updated.'
        : 'Already in sync.'
      setMsg({ kind: 'ok', text: note })
      router.refresh()
    })
  }

  return (
    <>
      <button className="admin-btn admin-btn--ghost" onClick={onResync} disabled={pending}>
        {pending ? 'Syncing…' : 'Resync to Stripe'}
      </button>
      {msg && (
        <div className={`admin-banner admin-banner--${msg.kind === 'ok' ? 'ok' : 'err'}`} style={{ marginTop: 12 }}>
          {msg.text}
        </div>
      )}
    </>
  )
}
