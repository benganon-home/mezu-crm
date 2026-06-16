// Business knowledge for the WhatsApp bot: the live product catalog + the
// available colors, pulled from the same DB the CRM/store use. This grounds the
// bot so it can answer "what colors do you have?", "how much is a mezuzah?",
// etc. — read-only, service-role client, no request cookies.

import { createClient } from "@supabase/supabase-js";
import type { Product, ProductColor } from "@/types";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Cache the catalog briefly so a burst of messages doesn't re-query each time.
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
  return `• ${p.name}${cat}${sub}: ${price}${sizes}`;
}

/** A compact Hebrew text block describing the catalog + colors for the bot. */
export async function getBusinessKnowledge(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

  const db = admin();
  const [{ data: products }, { data: colors }] = await Promise.all([
    db.from("products").select("*").eq("is_active", true).order("display_order", { ascending: true }),
    db.from("product_colors").select("*").eq("is_active", true).order("display_order", { ascending: true }),
  ]);

  const prodList = (products ?? []) as Product[];
  const colorList = (colors ?? []) as ProductColor[];

  const productsText = prodList.length
    ? prodList.map(formatProduct).join("\n")
    : "(אין מוצרים פעילים)";

  const colorsText = colorList.length
    ? colorList.map((c) => c.name_he).join(", ")
    : "(אין צבעים מוגדרים)";

  const text =
    `על MEZU: עסק שמייצר פריטי בית מעוצבים בהדפסה תלת-ממדית — מזוזות, שלטי דלת/בית וברכות. משלוח עם מספר מעקב או איסוף עצמי.\n\n` +
    `קטלוג מוצרים (פעילים):\n${productsText}\n\n` +
    `צבעים זמינים: ${colorsText}`;

  cache = { text, at: Date.now() };
  return text;
}
