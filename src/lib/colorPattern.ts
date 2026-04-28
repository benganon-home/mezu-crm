// Subtle marble-speckle pattern for swatches/previews.
// Encoded as an inline SVG data URI so it can be set directly via
// React style.backgroundImage without requiring any asset.

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  return (r * 299 + g * 587 + b * 114) / 1000
}

export function dotPatternUrl(hex: string): string {
  // Light dots on dark base, dark dots on light base — keeps the speckles
  // visible regardless of marble shade.
  const dot = luminance(hex) > 160 ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.34)'
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'>` +
    `<circle cx='3'  cy='6'  r='0.7'  fill='${dot}'/>` +
    `<circle cx='22' cy='3'  r='0.5'  fill='${dot}'/>` +
    `<circle cx='14' cy='14' r='0.65' fill='${dot}'/>` +
    `<circle cx='6'  cy='20' r='0.4'  fill='${dot}'/>` +
    `<circle cx='25' cy='22' r='0.7'  fill='${dot}'/>` +
    `<circle cx='18' cy='9'  r='0.35' fill='${dot}'/>` +
    `<circle cx='11' cy='25' r='0.5'  fill='${dot}'/>` +
    `</svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

export function dottedStyle(hex: string, hasDots: boolean | null | undefined): React.CSSProperties {
  if (!hex) return {}
  if (!hasDots) return { background: hex }
  return {
    backgroundColor: hex,
    backgroundImage: dotPatternUrl(hex),
    backgroundRepeat: 'repeat',
  }
}
