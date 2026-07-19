// WhatsApp Cloud API webhook.
//  GET  — Meta's webhook verification handshake.
//  POST — incoming customer messages → bot reply with order/shipping status.
//         Also handles smb_message_echoes (owner replies from WA Business App)
//         to auto-pause the bot when the owner takes over a conversation.

import { sendWhatsAppText, verifySignature, fetchWhatsAppMedia } from "@/lib/wa-cloud";
import { botReply, recordTurn } from "@/lib/wa-bot";
import { setStatus } from "@/lib/wa-conversations";

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
  image?: { id: string; mime_type?: string; caption?: string };
}

interface WaContact {
  wa_id: string;
  profile?: { name?: string };
}

interface SmbEcho {
  from: string;
  to: string;
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

  // Collect incoming text messages + sender names from the webhook payload,
  // and also detect smb_message_echoes (owner replying from WA Business App).
  const messages: WaMessage[] = [];
  const names = new Map<string, string>(); // wa_id -> profile name
  const echoes: SmbEcho[] = [];
  const entries = (body as { entry?: unknown[] }).entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      const field = (change as { field?: string }).field;
      const value = (change as { value?: Record<string, unknown> }).value;

      if (field === "smb_message_echoes" && value?.message_echoes) {
        // Owner sent a message from the WhatsApp Business App
        for (const echo of value.message_echoes as SmbEcho[]) echoes.push(echo);
      } else {
        // Regular incoming customer messages
        const msgs = value?.messages as WaMessage[] | undefined;
        const contacts = value?.contacts as WaContact[] | undefined;
        for (const c of contacts ?? []) {
          if (c.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name);
        }
        for (const m of msgs ?? []) messages.push(m);
      }
    }
  }

  // Handle smb_message_echoes: when the owner replies from the WA Business App,
  // auto-pause the bot on that conversation so it doesn't talk over the owner.
  if (echoes.length > 0) {
    const customerIds = new Set(echoes.map((e) => e.to));
    await Promise.all(
      [...customerIds].map(async (customerId) => {
        try {
          await setStatus(customerId, "human", false);
          console.log(`[wa] owner replied from app → paused bot for ${customerId}`);
        } catch (e) {
          console.error("smb echo pause error", e);
        }
      })
    );
  }

  // Reply to each text/image message. (Meta retries on non-200, so always 200 at the end.)
  await Promise.all(
    messages
      .filter((m) => m.from && ((m.type === "text" && m.text?.body) || (m.type === "image" && m.image?.id)))
      .map(async (m) => {
        try {
          // For images: download the media so Claude can actually see it. The
          // caption (if any) rides along as the text; without one we pass a
          // placeholder so history/inbox still show a readable line.
          const isImage = m.type === "image";
          const media = isImage ? await fetchWhatsAppMedia(m.image!.id) : null;
          if (isImage && !media) {
            await sendWhatsAppText(m.from, "קיבלנו את התמונה אך לא הצלחנו לטעון אותה 🙏 אפשר לנסות לשלוח שוב, או לכתוב לנו במילים במה נוכל לעזור.");
            return;
          }
          const userText = isImage
            ? (m.image!.caption?.trim() ? `[תמונה] ${m.image!.caption!.trim()}` : "[הלקוח שלח/ה תמונה ללא כיתוב]")
            : m.text!.body;

          const reply = await botReply(m.from, userText, names.get(m.from) ?? null, media);
          // reply === null means a human is handling this chat — stay silent.
          if (reply) {
            const ok = await sendWhatsAppText(m.from, reply);
            // Only commit the turn to memory if it was actually delivered.
            if (ok) await recordTurn(m.from, userText, reply);
          }
        } catch (e) {
          console.error("WA bot error", e);
          await sendWhatsAppText(m.from, "מצטערים, יש תקלה זמנית. נסו שוב בעוד מספר דקות 🙏").catch(() => {});
        }
      })
  );

  return new Response("ok", { status: 200 });
}
