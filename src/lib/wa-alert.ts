// Alerts the business owner that a customer needs a human.
//
// Two channels, sent together:
//   • Email (Resend) — the reliable channel; always delivers.
//   • WhatsApp text — nice-to-have; Meta silently drops it when the owner
//     hasn't messaged the business number in the last 24h (service window),
//     which is how these alerts once "stopped" without any visible error.

import { sendWhatsAppText, toLocalPhone } from "./wa-cloud";
import { sendAlertEmail } from "./alert-email";

const CRM_URL = "https://mezu-crm.vercel.app";

export type AlertKind = "escalation" | "waiting";

const TITLES: Record<AlertKind, string> = {
  escalation: "לקוח מבקש נציג אנושי",
  waiting:    "לקוח ממתין לתשובה (שיחה במצב נציג)",
};

export async function sendHumanAlert(
  waId: string,
  customerName: string | null,
  lastMessage: string,
  kind: AlertKind = "escalation",
): Promise<void> {
  const title = TITLES[kind];
  const phone = toLocalPhone(waId);
  const link = `${CRM_URL}/conversations?wa=${encodeURIComponent(waId)}`;

  const waBody =
    `🔔 ${title}\n` +
    (customerName ? `שם: ${customerName}\n` : "") +
    `טלפון: ${phone}\n` +
    `הודעה אחרונה: "${lastMessage}"\n\n` +
    `לצפייה ומענה: ${link}`;

  const html = `<!DOCTYPE html><html dir="rtl"><body style="font-family:Arial,sans-serif;background:#F8F7FC;padding:20px;">
    <div style="max-width:560px;margin:0 auto;background:#FFF;border-radius:12px;padding:24px;border:1px solid #D8D4F5;">
      <h2 dir="rtl" style="color:#2D2B55;margin:0 0 10px;">🔔 ${title}</h2>
      <table dir="rtl" style="width:100%;border-collapse:collapse;font-size:14px;">
        ${customerName ? `<tr><td style="padding:5px 8px;font-weight:600;">שם</td><td style="padding:5px 8px;">${customerName}</td></tr>` : ""}
        <tr><td style="padding:5px 8px;font-weight:600;">טלפון</td><td style="padding:5px 8px;direction:ltr;text-align:right;">${phone}</td></tr>
        <tr><td style="padding:5px 8px;font-weight:600;vertical-align:top;">הודעה אחרונה</td><td style="padding:5px 8px;">${(lastMessage || "").slice(0, 300)}</td></tr>
      </table>
      <div dir="rtl" style="margin-top:16px;">
        <a href="${link}" style="display:inline-block;background:#6C5CE7;color:#FFF;padding:10px 24px;border-radius:50px;text-decoration:none;font-size:13px;">פתיחת השיחה ב-CRM</a>
      </div>
    </div>
  </body></html>`;

  const results = await Promise.allSettled([
    sendAlertEmail(`🔔 ${title} — ${customerName || phone}`, html),
    (async () => {
      const to = process.env.WHATSAPP_ALERT_TO;
      if (!to) throw new Error("WHATSAPP_ALERT_TO not set");
      await sendWhatsAppText(to, waBody);
    })(),
  ]);
  if (results[1].status === "rejected") {
    console.warn("[wa-alert] WhatsApp channel failed (email still sent)", String((results[1] as PromiseRejectedResult).reason));
  }
}
