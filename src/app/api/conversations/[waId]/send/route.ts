import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppText } from '@/lib/wa-cloud'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/conversations/[waId]/send — owner sends a manual WhatsApp reply.
// This takes over the chat (status → 'human', so the bot stays quiet) and logs
// the message into the conversation history.
export async function POST(req: NextRequest, { params }: { params: { waId: string } }) {
  const { data: { user } } = await createServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const text = (body.text || '').toString().trim()
  if (!text) return NextResponse.json({ error: 'empty message' }, { status: 400 })

  try {
    await sendWhatsAppText(params.waId, text)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'send failed' }, { status: 502 })
  }

  const db = admin()
  const now = new Date().toISOString()
  await Promise.all([
    db.from('wa_messages').insert({ wa_id: params.waId, role: 'assistant', content: text }),
    db.from('wa_conversations').upsert(
      { wa_id: params.waId, status: 'human', last_message: text.slice(0, 500), last_message_at: now, unread: false, updated_at: now },
      { onConflict: 'wa_id' },
    ),
  ])
  return NextResponse.json({ ok: true })
}
