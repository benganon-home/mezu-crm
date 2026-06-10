// MEZU door-sign model presets.
// Values mirror the production .scad files in ~/Desktop/mezu/doorsigns/
// (classic.scad, rock.scad, frame.scad, heart.scad). Keep these in sync with them.

export type ModelId = "classic" | "frame" | "heart";

export interface ModelPreset {
  id: ModelId;
  /** Hebrew display name */
  nameHe: string;
  /** Recess depth in mm */
  depth: number;
  /** SVG scale factor (fallback; normally computed to fit the plate) */
  svgScale: number;
  /** Top-face height in mm (cut starts from the top) */
  zOffset: number;
  baseOffsetX: number;
  baseOffsetY: number;
  /** Target text width on the sign, in mm (text auto-fits to this). */
  targetWidthMM: number;
  /** Max text height on the sign, in mm (clamps tall text). */
  maxHeightMM: number;
  /** Default vertical (Y) nudge of the text on this model, in mm (from the .scad). */
  textOffsetY: number;
}

// All four base plates measure 250 × 100 × 9 mm. Text auto-fits to ~72% width.
export const MODEL_PRESETS: Record<ModelId, ModelPreset> = {
  classic: { id: "classic", nameHe: "קלאסי", depth: 2.1, svgScale: 0.3,  zOffset: 9.0, baseOffsetX: -125, baseOffsetY: -50, targetWidthMM: 205, maxHeightMM: 86, textOffsetY: 0 },
  frame:   { id: "frame",   nameHe: "מסגרת",  depth: 2.1, svgScale: 0.85, zOffset: 5.5, baseOffsetX: -125, baseOffsetY: -50, targetWidthMM: 180, maxHeightMM: 70, textOffsetY: -2 },
  heart:   { id: "heart",   nameHe: "לב",     depth: 2.1, svgScale: 0.9,  zOffset: 9.0, baseOffsetX: -125, baseOffsetY: -50, targetWidthMM: 190, maxHeightMM: 78, textOffsetY: 0 },
};

export const MODEL_IDS = Object.keys(MODEL_PRESETS) as ModelId[];

// Fixed conversion from SVG user units to mm (before the user scale multiplier).
// Sizing is absolute: each line's size directly controls its physical height,
// so lines are independent — making one bigger never shrinks another.
export const UNIT_MM = 0.4;

export function isModelId(v: string): v is ModelId {
  return v in MODEL_PRESETS;
}

/** Parameters that drive a single generation (overridable from the preset via the UI). */
export interface SignParams {
  depth: number;
  svgScale: number;
  zOffset: number;
  baseOffsetX: number;
  baseOffsetY: number;
  /** Vertical (Y) nudge of the text on the sign face, in mm. 0 = centered. */
  textOffsetY: number;
  /** User scale multiplier on top of the auto-fit (1 = fit to sign). Scales about center. */
  userScale: number;
}

export function paramsFromPreset(p: ModelPreset): SignParams {
  return {
    depth: p.depth,
    svgScale: p.svgScale,
    zOffset: p.zOffset,
    baseOffsetX: p.baseOffsetX,
    baseOffsetY: p.baseOffsetY,
    textOffsetY: p.textOffsetY,
    userScale: 1,
  };
}
