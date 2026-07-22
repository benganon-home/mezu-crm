// Conversation state for the WhatsApp bot: per-wa_id status (bot / needs_human
// / human), last message, and unread flag — powering the CRM inbox + handoff.
// Read/written with the service-role client (no request cookies).

import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type ConvStatus = "bot" | "needs_human" | "human";

// After this much inactivity, a paused conversation auto-resumes to the bot.
const RESUME_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface Conversation {
  wa_id: string;
  customer_name: string | null;
  status: ConvStatus;
  last_message: string | null;
  last_message_at: string | null;
  unread: boolean;
  needs_human_since: string | null;
  updated_at: string;
}

/** Effective status, auto-resuming to 'bot' after a long quiet period. */
export async function getEffectiveStatus(waId: string): Promise<ConvStatus> {
  const { data } = await admin().from("wa_conversations").select("status, updated_at").eq("wa_id", waId).maybeSingle();
  if (!data) return "bot";
  if (data.status !== "bot") {
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > RESUME_MS) {
      await admin().from("wa_conversations").update({ status: "bot", updated_at: new Date().toISOString() }).eq("wa_id", waId);
      return "bot";
    }
  }
  return data.status as ConvStatus;
}

/** Record an inbound customer message (updates preview + unread).
 * Returns true when this message flipped the conversation to unread —
 * i.e. it's the FIRST new message since the owner last read the thread —
 * so callers can alert once per waiting period instead of on every message. */
export async function upsertInbound(waId: string, message: string, customerName: string | null, unread: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    wa_id: waId,
    last_message: message.slice(0, 500),
    last_message_at: now,
    updated_at: now,
  };
  if (customerName) row.customer_name = customerName;
  if (unread) row.unread = true;
  try {
    const { data: prev } = await admin().from("wa_conversations").select("unread").eq("wa_id", waId).maybeSingle();
    await admin().from("wa_conversations").upsert(row, { onConflict: "wa_id" });
    return unread && !prev?.unread;
  } catch {
    return false; /* best-effort */
  }
}

/** Flag a conversation as awaiting a human + mark unread. */
export async function escalate(waId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    await admin()
      .from("wa_conversations")
      .upsert({ wa_id: waId, status: "needs_human", needs_human_since: now, unread: true, updated_at: now }, { onConflict: "wa_id" });
  } catch { /* best-effort */ }
}

/** Set the conversation status from the CRM (also clears unread when opened). */
export async function setStatus(waId: string, status: ConvStatus, clearUnread = true): Promise<void> {
  const patch: Record<string, unknown> = { wa_id: waId, status, updated_at: new Date().toISOString() };
  if (status === "needs_human") patch.needs_human_since = new Date().toISOString();
  if (clearUnread) patch.unread = false;
  await admin().from("wa_conversations").upsert(patch, { onConflict: "wa_id" });
}
