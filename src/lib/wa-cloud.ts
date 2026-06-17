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

/**
 * Send an interactive list message (a single "menu" button that opens a row
 * picker). Returns true on success, false on failure (so the caller can fall
 * back to plain text). WhatsApp field limits: button <=20, row title <=24,
 * row description <=72 — we trim defensively to avoid #131009 rejections.
 */
export async function sendWhatsAppList(
  to: string,
  body: string,
  button: string,
  rows: ListRow[],
  sectionTitle = "תפריט",
): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error("WhatsApp env missing (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
    return false;
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
        body: { text: body.slice(0, 1024) },
        action: {
          button: button.slice(0, 20),
          sections: [
            {
              title: sectionTitle.slice(0, 24),
              rows: rows.map((r) => ({
                id: r.id.slice(0, 200),
                title: r.title.slice(0, 24),
                ...(r.description ? { description: r.description.slice(0, 72) } : {}),
              })),
            },
          ],
        },
      },
    }),
  });
  if (!res.ok) {
    // Log the concise Graph error (code + message) — the full blob gets
    // truncated in log viewers, so surface the useful part.
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { code?: number; message?: string } };
      detail = `${j.error?.code ?? ""} ${j.error?.message ?? ""}`.trim();
    } catch {
      detail = await res.text().catch(() => "");
    }
    console.error(`WhatsApp list send failed ${res.status}: ${detail}`);
    return false;
  }
  return true;
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
