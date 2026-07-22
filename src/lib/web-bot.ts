// Website chat-widget bot. Same brain as the WhatsApp bot (same Claude model,
// same live business knowledge, same catalog/order data) — adapted for an
// ANONYMOUS website visitor:
//   • No sender phone, so order status requires BOTH an order number AND the
//     phone used on the order (verified to match) — prevents enumerating other
//     customers' orders/PII.
//   • No live human on the web, so "talk to a human" points to WhatsApp.
//   • Conversation memory is passed in by the client (stateless server).

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { findOrders } from "./order-lookup";
import { getBusinessKnowledge } from "./bot-knowledge";
import { toLocalPhone } from "./wa-cloud";
import { formatDateShort } from "./utils";

const WA_LINK = "https://wa.me/972532522822";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const SYSTEM = `את/ה נציג/ת ה-AI של MEZU (מזו) — עסק שמייצר פריטי בית מעוצבים בהדפסה תלת-ממדית (מזוזות, שלטי דלת/בית, ברכות). את/ה עונה על רוב שאלות הלקוחות באתר.
דבר/י בעברית תקנית, נכונה וטבעית, קצרה וחמה.

סגנון:
- אל תשתמש/י בכוכביות (*) או בסימוני Markdown. טקסט רגיל בלבד.
- אווירה נקייה, קלאסית ואלגנטית. אימוג'ים עדינים במשורה (🤍 🌸 ✨), לא רועשים.

מוצרים/מחירים/צבעים/מידות/קלף:
- ענה/י אך ורק מתוך הידע העסקי שסופק לך. אל תמציא/י מחירים, מידות, תאריכים או קישורים.

עיצוב אישי ובקשות מיוחדות:
- אם מבקשים עיצוב מותאם (למשל שני טקסטים שונים על שלט) — הסבר/י: לכתוב את שם המשפחה בשדה הטקסט של השלט, ולהוסיף את פרטי העיצוב הנוספים בשדה "הערות" בשלב התשלום, ואנחנו ניצור קשר ונעזור. 🤍

סטטוס הזמנה (כלי lookup_order):
- המבקר/ת באתר אנונימי/ת. כדי לבדוק סטטוס הזמנה חובה לקבל גם מספר הזמנה וגם את הטלפון שאיתו בוצעה ההזמנה.
- אם חסר אחד מהם — בקש/י בעדינות את שניהם לפני הבדיקה. אל תמציא/י סטטוסים.

זמני אספקה:
- ספירת ימי העסקים למשלוח מתחילה מהיום שלמחרת ביצוע ההזמנה — יום ביצוע ההזמנה עצמו לא נספר, וכן לא שישי-שבת וחגים.

איסוף עצמי:
- נקודות האיסוף: חיפה, רמת ישי, ומגדלי אלון בתל אביב. האיסוף ללא עלות.
- כשלקוח שואל על איסוף עצמי — שאל/י מאיזו נקודה יהיה לו נוח לאסוף (חיפה / רמת ישי / מגדלי אלון תל אביב).
- אם יש ללקוח הזמנה קיימת — בדוק/בדקי את הסטטוס שלה (עם מספר הזמנה + טלפון): אם כל הפריטים מוכנים — עדכן/י שההזמנה מוכנה ושניצור קשר לתיאום האיסוף; אם עדיין בהכנה — עדכן/י שההזמנה עדיין בייצור ושניצור קשר לתיאום ברגע שתהיה מוכנה.
- אל תקבע/י בעצמך מועד איסוף — התיאום נעשה על ידי נציג אנושי.

הצגת מוצרים (כלי show_products):
- כשאת/ה ממליץ/ה על מוצרים ספציפיים או שהלקוח שואל על מוצר/קטגוריה — קרא/י לכלי show_products. מתחת להודעה שלך יוצגו ללקוח כרטיסי מוצר עם תמונה, מחיר, קישור למוצר וכפתור הוספה לעגלה.
- אחרי הקריאה לכלי, כתוב/כתבי משפט קצר ומזמין (למשל "הנה כמה אפשרויות שיתאימו לך 🤍") — אל תחזור/תחזרי על המחירים והפרטים בטקסט, הכרטיסים כבר מציגים אותם.
- אל תדביק/י קישורים בטקסט — הכרטיסים הם הדרך להפנות למוצר.

מעבר לאדם:
- אין נציג אנושי בצ'אט האתר. אם רוצים לדבר עם אדם, או לבקשה מורכבת/רגישה — הפנה/י בעדינות להמשך בוואטסאפ: ${WA_LINK}

כללי זהב:
- אל תבקש/י פרטים אישיים רגישים מעבר לטלפון+מספר הזמנה לצורך בדיקת סטטוס.
- אם אין לך מידע — אמור/אמרי בכנות ושאפשר להמשיך בוואטסאפ.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "show_products",
    description:
      "הצגת כרטיסי מוצר ללקוח בצ'אט (תמונה, מחיר, קישור וכפתור הוספה לעגלה). " +
      "ספק/י names (שמות מוצרים מהקטלוג, מדויקים או חלקיים) או category. עד 3 מוצרים.",
    input_schema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, description: "שמות מוצרים מהידע העסקי (חלקי מספיק)" },
        category: { type: "string", description: "קטגוריה: מזוזות / שלטי בית / ברכות / אקססוריז" },
      },
    },
  },
  {
    name: "lookup_order",
    description:
      "בדיקת סטטוס הזמנה עבור מבקר אתר אנונימי. חובה לספק גם order_number וגם phone " +
      "(הטלפון שאיתו בוצעה ההזמנה). אם אחד מהם חסר — אל תקרא/י לכלי; בקש/י מהלקוח את שניהם.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "מספר הזמנה (ספרות)" },
        phone: { type: "string", description: "טלפון שאיתו בוצעה ההזמנה" },
      },
    },
  },
];

/** Secure order lookup: requires order_number AND a matching phone. Returns
 * minimal status only — never an address, and never anything without a match. */
async function runWebLookup(input: any): Promise<string> {
  const rawNum = input?.order_number ? String(input.order_number).replace(/\D/g, "") : "";
  const orderNumber = rawNum ? parseInt(rawNum, 10) : null;
  const phone = input?.phone ? String(input.phone) : "";
  if (!orderNumber || !phone.trim()) {
    return "צריך גם מספר הזמנה וגם את הטלפון שאיתו בוצעה ההזמנה כדי לבדוק סטטוס 🙏";
  }
  try {
    const groups = await findOrders({ orderNumber });
    const g = groups[0];
    if (!g || !g.orders.length) return "לא נמצאה הזמנה עם המספר הזה. בדקו את המספר ונסו שוב.";
    // Verify the provided phone matches the order's customer — blocks enumeration.
    if (toLocalPhone(g.phone || "") !== toLocalPhone(phone)) {
      return "הפרטים לא תואמים. ודאו שמספר ההזמנה והטלפון נכונים, או המשיכו בוואטסאפ.";
    }
    const o = g.orders[0];
    const items = o.items.map((i) => `${i.name} [${i.statusHe}]`).join(", ");
    const allReady = o.items.length > 0 && o.items.every((i) => i.statusHe === "מוכן" || i.statusHe === "נשלח");
    const ship = o.deliveryType === "pickup"
      ? (allReady ? "ההזמנה מוכנה לאיסוף — ניצור קשר לתיאום" : "איסוף עצמי — ניצור קשר לתיאום כשההזמנה תהיה מוכנה")
      : o.trackingNumber
        ? `מספר מעקב: ${o.trackingNumber}${o.shippingStatus ? `, סטטוס משלוח: ${o.shippingStatus}` : ""}`
        : "טרם נשלח";
    const dt = o.deliveryType === "pickup" ? "איסוף עצמי" : "משלוח";
    const who = g.customerName ? `היי ${g.customerName.split(" ")[0]}! ` : "";
    return `${who}הזמנה #${o.orderNumber ?? "—"} (${formatDateShort(o.createdAt)}, ${dt}): ${items}. ${ship}`;
  } catch {
    return "אירעה שגיאה בבדיקת ההזמנה. נסו שוב או המשיכו בוואטסאפ.";
  }
}

