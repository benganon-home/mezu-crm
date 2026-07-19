// Public website chat endpoint — called by the storefront chat widget.
// Same bot brain as WhatsApp (see web-bot.ts). Hardened because it's public:
//  • CORS restricted to the storefront origins
//  • per-IP sliding-window rate limit
//  • strict input caps (message length, history length/size)

import { NextRequest, NextResponse } from "next/server";
import { webBotReply, type ChatTurn } from "@/lib/web-bot";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "https://www.mezu.co.il",
  "https://mezu.co.il",
  "https://mezu-store.vercel.app",
]);

const MSG_MAX = 1000;      // chars per message
const HISTORY_MAX = 12;    // turns kept
const TURN_MAX = 2000;     // chars per history turn

// Per-IP sliding window (best-effort, in-memory per instance).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) { // guard unbounded growth
    for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
  }
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.mezu.co.il";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json({ error: "יותר מדי הודעות. נסו שוב בעוד רגע." }, { status: 429, headers: cors });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400, headers: cors }); }

  const message = typeof body?.message === "string" ? body.message.trim().slice(0, MSG_MAX) : "";
  if (!message) return NextResponse.json({ error: "empty message" }, { status: 400, headers: cors });

  const history: ChatTurn[] = Array.isArray(body?.history)
    ? body.history
        .filter((t: any) => (t?.role === "user" || t?.role === "assistant") && typeof t?.content === "string")
        .slice(-HISTORY_MAX)
        .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, TURN_MAX) }))
    : [];

  try {
    const { text, products } = await webBotReply(history, message);
    return NextResponse.json({ reply: text, products }, { headers: cors });
  } catch (e) {
    console.error("web-chat error", e);
    return NextResponse.json({ error: "server error" }, { status: 500, headers: cors });
  }
}
