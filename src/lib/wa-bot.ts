// WhatsApp order-status bot. Uses Claude with:
//  • conversation memory (per wa_id, stored in wa_messages) so it remembers
//    context across messages;
//  • a lookup_orders tool so it can fetch orders by order number, phone, or
//    name — correctly telling them apart;
//  • live business knowledge (catalog, prices, colors, klaf sizes).

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { findOrders, lookupOrders, type CustomerOrders } from "./order-lookup";
import { getBusinessKnowledge } from "./bot-knowledge";
import { toLocalPhone } from "./wa-cloud";
import { formatDateShort } from "./utils";
import { getEffectiveStatus, upsertInbound, escalate, setStatus } from "./wa-conversations";
import { sendHumanAlert } from "./wa-alert";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ─── Conversation memory ──────────────────────────────────────────────────
const HISTORY_LIMIT = 12; // last N messages kept as context

async function loadHistory(waId: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  try {
    const { data } = await admin()
      .from("wa_messages")
      .select("role, content")
      .eq("wa_id", waId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    return ((data ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();
  } catch {
    return [];
  }
}

async function saveMessages(waId: string, entries: { role: "user" | "assistant"; content: string }[]): Promise<void> {
  try {
    await admin().from("wa_messages").insert(entries.map((e) => ({ wa_id: waId, role: e.role, content: e.content })));
  } catch { /* memory is best-effort */ }
}

// ─── Order lookup tool ────────────────────────────────────────────────────
function formatGroups(groups: CustomerOrders[]): string {
  if (!groups.length) return "לא נמצאו הזמנות תואמות.";
  return groups
    .map((g) => {
      const head = `לקוח: ${g.customerName ?? "—"}${g.phone ? ` (${g.phone})` : ""}`;
      if (!g.orders.length) return `${head} — אין הזמנות.`;
      const lines = g.orders.map((o) => {
        const items = o.items.map((i) => `${i.name} [${i.statusHe}]`).join(", ");
        const ship = o.trackingNumber
          ? `מספר מעקב: ${o.trackingNumber}${o.shippingStatus ? `, סטטוס משלוח: ${o.shippingStatus}` : ""}`
          : "טרם נשלח";
        const dt = o.deliveryType === "pickup" ? "איסוף עצמי" : "משלוח";
        return `הזמנה #${o.orderNumber ?? "—"} (${formatDateShort(o.createdAt)}, ${dt}): ${items}. ${ship}`;
      });
      return `${head}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

async function runLookup(input: any, senderPhone: string): Promise<string> {
  const rawNum = input?.order_number ? String(input.order_number).replace(/\D/g, "") : "";
  const orderNumber = rawNum ? parseInt(rawNum, 10) : null;

  let opts: { orderNumber?: number | null; phone?: string | null; name?: string | null };
  if (orderNumber) opts = { orderNumber };
  else if (input?.phone) opts = { phone: String(input.phone) };
  else if (input?.name) opts = { name: String(input.name) };
  else opts = { phone: senderPhone }; // "my order" → use the sender's own number

  try {
    return formatGroups(await findOrders(opts));
  } catch {
    return "אירעה שגיאה בחיפוש ההזמנות.";
  }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_orders",
    description:
      "חיפוש הזמנות במערכת MEZU. ספק/י לפחות אחד מהשדות: order_number, phone או name. " +
      "אם הלקוח שואל על 'ההזמנה שלי' בלי לפרט פרטים — קרא/י לכלי בלי שדות, והוא יחפש לפי הטלפון של השולח.",
    input_schema: {
      type: "object",
      properties: {
        order_number: { type: "string", description: "מספר הזמנה (ספרות בלבד)" },
        phone: { type: "string", description: "מספר טלפון של הלקוח (למשל 0541234567)" },
        name: { type: "string", description: "שם הלקוח, מלא או חלקי" },
      },
    },
  },
  {
    name: "escalate_to_human",
    description:
      "העבר/י את השיחה לנציג אנושי. השתמש/י בזה כאשר: הלקוח מבקש במפורש לדבר עם אדם/נציג; " +
      "או שמדובר בתלונה, בעיה רגישה, בקשה מיוחדת או משהו שאינך יכול/ה לפתור מהמידע הקיים. " +
      "לאחר הקריאה — הודע/י ללקוח בעדינות שנציג יחזור אליו בהקדם.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "סיבת ההעברה בקצרה (לשימוש פנימי)" },
      },
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────
const SYSTEM = `את/ה נציג/ת ה-AI של MEZU — עסק שמייצר פריטי בית מעוצבים בהדפסה תלת-ממדית (מזוזות, שלטי דלת/בית, ברכות). את/ה יודע/ת לענות על רוב השאלות של הלקוחות.
דבר/י בעברית תקנית, נכונה וטבעית, קצרה וחמה.

הצגה עצמית:
- בהודעה הראשונה בשיחה הצג/י את עצמך בקצרה: נציג/ת ה-AI של MEZU שישמח/תשמח לעזור ולענות על רוב השאלות — ואז שאל/י במה אפשר לעזור. אל תחזור/חזרי על ההצגה בהודעות הבאות.

סגנון ומיתוג (חשוב מאוד):
- אל תשתמש/י בכוכביות (*) או בכל סימון אחר (Markdown). כתוב/כתבי טקסט רגיל בלבד, ללא הדגשות בכוכביות.
- שמור/שמרי על אווירה נקייה, קלאסית ואלגנטית. השתמש/י באימוג'ים עדינים ומעודנים בלבד, במשורה (אחד עד שניים בהודעה לכל היותר), כמו 🤍 🌸 🌷 ✨ — להרגשה רגועה ויוקרתית. הימנע/י מאימוג'ים רועשים או ילדותיים.

חשוב מאוד לגבי השפה:
- כתוב/כתבי עברית מדויקת. אל תפצל/י מילים (למשל "בשבילך", ולא "בשביל יך") ואל תמציא/י מילים שלא קיימות.
- קרא/י שוב את התשובה לפני השליחה כדי לוודא שהעברית טבעית, רציפה ותקינה.

זיכרון שיחה:
- יש לך היסטוריית ההודעות בשיחה הזו. השתמש/י בהקשר — אם הלקוח שאל קודם על מזוזה והמשיך לשאול "ולאיזה גודל קלף מתאים?", זכור/זכרי שמדובר במזוזה ואל תתחיל/י מחדש.

חיפוש הזמנות (כלי lookup_orders):
- לשאלות על סטטוס הזמנה/משלוח — השתמש/י בכלי lookup_orders.
- אם הלקוח נתן מספר הזמנה → העבר order_number. אם נתן מספר טלפון → העבר phone. אם נתן שם → העבר name.
- אם הלקוח שואל על "ההזמנה שלי" בלי לפרט — קרא/י לכלי בלי שדות (יחפש לפי הטלפון של השולח).
- אם נמצאו כמה לקוחות עם אותו שם — בקש/י פרט מזהה נוסף (טלפון או מספר הזמנה).
- אם לא נמצא דבר — אמור/אמרי זאת בעדינות ובקש/י מספר הזמנה או הטלפון שאיתו בוצעה ההזמנה.

מוצרים/מחירים/צבעים/מידות:
- ענה/י מתוך הידע העסקי שסופק לך בלבד.

עיצוב אישי ובקשות מיוחדות:
- אם הלקוח/ה מבקש/ת עיצוב מותאם אישית שאינו מופיע באפשרויות הרגילות (למשל שני טקסטים שונים על שלט דלת, גופן מיוחד, או כל בקשת עיצוב אחרת) — הסבר/י בעדינות: לכתוב את שם המשפחה בשדה הטקסט של השלט, ולהוסיף את כל פרטי העיצוב הנוספים בשדה "הערות" בשלב התשלום — ואנחנו ניצור קשר ונעזור להשלים את העיצוב יחד. 🤍

כללי זהב:
- ענה/י אך ורק על סמך הידע העסקי ותוצאות הכלי. אל תמציא/י מחירים, מידות, תאריכים, סטטוסים או קישורים.
- אם אין לך מידע — אמור/אמרי בכנות שאין לך אותו ושאפשר לפנות לנציג אנושי.
- אל תבקש/י פרטים אישיים רגישים.`;

/** Short "take me back to the AI rep" message (used to leave human-handoff mode). */
function isReturnToBot(text: string): boolean {
  const t = (text || "").trim();
  if (t.length > 24) return false;
  return /בוט/.test(t) || /חזרה לנציג|חזרה לצ['׳]?אט/.test(t);
}

export async function botReply(fromWaId: string, text: string, senderName?: string | null): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  const senderPhone = toLocalPhone(fromWaId);

  // Conversation state: if a human is handling (or it's already escalated), the
  // bot stays silent so it doesn't talk over the owner. Record the message and
  // flag it unread so it surfaces in the CRM inbox.
  const status = await getEffectiveStatus(fromWaId);

  // Let the customer leave human-handoff mode and return to the AI rep by
  // sending a short "בוט" / "חזרה לבוט" message.
  if (status !== "bot" && isReturnToBot(text)) {
    await setStatus(fromWaId, "bot");
    await upsertInbound(fromWaId, text, senderName ?? null, false);
    const reply = "חזרתם לשיחה עם נציג ה-AI של MEZU 🤍 במה אפשר לעזור?";
    await saveMessages(fromWaId, [
      { role: "user", content: text },
      { role: "assistant", content: reply },
    ]);
    return reply;
  }

  await upsertInbound(fromWaId, text, senderName ?? null, status !== "bot");
  if (status !== "bot") return null;

  // Without an API key, fall back to a plain templated reply (sender's orders).
  if (!key) {
    const { customerName, orders } = await lookupOrders(senderPhone);
    if (!customerName) return "שלום! לא מצאנו הזמנות למספר הזה. אנא ודאו שאתם כותבים מהמספר שאיתו בוצעה ההזמנה, או שלחו מספר הזמנה.";
    if (orders.length === 0) return `שלום ${customerName}! לא נמצאו הזמנות במערכת.`;
    return `שלום ${customerName}! 🙂 נמצאו ${orders.length} הזמנות. לפרטים מלאים נסו שוב מאוחר יותר.`;
  }

  let knowledge = "";
  try { knowledge = await getBusinessKnowledge(); } catch { /* non-fatal */ }
  const history = await loadHistory(fromWaId);

  const isFirstMessage = history.length === 0;
  const system =
    `${SYSTEM}\n\n` +
    (isFirstMessage
      ? `זוהי ההודעה הראשונה בשיחה — פתח/י בהצגה עצמית קצרה כנציג/ת ה-AI של MEZU.\n\n`
      : `זו אינה ההודעה הראשונה בשיחה — אל תציג/י את עצמך שוב.\n\n`) +
    `מידע להקשר: מספר הטלפון של מי שכותב/ת כעת הוא ${senderPhone}.\n\n` +
    `=== ידע עסקי (קטלוג, מחירים, מידות, צבעים, קלף) ===\n${knowledge || "(לא זמין כרגע)"}`;

  const anthropic = new Anthropic({ apiKey: key });
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: text }];

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
        if (block.type === "tool_use" && block.name === "lookup_orders") {
          results.push({ type: "tool_result", tool_use_id: block.id, content: await runLookup(block.input, senderPhone) });
        } else if (block.type === "tool_use" && block.name === "escalate_to_human") {
          // Flag for a human, alert the owner, and let the model write the
          // hand-off message to the customer in the same turn.
          await escalate(fromWaId);
          await sendHumanAlert(fromWaId, senderName ?? null, text);
          results.push({ type: "tool_result", tool_use_id: block.id, content: "השיחה סומנה והועברה לנציג אנושי. הודע/י ללקוח בעדינות שניצור קשר בהקדם, וציין/י שבכל רגע אפשר לחזור לשיחה עם נציג ה-AI על-ידי כתיבת \"בוט\"." });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    finalText = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    break;
  }

  finalText = finalText || "מצטערים, לא הצלחנו לעבד את הבקשה כרגע. נסו שוב מאוחר יותר.";

  // Persist this turn to memory (plain text only — keeps history light).
  await saveMessages(fromWaId, [
    { role: "user", content: text },
    { role: "assistant", content: finalText },
  ]);

  return finalText;
}
