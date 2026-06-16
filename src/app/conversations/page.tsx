'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Bot, User, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'bot' | 'needs_human' | 'human'

interface Conversation {
  wa_id: string
  customer_name: string | null
  status: Status
  last_message: string | null
  last_message_at: string | null
  unread: boolean
}
interface Message { role: 'user' | 'assistant'; content: string; created_at: string }

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  needs_human: { label: 'ממתין לנציג', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  human:       { label: 'בטיפול',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  bot:         { label: 'בוט',         cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
}

const phone = (waId: string) => (waId || '').replace(/\D/g, '').replace(/^972/, '0')
const time = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')

function ConversationsInner() {
  const search = useSearchParams()
  const [list, setList] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conv, setConv] = useState<Conversation | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const threadRef = useRef<HTMLDivElement>(null)

  const loadList = useCallback(async () => {
    const res = await fetch('/api/conversations')
    const data = await res.json()
    setList(Array.isArray(data) ? data : [])
    setLoadingList(false)
  }, [])

  const loadDetail = useCallback(async (waId: string) => {
    const res = await fetch(`/api/conversations/${encodeURIComponent(waId)}`)
    const data = await res.json()
    setConv(data.conversation ?? null)
    setMessages(Array.isArray(data.messages) ? data.messages : [])
    setList(prev => prev.map(c => (c.wa_id === waId ? { ...c, unread: false } : c)))
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    const t = setInterval(loadList, 15000)
    return () => clearInterval(t)
  }, [loadList])

  useEffect(() => {
    const wa = search.get('wa')
    if (wa) setSelected(wa)
  }, [search])

  useEffect(() => { if (selected) loadDetail(selected) }, [selected, loadDetail])
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }) }, [messages])

  const setStatus = async (status: Status) => {
    if (!selected) return
    await fetch(`/api/conversations/${encodeURIComponent(selected)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setConv(c => (c ? { ...c, status } : c))
    setList(prev => prev.map(c => (c.wa_id === selected ? { ...c, status } : c)))
  }

  const send = async () => {
    if (!selected || !draft.trim() || sending) return
    setSending(true)
    const text = draft.trim()
    const res = await fetch(`/api/conversations/${encodeURIComponent(selected)}/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    })
    setSending(false)
    if (!res.ok) { alert('שליחת ההודעה נכשלה. ייתכן שחלף חלון 24 השעות לתגובה חופשית בוואטסאפ.'); return }
    setDraft('')
    setMessages(m => [...m, { role: 'assistant', content: text, created_at: new Date().toISOString() }])
    setConv(c => (c ? { ...c, status: 'human' } : c))
    loadList()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-1rem)]">
      <div className="page-header">
        <h1 className="text-xl font-semibold">שיחות וואטסאפ</h1>
        <button onClick={loadList} className="btn-ghost flex items-center gap-1.5 text-sm" title="רענון">
          <RefreshCw size={14} /> רענון
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 min-h-0">
        {/* Conversation list */}
        <div className={cn('surface p-0 overflow-y-auto', selected && 'hidden md:block')}>
          {loadingList ? (
            <div className="p-4 text-sm text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> טוען…</div>
          ) : list.length === 0 ? (
            <div className="p-6 text-sm text-muted text-center">אין שיחות עדיין</div>
          ) : (
            list.map(c => {
              const meta = STATUS_META[c.status]
              return (
                <button
                  key={c.wa_id}
                  onClick={() => setSelected(c.wa_id)}
                  className={cn(
                    'w-full text-right px-3 py-2.5 border-b border-cream-dark/60 dark:border-navy-light/40 hover:bg-cream dark:hover:bg-navy-light/20 transition-colors',
                    selected === c.wa_id && 'bg-cream dark:bg-navy-light/30',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.customer_name || phone(c.wa_id)}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {c.unread && <span className="w-2 h-2 rounded-full bg-gold" />}
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', meta.cls)}>{meta.label}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-muted truncate">{c.last_message || ''}</span>
                    <span className="text-[10px] text-muted/70 shrink-0 ltr">{time(c.last_message_at)}</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Thread */}
        <div className={cn('surface p-0 flex flex-col min-h-0', !selected && 'hidden md:flex')}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted text-sm">בחרו שיחה כדי לצפות ולהשיב</div>
          ) : (
            <>
              {/* Header + status controls */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-cream-dark dark:border-navy-light">
                <button onClick={() => setSelected(null)} className="md:hidden btn-ghost text-sm">← חזרה</button>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{conv?.customer_name || phone(selected)}</div>
                  <div className="text-xs text-muted ltr">{phone(selected)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStatus('human')}
                    className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full transition-colors',
                      conv?.status === 'human' ? 'bg-amber-500 text-white' : 'bg-cream-dark/60 dark:bg-navy-light text-muted hover:text-navy dark:hover:text-cream')}
                  >
                    <User size={13} /> אני מטפל
                  </button>
                  <button
                    onClick={() => setStatus('bot')}
                    className={cn('flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full transition-colors',
                      conv?.status === 'bot' ? 'bg-green-600 text-white' : 'bg-cream-dark/60 dark:bg-navy-light text-muted hover:text-navy dark:hover:text-cream')}
                  >
                    <Bot size={13} /> חזרה לבוט
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 && <div className="text-center text-sm text-muted py-8">אין הודעות בשיחה זו</div>}
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-start' : 'justify-end')}>
                    <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                      m.role === 'user'
                        ? 'bg-cream-dark/70 dark:bg-navy-light text-navy dark:text-cream'
                        : 'bg-[#25D366]/90 text-white')}
                    >
                      {m.content}
                      <div className={cn('text-[10px] mt-1 ltr', m.role === 'user' ? 'text-muted' : 'text-white/70')}>{time(m.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer */}
              <div className="border-t border-cream-dark dark:border-navy-light p-2 flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="כתבו הודעה ללקוח…  (Enter לשליחה)"
                  className="input flex-1 resize-none min-h-[42px] max-h-32 text-sm"
                  rows={1}
                />
                <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary h-[42px] px-4 flex items-center gap-1.5 disabled:opacity-40">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-muted">טוען…</div>}>
      <ConversationsInner />
    </Suspense>
  )
}
