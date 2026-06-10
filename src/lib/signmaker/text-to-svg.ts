// Browser-side text → outlined SVG using opentype.js.
// Produces a single black-filled <path> SVG suitable for OpenSCAD import.
// Hebrew is laid out right-to-left (non-cursive, so no contextual shaping needed).

import * as opentype from "opentype.js";

export interface FontDef {
  key: string;
  label: string;
  file: string;
}

// Bundled fonts (public/fonts) — boldest available weight of each, since cut text
// reads best heavy. Ben can drop his own .ttf files here and add entries.
export const FONTS: FontDef[] = [
  // Hebrew (boldest weight)
  { key: "heebo", label: "Heebo — עברית", file: "/signmaker/fonts/Heebo-Black.ttf" },
  { key: "rubik", label: "Rubik — עברית", file: "/signmaker/fonts/Rubik-Black.ttf" },
  { key: "alef", label: "Alef — עברית", file: "/signmaker/fonts/Alef-Bold.ttf" },
  { key: "frank", label: "Frank Ruhl — עברית", file: "/signmaker/fonts/FrankRuhlLibre-Black.ttf" },
  { key: "david", label: "David — עברית", file: "/signmaker/fonts/David.ttf" },
  { key: "suez", label: "Suez One — עברית", file: "/signmaker/fonts/SuezOne-Regular.ttf" },
  { key: "secular", label: "Secular One — עברית", file: "/signmaker/fonts/SecularOne-Regular.ttf" },
  { key: "bonanova", label: "Bona Nova — עברית/EN", file: "/signmaker/fonts/BonaNova-Bold.ttf" },
  { key: "karantina", label: "Karantina — עברית/EN", file: "/signmaker/fonts/Karantina-Bold.ttf" },
  // English (bold / black)
  { key: "montserrat", label: "Montserrat — EN", file: "/signmaker/fonts/Montserrat-Black.ttf" },
  { key: "poppins", label: "Poppins — EN", file: "/signmaker/fonts/Poppins-Black.ttf" },
  { key: "archivo", label: "Archivo Black — EN", file: "/signmaker/fonts/ArchivoBlack-Regular.ttf" },
  { key: "anton", label: "Anton — EN", file: "/signmaker/fonts/Anton-Regular.ttf" },
  { key: "bebas", label: "Bebas Neue — EN", file: "/signmaker/fonts/BebasNeue-Regular.ttf" },
  { key: "playfair", label: "Playfair — EN", file: "/signmaker/fonts/PlayfairDisplay-Black.ttf" },
  { key: "oswald", label: "Oswald — EN", file: "/signmaker/fonts/Oswald-Bold.ttf" },
  { key: "saira", label: "Saira Condensed — EN", file: "/signmaker/fonts/SairaCondensed-Bold.ttf" },
  { key: "barlow", label: "Barlow Condensed — EN", file: "/signmaker/fonts/BarlowCondensed-Bold.ttf" },
];

/** One line of the modular text editor: its own text and (relative) size. */
export interface CreatorLine {
  text: string;
  size: number;
}

export interface CreatorInput {
  lines: CreatorLine[];
  fontKey: string;
  letterSpacing: number;
  /** Gap between lines, as a percent (0–80) of the line's size. */
  lineSpacing: number;
}

const fontCache = new Map<string, opentype.Font>();
const HEBREW = /[֐-׿]/;

export async function loadFont(file: string): Promise<opentype.Font> {
  const cached = fontCache.get(file);
  if (cached) return cached;
  const buf = await fetch(file).then((r) => r.arrayBuffer());
  const font = opentype.parse(buf);
  fontCache.set(file, font);
  return font;
}

