// WhatsApp Cloud API webhook.
//  GET  — Meta's webhook verification handshake.
//  POST — incoming customer messages → bot reply with order/shipping status.

import { sendWhatsAppText, verifySignature } from "@/lib/wa-cloud";
import { botReply } from "@/lib/wa-bot";

export const dynamic = "force-dynamic";

// --- Verification handshake (set the same token in Meta's webhook config) ---
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

interface WaMessage {
  from: string;
  type: string;
  text?: { body: string };
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("bad signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("ok", { status: 200 });
  }

  // Collect incoming text messages from the webhook payload.
  const messages: WaMessage[] = [];
  const entries = (body as { entry?: unknown[] }).entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: { messages?: WaMessage[] } }).value;
      for (const m of value?.messages ?? []) messages.push(m);
    }
  }

  // Reply to each text message. (Meta retries on non-200, so always 200 at the end.)
  await Promise.all(
    messages
      .filter((m) => m.type === "text" && m.text?.body && m.from)
      .map(async (m) => {
        try {
          const reply = await botReply(m.from, m.text!.body);
          await sendWhatsAppText(m.from, reply);
        } catch (e) {
          console.error("WA bot error", e);
          await sendWhatsAppText(m.from, "מצטערים, יש תקלה זמנית. נסו שוב בעוד מספר דקות 🙏").catch(() => {});
        }
      })
  );

  return new Response("ok", { status: 200 });
}
