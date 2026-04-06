'use client'

import { useEffect, useState } from 'react'
import { Trash2, Undo2 } from 'lucide-react'

interface Props {
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: Props) {
  const [progress, setProgress] = useState(100)
  const [visible, setVisible]   = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining === 0) {
        clearInterval(interval)
        setVisible(false)
        setTimeout(onDismiss, 250)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [duration, onDismiss])

  const handleUndo = () => {
    setVisible(false)
    setTimeout(onUndo, 150)
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-250"
      style={{
        opacity:    visible ? 1 : 0,
        transform:  `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      }}
    >
      <div className="relative bg-navy dark:bg-cream text-cream dark:text-navy rounded-xl shadow-xl overflow-hidden min-w-[260px]">
        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 h-[3px] bg-gold/60 transition-none"
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-center gap-3 px-4 py-3">
          <Trash2 size={14} className="shrink-0 opacity-60" />
          <span className="text-sm flex-1">{message}</span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold/80 transition-colors shrink-0"
          >
            <Undo2 size={13} />
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
