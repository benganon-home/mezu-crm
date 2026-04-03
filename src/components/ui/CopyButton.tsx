'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { copyToClipboard, cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
}

export function CopyButton({ text, className }: Props) {
  const [copied, setCopied] = useState(false)

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      onClick={handle}
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded',
        'text-muted hover:text-gold hover:bg-gold/10 transition-colors',
        copied && 'text-green-600',
        className
      )}
      title="העתק"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}
