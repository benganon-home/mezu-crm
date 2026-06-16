import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { setStatus, type ConvStatus } from '@/lib/wa-conversations'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function requireUser() {
  const { data: { user } } = await createServerClient().auth.getUser()
  return user
}

// GET /api/conversations/[waId] — conversation + full message history.
export async function GET(_req: NextRequest, { params }: { params: { waId: string } }) {
  if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = admin()
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    db.from('wa_conversations').select('*').eq('wa_id', params.waId).maybeSingle(),
    db.from('wa_messages').select('role, content, created_at').eq('wa_id', params.waId).order('created_at', { ascending: true }).limit(200),
  ])
  // Opening a conversation clears its unread flag.
  await db.from('wa_conversations').update({ unread: false }).eq('wa_id', params.waId)
  return NextResponse.json({ conversation, messages: messages ?? [] })
}

// PATCH /api/conversations/[waId] — change status (bot / needs_human / human).
export async function PATCH(req: NextRequest, { params }: { params: { waId: string } }) {
  if (!(await requireUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const status = body.status as ConvStatus | undefined
  if (status && !['bot', 'needs_human', 'human'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  if (status) await setStatus(params.waId, status)
  return NextResponse.json({ ok: true })
}
