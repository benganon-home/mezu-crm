// Website chat-widget bot. Same brain as the WhatsApp bot (same Claude model,
// same live business knowledge, same catalog/order data) — adapted for an
// ANONYMOUS website visitor:
//   • No sender phone, so order status requires BOTH an order number AND the
//     phone used on the order (verified to match) — prevents enumerating other
//     customers' orders/PII.
//   • No live human on the web, so "talk to a human" points to WhatsApp.
//   • Conversation memory is passed in by the client (stateless server).

import Anthropic from "@anthropic-ai/sdk";
import { findOrders } from "./order-lookup";
import { getBusinessKnowledge } from "./bot-knowledge";
import { toLocalPhone } from "./wa-cloud";
import { formatDateShort } from "./utils";

const WA_LINK = "https://wa.me/972532522822";

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

מעבר לאדם:
- אין נציג אנושי בצ'אט האתר. אם רוצים לדבר עם אדם, או לבקשה מורכבת/רגישה — הפנה/י בעדינות להמשך בוואטסאפ: ${WA_LINK}

כללי זהב:
- אל תבקש/י פרטים אישיים רגישים מעבר לטלפון+מספר הזמנה לצורך בדיקת סטטוס.
- אם אין לך מידע — אמור/אמרי בכנות ושאפשר להמשיך בוואטסאפ.`;

const TOOLS: Anthropic.Tool[] = [
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
    const ship = o.trackingNumber
      ? `מספר מעקב: ${o.trackingNumber}${o.shippingStatus ? `, סטטוס משלוח: ${o.shippingStatus}` : ""}`
      : "טרם נשלח";
    const dt = o.deliveryType === "pickup" ? "איסוף עצמי" : "משלוח";
    const who = g.customerName ? `היי ${g.customerName.split(" ")[0]}! ` : "";
    return `${who}הזמנה #${o.orderNumber ?? "—"} (${formatDateShort(o.createdAt)}, ${dt}): ${items}. ${ship}`;
  } catch {
    return "אירעה שגיאה בבדיקת ההזמנה. נסו שוב או המשיכו בוואטסאפ.";
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Answer a website chat message. `history` is prior turns (client-managed). */
export async function webBotReply(history: ChatTurn[], text: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return `הצ'אט אינו זמין כרגע. אפשר להמשיך בוואטסאפ: ${WA_LINK}`;

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
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    finalText = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    break;
  }
  return finalText || `מצטערים, לא הצלחנו לעבד את הבקשה כרגע. אפשר להמשיך בוואטסאפ: ${WA_LINK}`;
}
