// WhatsApp order-status bot: looks up the sender's orders (by their WhatsApp
// number) and uses Claude to answer naturally in Hebrew, grounded in real data.

import Anthropic from "@anthropic-ai/sdk";
import { lookupOrders, type OrderSummary } from "./order-lookup";
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

const SYSTEM = `את בוט שירות לקוחות של MEZU — עסק שמייצר פריטי בית מעוצבים בהדפסה תלת-ממדית (מזוזות, שלטי דלת, ברכות).
ענה בעברית, קצר, חם וידידותי, בסגנון WhatsApp (אפשר אימוג'י בודד).
חוקים:
- ענה אך ורק על סמך נתוני ההזמנות שסופקו לך. אל תמציא מידע, תאריכים או סטטוסים.
- אם לא נמצאו הזמנות עבור המספר: בקש בעדינות לוודא שכותבים מהמספר שאיתו בוצעה ההזמנה, או לשלוח מספר הזמנה.
- אם יש כמה הזמנות, סכם בקצרה כל אחת (מספר הזמנה + סטטוס). אם הלקוח שאל על הזמנה מסוימת, התמקד בה.
- ציין סטטוס המשלוח/מעקב אם קיים. אם אין מספר מעקב — אמור שההזמנה עוד לא נשלחה.
- אל תמציא קישורים ואל תבקש פרטים אישיים רגישים.`;

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

  const anthropic = new Anthropic({ apiKey: key });
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: `נתוני ההזמנות של הלקוח:\n${context}\n\nהודעת הלקוח: "${text}"` }],
  });
  const reply = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  return reply || "מצטערים, לא הצלחנו לעבד את הבקשה כרגע. נסו שוב מאוחר יותר.";
}
