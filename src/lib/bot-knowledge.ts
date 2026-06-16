// Business knowledge for the WhatsApp bot: live product catalog (with material
// & care info), available colors, klaf sizes, current promotions, fonts, and an
// editable FAQ block. Grounds the bot so it can answer real customer questions.
// Read-only, service-role client.

import { createClient } from "@supabase/supabase-js";
import { FONTS } from "@/types";
import type { Product, ProductColor } from "@/types";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const STORE_URL = (process.env.NEXT_PUBLIC_STORE_URL || "https://mezu.co.il").replace(/\/$/, "");

// ── Klaf (parchment) size that fits each mezuzah size ──────────────────────
const KLAF_SIZES: Record<string, string> = {
  "16": "קלף 12 ס״מ",
  "18": "קלף 15 ס״מ",
  "24": "קלף 20 ס״מ",
};

function klafText(): string {
  const entries = Object.entries(KLAF_SIZES);
  if (!entries.length) return "";
  return `\n\nמידות קלף למזוזות:\n${entries.map(([s, k]) => `• מזוזה ${s} ס״מ → ${k}`).join("\n")}`;
}

// ── Editable FAQ — fill these in (the bot answers only from what's here) ────
// Leave a value empty ("") and the bot will say it doesn't have that info.
const FAQ: Record<string, string> = {
  "הזמנות": `ניתן להזמין דרך האתר ${STORE_URL}`,
  // "משלוח ומחירו": "",          // עלות משלוח + זמן אספקה + משלוח חינם מעל סכום?
  // "איסוף עצמי": "",            // האם יש איסוף עצמי ומאיפה?
  // "אמצעי תשלום": "",           // אשראי / ביט / פייפאל / תשלומים?
  // "החזרות והחלפות": "",        // מדיניות החזרה/החלפה/אחריות
  // "זמן ייצור": "",             // כמה זמן לוקח לייצר לפני המשלוח?
  // "האם הקלף כלול": "",         // האם המזוזה כוללת קלף? האם הקלף כשר? נמכר בנפרד?
  // "התקנה": "",                 // האם מצורפים ברגים/דבק? איך תולים?
  // "שעות פעילות ויצירת קשר": "",// שעות מענה, טלפון, אינסטגרם
};

function faqText(): string {
  const entries = Object.entries(FAQ).filter(([, v]) => v && v.trim());
  if (!entries.length) return "";
  return `\n\nמידע ושאלות נפוצות:\n${entries.map(([q, a]) => `• ${q}: ${a}`).join("\n")}`;
}

// ── Cache ───────────────────────────────────────────────────────────────────
let cache: { text: string; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function formatProduct(p: Product): string {
  const price = p.sale_price && p.sale_price < p.base_price
    ? `₪${p.sale_price} (במקום ₪${p.base_price})`
    : `מ-₪${p.base_price}`;
  const sizes = Array.isArray(p.sizes) && p.sizes.length
    ? ` | מידות: ${p.sizes.map((s) => `${s.label} ₪${s.price}`).join(", ")}`
    : "";
  const cat = p.category ? ` [${p.category}]` : "";
  const sub = p.subtitle ? ` — ${p.subtitle}` : "";
  const mat = p.materials ? ` | חומר: ${p.materials}` : "";
  const care = p.care_instructions ? ` | תחזוקה: ${p.care_instructions}` : "";
  return `• ${p.name}${cat}${sub}: ${price}${sizes}${mat}${care}`;
}

function formatRule(r: { name: string; conditions: any; discount_type: string; discount_value: number }): string {
  const conds = Array.isArray(r.conditions) ? r.conditions : [];
  const parts = conds.map((c: any) => {
    const cat = c.category ?? "פריט";
    const size = c.size ? ` ${c.size} ס״מ` : "";
    const qty = c.min_qty && c.min_qty > 1 ? ` x${c.min_qty}` : "";
    return `${cat}${size}${qty}`;
  });
  const deal = r.discount_type === "fixed_total"
    ? `יחד ב-₪${r.discount_value}`
    : `${r.discount_value}% הנחה`;
  return `• ${r.name}: ${parts.join(" + ")} ${deal}`;
}

/** A compact Hebrew text block describing everything the bot can use. */
export async function getBusinessKnowledge(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

  const db = admin();
  const [{ data: products }, { data: colors }, { data: rules }] = await Promise.all([
    db.from("products").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    db.from("product_colors").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    db.from("sales_rules").select("name, conditions, discount_type, discount_value").eq("is_active", true),
  ]);

  const prodList = (products ?? []) as Product[];
  const colorList = (colors ?? []) as ProductColor[];
  const ruleList = (rules ?? []) as any[];

  const productsText = prodList.length ? prodList.map(formatProduct).join("\n") : "(אין מוצרים פעילים)";
  const colorsText = colorList.length ? colorList.map((c) => c.name_he).join(", ") : "(אין צבעים מוגדרים)";
  const promosText = ruleList.length ? `\n\nמבצעים פעילים:\n${ruleList.map(formatRule).join("\n")}` : "";
  const fontsText = `\n\nגופנים זמינים להתאמה אישית (לשלטים/מזוזות): ${FONTS.join(", ")} (עברית ואנגלית).`;

  const text =
    `על MEZU: עסק שמייצר פריטי בית מעוצבים בהדפסה תלת-ממדית — מזוזות, שלטי דלת/בית וברכות. ` +
    `אפשר להתאים אישית טקסט ושם. משלוח עם מספר מעקב או איסוף עצמי. אתר: ${STORE_URL}.\n\n` +
    `קטלוג מוצרים (פעילים):\n${productsText}\n\n` +
    `צבעים זמינים: ${colorsText}` +
    klafText() +
    promosText +
    fontsText +
    faqText();

  cache = { text, at: Date.now() };
  return text;
}