interface RunBox {
  d: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Lay out one text run with its left edge at `originX`, baseline at `baselineY`. */
function layoutRun(font: opentype.Font, text: string, size: number, spacing: number, originX: number, baselineY: number): RunBox {
  const scale = size / font.unitsPerEm;
  const ascent = font.ascender * scale;
  const descent = font.descender * scale;
  // Map characters straight through the cmap (charToGlyph) instead of stringToGlyphs,
  // which applies GSUB substitutions that several Hebrew fonts use in a form opentype.js
  // can't parse. Hebrew is non-cursive so we only need RTL ordering + glyph advances.
  const chars = [...text];
  const seq = HEBREW.test(text) ? chars.reverse() : chars;
  let x = originX;
  const parts: string[] = [];
  for (const c of seq) {
    const g = font.charToGlyph(c);
    const gp = g.getPath(x, baselineY, size);
    const data = gp.toPathData(2);
    if (data) parts.push(data);
    x += (g.advanceWidth ?? 0) * scale + spacing;
  }
  const right = x - (seq.length ? spacing : 0);
  return {
    d: parts.join(" "),
    left: originX,
    right,
    top: baselineY - ascent,
    bottom: baselineY - descent,
  };
}

function runWidth(font: opentype.Font, text: string, size: number, spacing: number): number {
  const scale = size / font.unitsPerEm;
  const chars = [...text];
  if (chars.length === 0) return 0;
  let w = 0;
  for (const c of chars) w += (font.charToGlyph(c).advanceWidth ?? 0) * scale + spacing;
  return w - spacing;
}

const EMPTY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>`;

/** Actual inked vertical extent of a line relative to the baseline (y-down). */
function measureInk(font: opentype.Font, text: string, size: number): { top: number; bottom: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of [...text]) {
    if (c === " ") continue;
    const bb = font.charToGlyph(c).getPath(0, 0, size).getBoundingBox();
    if (bb.y1 < minY) minY = bb.y1;
    if (bb.y2 > maxY) maxY = bb.y2;
  }
  if (!isFinite(minY)) return { top: -size * 0.7, bottom: 0 };
  return { top: minY, bottom: maxY };
}

/**
 * Build the outlined SVG by stacking the non-empty lines vertically, centered.
 * Lines are packed by their *actual ink height* (not the font line-box), so the
 * block stays tight — this keeps text large and makes per-line size differences
 * clearly visible instead of being eaten by empty line spacing.
 */
export function buildSvg(font: opentype.Font, input: CreatorInput): string {
  const sp = input.letterSpacing;
  const gapFactor = (input.lineSpacing ?? 22) / 100;
  const lines = input.lines.filter((l) => l.text.trim().length > 0);
  if (lines.length === 0) return EMPTY_SVG;

  const measured = lines.map((l) => ({
    line: l,
    w: runWidth(font, l.text, l.size, sp),
    ink: measureInk(font, l.text, l.size),
  }));
  const totalW = Math.max(...measured.map((m) => m.w));
  const pad = Math.max(...lines.map((l) => l.size)) * 0.12;

  // Lay out in POSITIVE coordinates inside a standard "0 0 W H" viewBox. OpenSCAD's
  // import(center=true) mis-centers SVGs whose viewBox has negative origin, so the
  // cut would land off-center; a positive-origin viewBox centers correctly.
  const parts: string[] = [];
  let cursor = pad; // top of current line's ink (y-down)
  measured.forEach((m, i) => {
    const inkH = m.ink.bottom - m.ink.top;
    const baseline = cursor - m.ink.top; // ink top at `cursor`
    const startX = pad + (totalW - m.w) / 2; // center this line within the block
    const run = layoutRun(font, m.line.text, m.line.size, sp, startX, baseline);
    if (run.d) parts.push(run.d);
    cursor += inkH;
    if (i < measured.length - 1) cursor += m.line.size * gapFactor; // gap to next line
  });

  if (parts.length === 0) return EMPTY_SVG;

  const vw = totalW + pad * 2;
  const vh = cursor + pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}"><path d="${parts.join(" ")}" fill="#000000"/></svg>`;
}
