// WhatsApp Cloud API helpers (send messages + verify webhook signature).

import crypto from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Normalize any phone (wa_id like 972501234567, or local) to the DB form 0XXXXXXXXX. */
export function toLocalPhone(raw: string): string {
  return (raw || "").replace(/\D/g, "").replace(/^972/, "0");
}

/** Send a plain-text WhatsApp message to a wa_id (e.g. "972501234567"). */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error("WhatsApp env missing (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
    return;
  }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body },
    }),
  });
  if (!res.ok) console.error("WhatsApp send failed", res.status, await res.text().catch(() => ""));
}

export interface ListRow {
  id: string;
  title: string; // max 24 chars
  description?: string; // max 72 chars
}

/** Send an interactive list message (a single "menu" button that opens a row picker). */
export async function sendWhatsAppList(
  to: string,
  body: string,
  button: string,
  rows: ListRow[],
  sectionTitle = "תפריט",
): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error("WhatsApp env missing (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
    return;
  }
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: body },
        action: {
          button, // max 20 chars
          sections: [
            {
              title: sectionTitle,
              rows: rows.map((r) => ({
                id: r.id,
                title: r.title,
                ...(r.description ? { description: r.description } : {}),
              })),
            },
          ],
        },
      },
    }),
  });
  if (!res.ok) console.error("WhatsApp list send failed", res.status, await res.text().catch(() => ""));
}

/** Verify Meta's X-Hub-Signature-256 against the raw request body. Skipped if no app secret. */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // not configured → don't block
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
