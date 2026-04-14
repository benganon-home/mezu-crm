'use client'

import { useState, useEffect } from 'react'
import { Bell, Phone, MessageCircle, CheckCircle2, Circle, Plus, Pencil, Trash2 } from 'lucide-react'
import { Reminder } from '@/types'
import { formatDate, buildWaLink, cn } from '@/lib/utils'
import { NewReminderModal } from '@/components/reminders/NewReminderModal'

const TYPE_ICON = {
  call:      <Phone size={13} strokeWidth={1.5} />,
  whatsapp:  <MessageCircle size={13} strokeWidth={1.5} />,
  task:      <Bell size={13} strokeWidth={1.5} />,
}

const TYPE_LABEL = { call: 'שיחה', whatsapp: 'WhatsApp', task: 'משימה' }

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showDone,  setShowDone]  = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Reminder | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reminders?done=${showDone}`)
      .then(r => r.json())
      .then(d => { setReminders(Array.isArray(d) ? d : []); setLoading(false) })
  }, [showDone])

  const toggle = async (r: Reminder) => {
    await fetch('/api/reminders', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: r.id, is_done: !r.is_done }),
    })
    setReminders(prev => prev.filter(x => x.id !== r.id))
  }

  const deleteReminder = async (r: Reminder) => {
    setReminders(prev => prev.filter(x => x.id !== r.id))
    await fetch('/api/reminders', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: r.id }),
    })
  }

  const startEdit = (r: Reminder) => {
    setEditTarget(r)
    setModalOpen(true)
  }

  const openNew = () => {
    setEditTarget(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditTarget(null)
  }

  const handleSaved = (saved: Reminder) => {
    setReminders(prev => {
      const exists = prev.find(x => x.id === saved.id)
      if (exists) return prev.map(x => x.id === saved.id ? saved : x)
      return [saved, ...prev]
    })
  }

  // String-compare YYYY-MM-DD to avoid timezone shift bugs
  const todayStr = new Date().toISOString().split('T')[0]
  const overdue  = reminders.filter(r => r.due_date && r.due_date < todayStr)
  const today    = reminders.filter(r => r.due_date && r.due_date === todayStr)
  const upcoming = reminders.filter(r => !r.due_date || r.due_date > todayStr)

  return (
    <div className="flex flex-col gap-5">
      <div className="page-header">
        <div>
          <h1>תזכורות</h1>
          <p className="text-xs text-muted mt-0.5">{reminders.length} {showDone ? 'טופלו' : 'פתוחות'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDone(s => !s)}
            className={cn('btn-ghost text-sm', showDone && 'text-gold')}
          >
            {showDone ? 'הצג פתוחות' : 'הצג טופלו'}
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus size={14} strokeWidth={1.5} /> תזכורת חדשה
          </button>
        </div>
      </div>

      {loading && <div className="text-muted text-sm">טוען...</div>}

      {!loading && reminders.length === 0 && (
        <div className="surface p-12 text-center text-muted">
          <Bell size={32} className="mx-auto mb-3 opacity-30" strokeWidth={1} />
          <p>אין תזכורות {showDone ? 'שטופלו' : 'פתוחות'}</p>
          {!showDone && (
            <button onClick={openNew} className="btn-primary mt-4 mx-auto flex items-center gap-2 text-sm px-4 py-2">
              <Plus size={13} /> צור תזכורת ראשונה
            </button>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <section>
          <div className="label text-red-500 mb-2">באיחור ({overdue.length})</div>
          <div className="flex flex-col gap-2">
            {overdue.map(r => (
              <ReminderCard key={r.id} reminder={r} onToggle={toggle} onEdit={startEdit} onDelete={deleteReminder} />
            ))}
          </div>
        </section>
      )}

      {today.length > 0 && (
        <section>
          <div className="label text-gold mb-2">היום ({today.length})</div>
          <div className="flex flex-col gap-2">
            {today.map(r => (
              <ReminderCard key={r.id} reminder={r} onToggle={toggle} onEdit={startEdit} onDelete={deleteReminder} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <div className="label mb-2">קרובות</div>
          <div className="flex flex-col gap-2">
            {upcoming.map(r => (
              <ReminderCard key={r.id} reminder={r} onToggle={toggle} onEdit={startEdit} onDelete={deleteReminder} />
            ))}
          </div>
        </section>
      )}

      {modalOpen && (
        <NewReminderModal
          onClose={closeModal}
          onSaved={handleSaved}
          initial={editTarget}
        />
      )}
    </div>
  )
}

function ReminderCard({
  reminder: r,
  onToggle,
  onEdit,
  onDelete,
}: {
  reminder:  Reminder
  onToggle:  (r: Reminder) => void
  onEdit:    (r: Reminder) => void
  onDelete:  (r: Reminder) => void
}) {
  const isOverdue = r.due_date && r.due_date < new Date().toISOString().split('T')[0]
  const isToday   = r.due_date && r.due_date === new Date().toISOString().split('T')[0]

  return (
    <div className={cn(
      'surface px-4 py-3 flex items-start gap-3',
      isOverdue && 'border-red-200 dark:border-red-800',
      isToday   && 'border-gold/40 dark:border-gold/30',
    )}>
      <button
        onClick={() => onToggle(r)}
        className={cn('mt-0.5 flex-shrink-0', r.is_done ? 'text-emerald-500' : 'text-muted hover:text-navy dark:hover:text-cream')}
      >
        {r.is_done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {r.customer && <span className="font-medium text-sm">{r.customer.name}</span>}
          <span className="badge text-xs bg-cream dark:bg-navy-deeper text-muted border-cream-dark dark:border-navy-light">
            {TYPE_ICON[r.type]}
            <span className="mr-1">{TYPE_LABEL[r.type]}</span>
          </span>
          {r.due_date && (
            <span className={cn('text-xs ltr', isOverdue ? 'text-red-500' : isToday ? 'text-gold font-medium' : 'text-muted')}>
              {isToday ? 'היום' : formatDate(r.due_date)}
            </span>
          )}
        </div>
        <p className="text-sm mt-1 text-navy/80 dark:text-cream/80">{r.content}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        {r.type === 'whatsapp' && r.customer && (
          <a
            href={buildWaLink(r.customer.phone, r.content)}
            target="_blank"
            rel="noreferrer"
            className="text-[#25D366] hover:opacity-80"
            title="שלח WhatsApp"
          >
            <MessageCircle size={15} />
          </a>
        )}
        {r.type === 'call' && r.customer && (
          <a href={`tel:${r.customer.phone}`} className="text-muted hover:text-navy dark:hover:text-cream" title="חייג">
            <Phone size={15} />
          </a>
        )}
        <button
          onClick={() => onEdit(r)}
          className="text-muted hover:text-navy dark:hover:text-cream transition-colors p-0.5"
          title="ערוך"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(r)}
          className="text-muted hover:text-red-500 transition-colors p-0.5"
          title="מחק"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