// ─── Product cards ─────────────────────────────────────────────────────────
// The widget renders these under the bot's message. The payload mirrors the
// products row closely enough for the storefront's QuickAddModal to work.
export interface ChatProduct {
  id: string;
  slug: string | null;
  name: string;
  subtitle: string | null;
  category: string | null;
  base_price: number;
  sale_price: number | null;
  sizes: { label: string; price: number }[] | null;
  images: string[] | null;
  image_colors: string[] | null;
  colors: string[] | null;
  has_apartment_number: boolean | null;
}

const CARD_COLUMNS =
  "id, slug, name, subtitle, category, base_price, sale_price, sizes, images, image_colors, colors, has_apartment_number";

const normalize = (s: string) => (s || "").replace(/["'״׳\-–—]/g, "").replace(/\s+/g, " ").trim();

/** Match catalog products for show_products: by (partial) names and/or category. */
async function runShowProducts(input: any, out: ChatProduct[]): Promise<string> {
  try {
    const { data } = await admin()
      .from("products")
      .select(CARD_COLUMNS)
      .eq("is_active", true)
      .order("display_order");
    const all = (data ?? []) as ChatProduct[];

    const names: string[] = Array.isArray(input?.names) ? input.names.map(String) : [];
    const category = input?.category ? normalize(String(input.category)) : "";

    let matched: ChatProduct[] = [];
    for (const n of names) {
      const q = normalize(n);
      if (!q) continue;
      const hit = all.find((p) => normalize(p.name).includes(q) || q.includes(normalize(p.name)));
      if (hit) matched.push(hit);
    }
    if (category) {
      matched.push(...all.filter((p) => normalize(p.category || "").includes(category)));
    }
    // Dedupe (by id), respect prior cards in this reply, cap at 3 per call / 4 total.
    matched = matched.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
      .filter((p) => !out.some((x) => x.id === p.id))
      .slice(0, Math.max(0, Math.min(3, 4 - out.length)));

    if (!matched.length) return "לא נמצאו מוצרים תואמים בקטלוג. אל תציג/י כרטיסים — ענה/י בטקסט מתוך הידע העסקי.";
    out.push(...matched);
    return `כרטיסי המוצרים הבאים יוצגו ללקוח מתחת להודעה שלך: ${matched.map((p) => p.name).join(", ")}. אין צורך לחזור על מחירים או קישורים.`;
  } catch {
    return "אירעה שגיאה בשליפת המוצרים. ענה/י בטקסט מתוך הידע העסקי.";
  }
}

// Brand style forbids Markdown, but the model still slips **bold** in
// occasionally — strip it deterministically instead of trusting the prompt.
export function stripMarkdown(s: string): string {
  return s.replace(/\*+/g, "").replace(/^#+\s*/gm, "");
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export interface WebBotResult {
  text: string;
  products: ChatProduct[];
}

/** Answer a website chat message. `history` is prior turns (client-managed). */
export async function webBotReply(history: ChatTurn[], text: string): Promise<WebBotResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  const products: ChatProduct[] = [];
  if (!key) return { text: `הצ'אט אינו זמין כרגע. אפשר להמשיך בוואטסאפ: ${WA_LINK}`, products };

  let knowledge = "";
  try { knowledge = await getBusinessKnowledge(); } catch { /* non-fatal */ }

  const system = `${SYSTEM}\n\n=== ידע עסקי (קטלוג, מחירים, מידות, צבעים, קלף) ===\n${knowledge || "(לא זמין כרגע)"}`;
  const anthropic = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: text }];

  let finalText = "";
  for (let turn = 0; turn < 4; turn++) {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      temperature: 0.3,
      system,
      tools: TOOLS,
      messages,
    });
    if (resp.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: resp.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type === "tool_use" && block.name === "lookup_order") {
          results.push({ type: "tool_result", tool_use_id: block.id, content: await runWebLookup(block.input) });
        } else if (block.type === "tool_use" && block.name === "show_products") {
          results.push({ type: "tool_result", tool_use_id: block.id, content: await runShowProducts(block.input, products) });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    finalText = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    break;
  }
  return {
    text: stripMarkdown(finalText) || `מצטערים, לא הצלחנו לעבד את הבקשה כרגע. אפשר להמשיך בוואטסאפ: ${WA_LINK}`,
    products,
  };
}
