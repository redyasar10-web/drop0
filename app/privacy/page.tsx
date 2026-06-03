import type { Metadata } from 'next'
import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import '../terms/legal.css'

export const metadata: Metadata = {
  title: 'Privacy Notice — Chariot',
  description: 'How Chariot Archive Inc. collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  const md = fs.readFileSync(path.join(process.cwd(), 'content/legal/privacy.md'), 'utf8')
  return (
    <div className="legal">
      <header className="legal__nav">
        <Link href="/" className="legal__wordmark">Chariot</Link>
        <Link href="/terms" className="legal__navlink">Terms of Service</Link>
      </header>
      <main className="legal__doc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </main>
      <footer className="legal__foot">
        <Link href="/">← Back to Chariot</Link>
      </footer>
    </div>
  )
}
