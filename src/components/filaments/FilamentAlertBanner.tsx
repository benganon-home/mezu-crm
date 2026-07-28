'use client'

// Slim reorder alert for filaments, surfaced outside the חומרי גלם module
// (the orders screen is where Ben actually lives). Renders nothing unless an
// active color's projected stock is negative ('order' status).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import type { FilamentSummary } from '@/types'

const kg = (g: number) => `${(Math.abs(g) / 1000).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ק״ג`

export function FilamentAlertBanner() {
  const [needOrder, setNeedOrder] = useState<FilamentSummary[]>([])

  useEffect(() => {
    fetch('/api/filaments')
      .then(r => r.json())
      .then(d => {
        const fils: FilamentSummary[] = Array.isArray(d?.filaments) ? d.filaments : []
        setNeedOrder(fils.filter(f => f.is_active && f.status === 'order'))
      })
      .catch(() => { /* banner is best-effort */ })
  }, [])

  if (!needOrder.length) return null

  return (
    <Link
      href="/filaments"
      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:border-red-300 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
    >
      <AlertTriangle size={15} className="shrink-0" strokeWidth={1.8} />
      <span className="min-w-0 truncate">
        <span className="font-semibold">צריך להזמין פילמנט:</span>{' '}
        {needOrder.map(f => `${f.color} (חסרים ${kg(f.projected_g)})`).join(' · ')}
      </span>
      <ArrowLeft size={14} className="mr-auto shrink-0" strokeWidth={1.6} />
    </Link>
  )
}
