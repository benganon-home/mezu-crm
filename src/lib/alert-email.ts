// Owner alert emails via Resend (same account as the storefront).
// WhatsApp alerts from the business number silently die outside Meta's
// 24-hour service window, so email is the channel that must always work.

const RESEND_KEY  = process.env.RESEND_API_KEY;
const FROM        = process.env.EMAIL_FROM || "MEZU <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "mezu.office@gmail.com";

export async function sendAlertEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_KEY) {
    console.error("[alert-email] RESEND_API_KEY not set — alert NOT sent", { subject });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: ADMIN_EMAIL, subject, html }),
    });
    if (!res.ok) {
      console.error("[alert-email] send failed", { status: res.status, body: await res.text() });
    } else {
      console.log("[alert-email] sent", { subject, to: ADMIN_EMAIL });
    }
  } catch (err) {
    console.error("[alert-email] send threw", { error: err instanceof Error ? err.message : String(err) });
  }
}
