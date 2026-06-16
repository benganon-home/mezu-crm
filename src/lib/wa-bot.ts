// WhatsApp order-status bot: looks up the sender's orders (by their WhatsApp
// number) and uses Claude to answer naturally in Hebrew, grounded in real data.

import Anthropic from "@anthropic-ai/sdk";
import { lookupOrders, type OrderSummary } from "./order-lookup";
import { getBusinessKnowledge } from "./bot-knowledge";
import { toLocalPhone } from "./wa-cloud";
import { formatDateShort } from "./utils";

function extractOrderNumber(text: string): number | null {
  const m = text.match(/\d{3,9}/);
  return m ? parseInt(m[0], 10) : null;
}

function buildContext(name: string | null, orders: OrderSummary[]): string {
  if (!name) return "לא נמצא לקוח עם מספר הטלפון הזה במערכת.";
  if (orders.length === 0) return `לקוח: ${name}. לא נמצאו הזמנות במערכת.`;
  const lines = orders.map((o) => {
    const items = o.items.map((i) => `${i.name} [${i.statusHe}]`).join(", ");
    const ship = o.trackingNumber
      ? `מספר מעקב: ${o.trackingNumber}${o.shippingStatus ? `, סטטוס משלוח: ${o.shippingStatus}` : ""}`
      : "טרם נשלח";
    const dt = o.deliveryType === "pickup" ? "איסוף עצמי" : "משלוח";
    return `הזמנה #${o.orderNumber ?? "—"} (${formatDateShort(o.createdAt)}, ${dt}): ${items}. ${ship}`;
  });
  return `לקוח: ${name}\n${lines.join("\n")}`;
}

const SYSTEM = `את/ה בוט שירות לקוחות של MEZU — עסק שמייצר פריטי בית מעוצבים בהדפסה תלת-ממדית (מזוזות, שלטי דלת/בית, ברכות).
דבר/י בעברית תקנית, נכונה וטבעית, קצרה וחמה, בסגנון WhatsApp (מותר אימוג'י בודד).

חשוב מאוד לגבי השפה:
- כתוב/כתבי עברית מדויקת. אל תפצל/י מילים (למשל "בשבילך", ולא "בשביל יך") ואל תמציא/י מילים שלא קיימות.
- קרא/י שוב את התשובה לפני השליחה כדי לוודא שהעברית טבעית, רציפה ותקינה.

מקורות המידע שלך (השתמש/י אך ורק בהם — אל תמציא/י):
1. נתוני ההזמנות של הלקוח (אם זוהה לפי הטלפון): סטטוס הפריטים, סטטוס המשלוח/מעקב.
2. ידע עסקי: קטלוג מוצרים, מחירים, מידות, צבעים זמינים, ומידע כללי על MEZU.

חוקים:
- לשאלות על מוצרים / מחירים / מידות / צבעים — ענה/י מתוך הידע העסקי שסופק.
- לשאלות על הזמנה / משלוח — ענה/י מתוך נתוני ההזמנות. אם לא זוהו הזמנות למספר הזה: בקש/י בעדינות לוודא שכותבים מהמספר שאיתו בוצעה ההזמנה, או לשלוח מספר הזמנה.
- אם יש כמה הזמנות, סכם/מי בקצרה כל אחת (מספר הזמנה + סטטוס). אם הלקוח שאל על הזמנה מסוימת — התמקד/י בה.
- אם אין לך את המידע — אמור/אמרי בכנות שאין לך אותו ושאפשר לפנות לנציג. אל תמציא/י מחירים, תאריכים, סטטוסים או קישורים.
- אל תבקש/י פרטים אישיים רגישים.`;

export async function botReply(fromWaId: string, text: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  const phone = toLocalPhone(fromWaId);
  const orderNum = extractOrderNumber(text);

  let { customerName, orders } = await lookupOrders(phone, orderNum ?? undefined);
  // If an order number was mentioned but not found for this phone, fall back to all their orders.
  if (orderNum != null && orders.length === 0) {
    const all = await lookupOrders(phone);
    customerName = all.customerName;
    orders = all.orders;
  }

  const context = buildContext(customerName, orders);

  // Without an API key, fall back to a plain templated reply.
  if (!key) {
    if (!customerName) return "שלום! לא מצאנו הזמנות למספר הזה. אנא ודאו שאתם כותבים מהמספר שאיתו בוצעה ההזמנה, או שלחו מספר הזמנה.";
    if (orders.length === 0) return `שלום ${customerName}! לא נמצאו הזמנות במערכת.`;
    return `שלום ${customerName}! 🙂\n${context.split("\n").slice(1).join("\n")}`;
  }

  // Live business knowledge (catalog, prices, colors) so the bot can answer
  // product questions, not just order status.
  let knowledge = "";
  try { knowledge = await getBusinessKnowledge(); } catch { /* non-fatal */ }

  const anthropic = new Anthropic({ apiKey: key });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    temperature: 0.3,
    system: SYSTEM,
    messages: [{
      role: "user",
      content:
        `=== ידע עסקי (קטלוג, מחירים, מידות, צבעים) ===\n${knowledge || "(לא זמין כרגע)"}\n\n` +
        `=== נתוני ההזמנות של הלקוח ===\n${context}\n\n` +
        `=== הודעת הלקוח ===\n"${text}"`,
    }],
  });
  const reply = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  return reply || "מצטערים, לא הצלחנו לעבד את הבקשה כרגע. נסו שוב מאוחר יותר.";
}
