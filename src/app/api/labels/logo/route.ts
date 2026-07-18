import { PDFDocument, rgb } from 'pdf-lib'
import { MEZU_LOGO } from '@/lib/mezuLogoPaths'

// GET /api/labels/logo?label=60x40&w=34.5&dx=0&dy=0
// Returns a single-page PDF sized to the sticker (default 60x40 mm) with the
// MEZU wordmark centered, at a fixed width (default 34.5 mm) — for the thermal
// print agent. Print this with trim OFF so the whitespace is preserved and the
// logo keeps its size (see /api/labels/thermal for the trim=1 default).
// dx/dy (mm) nudge the logo from center to correct physical printer offset:
// +dx = right, +dy = down.
export const dynamic = 'force-dynamic'

const MM_TO_PT = 72 / 25.4

function parseDims(label: string, fallback: [number, number]): [number, number] {
  const m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(label.trim().toLowerCase())
  if (!m) return fallback
  return [parseFloat(m[1]), parseFloat(m[2])]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const [labelWmm, labelHmm] = parseDims(url.searchParams.get('label') || '', [60, 40])
  const logoWmm = Math.min(
    Number(url.searchParams.get('w')) || 34.5,
    labelWmm, // never wider than the sticker
  )
  const dx = (Number(url.searchParams.get('dx')) || 0) * MM_TO_PT // + = right
  const dy = (Number(url.searchParams.get('dy')) || 0) * MM_TO_PT // + = down
  const qty = Math.min(Math.max(Math.round(Number(url.searchParams.get('qty')) || 1), 1), 50)

  const pageW = labelWmm * MM_TO_PT
  const pageH = labelHmm * MM_TO_PT
  const logoW = logoWmm * MM_TO_PT
  const scale = logoW / MEZU_LOGO.width
  const logoH = MEZU_LOGO.height * scale

  // Center both axes, then apply the dx/dy nudge. drawSvgPath places the SVG
  // origin (top-left, y-down) at (x, y) and draws downward, so y = top edge.
  const x = (pageW - logoW) / 2 + dx
  const yTop = pageH - (pageH - logoH) / 2 - dy

  const pdf = await PDFDocument.create()
  // One page per sticker — the print agent prints each page as one label.
  for (let i = 0; i < qty; i++) {
    const page = pdf.addPage([pageW, pageH])
    for (const d of MEZU_LOGO.paths) {
      page.drawSvgPath(d, { x, y: yTop, scale, color: rgb(0, 0, 0) })
    }
  }

  const bytes = await pdf.save()
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="mezu-logo-${labelWmm}x${labelHmm}.pdf"`,
    },
  })
}
