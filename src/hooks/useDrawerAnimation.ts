import { useState, useEffect } from 'react'

/**
 * Handles enter/exit animations for drawers.
 * - On mount: starts hidden, triggers slide-in after first paint
 * - On close: slides out, then calls onClose after transition ends
 */
export function useDrawerAnimation(onClose: () => void, duration = 300) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, duration)
  }

  return { visible, close }
}
