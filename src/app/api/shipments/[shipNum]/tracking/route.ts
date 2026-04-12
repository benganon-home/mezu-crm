import { NextResponse } from 'next/server'
import { getTracking } from '@/lib/run'

// GET /api/shipments/[shipNum]/tracking
// Returns status history for a Run shipment

export async function GET(_req: Request, { params }: { params: { shipNum: string } }) {
  try {
    const events = await getTracking(params.shipNum)
    return NextResponse.json({ events })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
