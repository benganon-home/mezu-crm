// WhatsApp Cloud API webhook.
//  GET  — Meta's webhook verification handshake.
//  POST — incoming customer messages → bot reply with order/shipping status.

import { sendWhatsAppText, sendWhatsAppList, sendWhatsAppButtons, verifySignature } from "@/lib/wa-cloud";
import { botReply, MENU_QUERIES } from "@/lib/wa-bot";

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
  interactive?: {
    type: string;
    list_reply?: { id: string; title: string };
    button_reply?: { id: string; title: string };
  };
}

/** Resolve the text to feed the bot from a text or interactive (menu tap) message. */
function messageToText(m: WaMessage): string | null {
  if (m.type === "text" && m.text?.body) return m.text.body;
  if (m.type === "interactive") {
    const reply = m.interactive?.list_reply ?? m.interactive?.button_reply;
    if (reply) return MENU_QUERIES[reply.id] ?? reply.title;
  }
  return null;
}

interface WaContact {
  wa_id: string;
  profile?: { name?: string };
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

  // Collect incoming text messages + sender names from the webhook payload.
  const messages: WaMessage[] = [];
  const names = new Map<string, string>(); // wa_id -> profile name
  const entries = (body as { entry?: unknown[] }).entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: { messages?: WaMessage[]; contacts?: WaContact[] } }).value;
      for (const c of value?.contacts ?? []) {
        if (c.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name);
      }
      for (const m of value?.messages ?? []) messages.push(m);
    }
  }

  // Reply to each message (text or menu tap). Meta retries on non-200, so always 200 at the end.
  await Promise.all(
    messages.map(async (m) => {
      const userText = messageToText(m);
      if (!userText || !m.from) return;
      try {
        const reply = await botReply(m.from, userText, names.get(m.from) ?? null);
        // null means a human is handling this chat — stay silent.
        if (!reply) return;
        if (reply.kind === "list") {
          const ok = await sendWhatsAppList(m.from, reply.menu.body, reply.menu.button, reply.menu.rows);
          if (!ok) {
            // Fallback to a plain-text menu so navigation still works.
            const lines = reply.menu.rows.map((r) => `• ${r.title}`).join("\n");
            await sendWhatsAppText(m.from, `${reply.menu.body}\n\n${lines}\n\nכתבו לי את שם האפשרות או שאלו אותי ישירות 🤍`);
          }
        } else if (reply.kind === "buttons") {
          const ok = await sendWhatsAppButtons(m.from, reply.body, reply.buttons);
          if (!ok) await sendWhatsAppText(m.from, reply.body); // text fallback (no button)
        } else {
          await sendWhatsAppText(m.from, reply.text);
        }
      } catch (e) {
        console.error("WA bot error", e);
        await sendWhatsAppText(m.from, "מצטערים, יש תקלה זמנית. נסו שוב בעוד מספר דקות 🙏").catch(() => {});
      }
    })
  );

  return new Response("ok", { status: 200 });
}
