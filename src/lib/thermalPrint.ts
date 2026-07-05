// Client-side helper to print shipping labels on the local BLE thermal printer.
//
// A small print agent runs on the user's Mac (the one paired to the Bluetooth
// label printer): ~/label-printer/agent  (listens on http://127.0.0.1:17777).
// The browser fetches the label PDF from mezu-crm (same-origin, authenticated),
// then POSTs the PDF bytes to the agent, which prints each page as one 60x80
// thermal label. Works in Chrome (loopback is allowed even from an https page).

const AGENT = 'http://127.0.0.1:17777'

export interface ThermalResult {
  ok: boolean
  labels?: number
  error?: string
  agentDown?: boolean
}

/** Is the local print agent running? */
export async function isThermalAgentUp(): Promise<boolean> {
  try {
    const r = await fetch(`${AGENT}/health`, { signal: AbortSignal.timeout(1500) })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Fetch a label PDF (by same-origin URL) and print it on the thermal printer.
 * @param labelPdfUrl e.g. `/api/shipments/${tracking}/label`
 */
export async function printLabelThermal(
  labelPdfUrl: string,
  opts: { size?: string; rotate?: number; mode?: 'pages' | 'sheet' } = {},
): Promise<ThermalResult> {
  // 1) get the label PDF from mezu-crm
  let pdf: Blob
  try {
    const res = await fetch(labelPdfUrl)
    if (!res.ok) return { ok: false, error: `שגיאה בטעינת תווית (${res.status})` }
    pdf = await res.blob()
  } catch (e: any) {
    return { ok: false, error: `שגיאה בטעינת תווית: ${e.message}` }
  }

  // 2) send it to the local print agent
  const size = opts.size ?? '60x80'
  const rotate = opts.rotate ?? 90
  const mode = opts.mode ?? 'pages'
  try {
    const res = await fetch(`${AGENT}/print?size=${size}&rotate=${rotate}&mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdf,
    })
    const j = (await res.json().catch(() => ({}))) as ThermalResult
    if (!res.ok) return { ok: false, error: j.error || `שגיאת מדפסת (${res.status})` }
    return j
  } catch {
    // network error usually means the agent isn't running
    return {
      ok: false,
      agentDown: true,
      error: 'המדפסת התרמית לא זמינה. הפעל את ה-agent במחשב: ~/label-printer/agent',
    }
  }
}
