'use client'

import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleCopy() {
    setFailed(false)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts / older browsers.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!ok) throw new Error('copy command failed')
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setFailed(true)
      setTimeout(() => setFailed(false), 3000)
    }
  }

  return (
    <button onClick={handleCopy} className="account-copy-btn">
      {copied ? 'Copied' : failed ? 'Press ⌘C to copy' : 'Copy Link'}
    </button>
  )
}
