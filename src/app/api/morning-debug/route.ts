import { NextResponse } from 'next/server'
import { getToken } from '@/lib/morning'

// GET /api/morning-debug — test Morning auth step by step
export async function GET() {
  const id     = process.env.MORNING_API_KEY
  const secret = process.env.MORNING_API_SECRET

  const steps: Record<string, any> = {
    env: { id: id ? `${id.slice(0, 6)}...` : 'MISSING', secret: secret ? '✓ set' : 'MISSING' },
  }

  // Step 1: raw token request
  try {
    const res  = await fetch('https://api.morning.co/v1/account/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, secret }),
    })
    const text = await res.text()
    steps.tokenRequest = { status: res.status, body: text.slice(0, 500) }

    if (res.ok) {
      const data = JSON.parse(text)
      steps.tokenParsed = { keys: Object.keys(data), token: data.token ? `${data.token.slice(0, 20)}...` : 'missing' }

      // Step 2: try listing documents
      const token = data.token || data.access_token || data.jwt
      if (token) {
        const res2  = await fetch('https://api.morning.co/v1/documents?type=320&pageSize=3&page=1', {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
        const text2 = await res2.text()
        steps.documentsRequest = { status: res2.status, body: text2.slice(0, 500) }
      }
    }
  } catch (err: any) {
    steps.error = err.message
  }

  return NextResponse.json(steps)
}
