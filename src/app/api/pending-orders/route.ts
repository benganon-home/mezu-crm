import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('pending_orders')
    .select('*')
    .order('inserted_at', { ascending: true })

  if (error) return NextResponse.json([])
  return NextResponse.json(data || [])
}
