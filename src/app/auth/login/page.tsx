'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Package, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('אימייל או סיסמה שגויים')
      setLoading(false)
    } else {
      router.push('/orders')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-navy-deeper flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-navy rounded-xl mb-4">
            <Package size={22} className="text-gold" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-[0.15em] text-navy dark:text-cream">MEZU</h1>
          <p className="text-sm text-muted mt-1">מערכת ניהול הזמנות</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="surface p-6 flex flex-col gap-4">
          <div>
            <label className="label block mb-1.5">אימייל</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              dir="ltr"
            />
          </div>

          <div>
            <label className="label block mb-1.5">סיסמה</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input ltr pl-9"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-navy dark:hover:text-cream"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 mt-1 disabled:opacity-60"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
      </div>
    </div>
  )
}
