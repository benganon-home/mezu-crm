// Sends the business owner a WhatsApp alert when a customer needs a human.

import { sendWhatsAppText, toLocalPhone } from "./wa-cloud";

const CRM_URL = "https://mezu-crm.vercel.app";

export async function sendHumanAlert(waId: string, customerName: string | null, lastMessage: string): Promise<void> {
  const to = process.env.WHATSAPP_ALERT_TO;
  if (!to) {
    console.error("WHATSAPP_ALERT_TO not set — cannot send human-handoff alert");
    return;
  }
  const link = `${CRM_URL}/conversations?wa=${encodeURIComponent(waId)}`;
  const body =
    `🔔 לקוח מבקש נציג אנושי\n` +
    (customerName ? `שם: ${customerName}\n` : "") +
    `טלפון: ${toLocalPhone(waId)}\n` +
    `הודעה אחרונה: "${lastMessage}"\n\n` +
    `לצפייה ומענה: ${link}`;
  try {
    await sendWhatsAppText(to, body);
  } catch (e) {
    console.error("Failed to send human-handoff alert", e);
  }
}
