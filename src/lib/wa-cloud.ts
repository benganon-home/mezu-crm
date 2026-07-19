// WhatsApp Cloud API helpers (send messages + verify webhook signature).

import crypto from "node:crypto";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Normalize any phone (wa_id like 972501234567, or local) to the DB form 0XXXXXXXXX. */
export function toLocalPhone(raw: string): string {
  return (raw || "").replace(/\D/g, "").replace(/^972/, "0");
}

/** Send a plain-text WhatsApp message to a wa_id (e.g. "972501234567"). Returns true on success. */
export async function sendWhatsAppText(to: string, body: string): Promise<boolean> {
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
      type: "text",
      text: { preview_url: true, body },
    }),
  });
  if (!res.ok) {
    console.error("WhatsApp send failed", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

// Claude's vision API accepts exactly these media types.
const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

export interface WaMediaImage {
  data: string; // base64
  mediaType: ImageMediaType;
}

/**
 * Download an incoming media attachment. Meta's webhook only carries a media id —
 * resolving it is a two-step dance: GET /{media-id} → short-lived CDN URL, then
 * GET that URL (both with the WhatsApp token). Returns null on any failure or
 * on media types Claude can't consume.
 */
export async function fetchWhatsAppMedia(mediaId: string): Promise<WaMediaImage | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !mediaId) return null;
  try {
    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) {
      console.error("WhatsApp media meta failed", metaRes.status, await metaRes.text().catch(() => ""));
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    const mediaType = (meta.mime_type ?? "").split(";")[0].trim() as ImageMediaType;
    if (!meta.url || !IMAGE_MEDIA_TYPES.includes(mediaType)) return null;

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) {
      console.error("WhatsApp media download failed", fileRes.status);
      return null;
    }
    const buf = Buffer.from(await fileRes.arrayBuffer());
    // Claude caps images at 5MB; WhatsApp caps incoming images at ~5MB too,
    // but guard anyway rather than erroring mid-conversation.
    if (buf.byteLength > 5 * 1024 * 1024) return null;
    return { data: buf.toString("base64"), mediaType };
  } catch (e) {
    console.error("WhatsApp media fetch error", e);
    return null;
  }
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
