// Browser-side text → outlined SVG using opentype.js.
// Produces a single black-filled <path> SVG suitable for OpenSCAD import.
// Hebrew is laid out right-to-left (non-cursive, so no contextual shaping needed).

import * as opentype from "opentype.js";
import polygonClipping from "polygon-clipping";

type Ring = [number, number][];

// Flatten an opentype glyph path into polygon rings (beziers → line segments).
function flattenGlyph(commands: opentype.PathCommand[]): Ring[] {
  const rings: Ring[] = [];
  let cur: Ring = [];
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0;
  const quad = (x1: number, y1: number, x: number, y: number) => {
    for (let i = 1; i <= 10; i++) {
      const t = i / 10,
        mt = 1 - t;
      cur.push([mt * mt * cx + 2 * mt * t * x1 + t * t * x, mt * mt * cy + 2 * mt * t * y1 + t * t * y]);
    }
    cx = x;
    cy = y;
  };
  const cube = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    for (let i = 1; i <= 12; i++) {
      const t = i / 12,
        mt = 1 - t;
      cur.push([
        mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x,
        mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y,
      ]);
    }
    cx = x;
    cy = y;
  };
  for (const c of commands) {
    if (c.type === "M") {
      if (cur.length > 2) rings.push(cur);
      cur = [[c.x, c.y]];
      cx = sx = c.x;
      cy = sy = c.y;
    } else if (c.type === "L") {
      cur.push([c.x, c.y]);
      cx = c.x;
      cy = c.y;
    } else if (c.type === "Q") {
      quad(c.x1, c.y1, c.x, c.y);
    } else if (c.type === "C") {
      cube(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    } else if (c.type === "Z") {
      if (cur.length > 2) rings.push(cur);
      cur = [];
      cx = sx;
      cy = sy;
    }
  }
  if (cur.length > 2) rings.push(cur);
  return rings;
}

function signedArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Resolve a glyph to clean, non-overlapping polygons using a NONZERO fill
 * (positive contours = fills, negative = holes), then emit as SVG path data.
 * OpenSCAD imports SVG with EVEN-ODD, which rings glyphs whose solid sub-parts
 * are geometrically nested (e.g. Karantina) — resolving to clean nonzero polygons
 * makes even-odd render them solid, for every font.
 */
function resolveGlyphPath(gp: opentype.Path): string {
  const rings = flattenGlyph(gp.commands);
  const pos: Ring[][] = [];
  const neg: Ring[][] = [];
  for (const r of rings) {
    const a = signedArea(r);
    if (Math.abs(a) < 0.01) continue;
    (a > 0 ? pos : neg).push([r]);
  }
  if (pos.length === 0) return gp.toPathData(2);
  try {
    let res = polygonClipping.union(pos[0], ...pos.slice(1));
    if (neg.length) res = polygonClipping.difference(res, ...neg);
    let d = "";
    for (const poly of res) for (const ring of poly) d += "M" + ring.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join("L") + "Z";
    return d || gp.toPathData(2);
  } catch {
    return gp.toPathData(2); // fall back to raw outline on any clipping error
  }
}

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
  glyphs: string[]; // per-glyph path data (kept separate for correct SVG hole detection)
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
    const data = resolveGlyphPath(gp); // nonzero-resolved → renders solid in OpenSCAD
    if (data) parts.push(data);
    x += (g.advanceWidth ?? 0) * scale + spacing;
  }
  const right = x - (seq.length ? spacing : 0);
  return {
    d: parts.join(" "),
    glyphs: parts,
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
export function buildSvg(font: opentype.Font, input: CreatorInput, opts?: { perGlyph?: boolean }): string {
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
    parts.push(...run.glyphs);
    cursor += inkH;
    if (i < measured.length - 1) cursor += m.line.size * gapFactor; // gap to next line
  });

  if (parts.length === 0) return EMPTY_SVG;

  const vw = totalW + pad * 2;
  const vh = cursor + pad;
  // Generation (default): ONE combined path with nonzero fill — OpenSCAD recesses
  //   the full letter bodies (per-glyph paths make serif fonts cut as outlines only).
  // Preview (perGlyph:true): one <path> per glyph — three.js SVGLoader detects each
  //   glyph's holes correctly (a combined path makes it nest glyphs → garbled mesh).
  const body = opts?.perGlyph
    ? parts.map((d) => `<path d="${d}" fill="#000000"/>`).join("")
    : `<path d="${parts.join(" ")}" fill="#000000"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}">${body}</svg>`;
}
