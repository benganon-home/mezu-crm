import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/conversations — list WhatsApp conversations for the inbox.
// Conversations awaiting a human float to the top, then most-recent first.
export async function GET() {
  const { data: { user } } = await createServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await admin()
    .from('wa_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rank = (s: string) => (s === 'needs_human' ? 0 : s === 'human' ? 1 : 2)
  const list = (data ?? []).sort((a, b) => rank(a.status) - rank(b.status))
  return NextResponse.json(list)
}
