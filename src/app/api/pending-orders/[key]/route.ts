import { NextRequest, NextResponse } from 'next/server'

const MAKE_BASE = 'https://eu1.make.com/api/v2'
const DS_ID     = '111813'
const TEAM_ID   = '1416079'

async function deleteFromStore(key: string) {
  return fetch(
    `${MAKE_BASE}/data-store-records/${encodeURIComponent(key)}?dataStoreId=${DS_ID}&teamId=${TEAM_ID}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Token ${process.env.MAKE_API_TOKEN!}` },
    }
  )
}

// DELETE /api/pending-orders/[key] — remove from DataStore (no payment)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  await deleteFromStore(params.key)
  return NextResponse.json({ ok: true })
}

// POST /api/pending-orders/[key] — create order in CRM + remove from DataStore
export async function POST(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  const body = await req.json()

  const webhookRes = await fetch(`${req.nextUrl.origin}/api/webhooks/new-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.WEBHOOK_SECRET!,
    },
    body: JSON.stringify(body),
  })

  if (!webhookRes.ok) {
    const err = await webhookRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.error || 'Failed to create order' }, { status: 400 })
  }

  await deleteFromStore(params.key)

  const order = await webhookRes.json()
  return NextResponse.json(order, { status: 201 })
}
