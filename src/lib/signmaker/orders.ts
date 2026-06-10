// Maps incoming CRM door-sign orders → SignMaker generation parameters.

import type { ModelId } from "./models";
import type { CreatorLine } from "./text-to-svg";

export interface OrderJob {
  orderId: string;
  orderNumber: number | null;
  customer: string;
  createdAt: string;
  signType: string; // raw item_name (e.g. "מסגרת")
  modelId: ModelId;
  font: string | null; // raw font name from the order
  fontKey: string; // mapped SignMaker font key
  signText: string; // raw sign_text (may contain \n)
  lines: CreatorLine[]; // mapped to creator rows (main row biggest)
  color: string | null;
  itemStatus: string;
}

/** Sign type / item name → SignMaker model. Mirrors the CRM SIGN_MAP outputs. */
export function signTypeToModelId(itemName: string | null | undefined): ModelId {
  const n = itemName || "";
  if (n.includes("מסגרת")) return "frame";
  if (n.includes("לב")) return "heart";
  return "classic"; // קלאסי / default
}

/** Order font name → bundled SignMaker font key (falls back to Heebo). */
export function fontNameToKey(font: string | null | undefined): string {
  const f = (font || "").toLowerCase();
  if (f.includes("rubik")) return "rubik";
  if (f.includes("bona")) return "bonanova";
  if (f.includes("frank")) return "frank";
  if (f.includes("alef")) return "alef";
  if (f.includes("david")) return "david";
  if (f.includes("karantina")) return "karantina";
  if (f.includes("oswald")) return "oswald";
  if (f.includes("saira")) return "saira";
  if (f.includes("barlow")) return "barlow";
  if (f.includes("bebas")) return "bebas";
  if (f.includes("montserrat")) return "montserrat";
  if (f.includes("poppins")) return "poppins";
  if (f.includes("playfair")) return "playfair";
  if (f.includes("anton")) return "anton";
  if (f.includes("archivo")) return "archivo";
  if (f.includes("suez")) return "suez";
  if (f.includes("secular")) return "secular";
  return "heebo";
}

/**
 * sign_text → creator rows. The CRM emits 1 line (just the name) or 2 lines
 * ("משפחת\n{name}"). Maps to the editor's layout: row 2 is the main/biggest line.
 */
export function signTextToLines(signText: string | null | undefined): CreatorLine[] {
  const parts = (signText || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return [{ text: "", size: 100 }];
  if (parts.length === 1) return [{ text: parts[0], size: 100 }];
  if (parts.length === 2) {
    // e.g. ["משפחת", "כהן"] → top small, name big
    return [
      { text: parts[0], size: 55 },
      { text: parts[1], size: 100 },
    ];
  }
  // 3+ lines: top / main / bottom (take first three)
  return [
    { text: parts[0], size: 55 },
    { text: parts[1], size: 100 },
    { text: parts[2], size: 45 },
  ];
}
