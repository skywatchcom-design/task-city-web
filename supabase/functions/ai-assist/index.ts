// SkyTasks AI Edge Function.
// POST { mode: "dump" | "breakdown" | "stuck", text, today?, lang?, postponed? }
// with the user's Supabase session (Authorization: Bearer <access token>).
//
// Order of checks: kill switch -> signed-in user -> input -> quota -> AI -> validated output.
// The AI never gets database access, never sees who the user is, and its answer
// is only a suggestion the app shows for the user to confirm.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { parseRequest, runAi } from "./core.ts";

const env = (name: string) => Deno.env.get(name);
const num = (name: string, def: number) => {
  const v = Number(env(name));
  return Number.isFinite(v) && v >= 0 ? v : def;
};

const USER_LIMIT = num("AI_DAILY_LIMIT_PER_USER", 10);
const IP_LIMIT = num("AI_DAILY_LIMIT_PER_IP", 60);
const GLOBAL_LIMIT = num("AI_DAILY_LIMIT_GLOBAL", 1000);
const ALLOWED_ORIGINS = (env("AI_ALLOWED_ORIGINS") ?? "https://skywatchcom-design.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);

const admin = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  // Mobile apps send no Origin; browsers only from our own site.
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405, { ok: false, reason: "method" });

  // Kill switch: `supabase secrets set AI_ENABLED=false` turns AI off instantly.
  if (env("AI_ENABLED") === "false") return reply(req, 503, { ok: false, reason: "disabled" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(req, 401, { ok: false, reason: "auth" });
  const { data: auth, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !auth?.user) return reply(req, 401, { ok: false, reason: "auth" });
  const userId = auth.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(req, 400, { ok: false, reason: "bad_body" });
  }
  const parsed = parseRequest(body);
  if (typeof parsed === "string") return reply(req, 400, { ok: false, reason: parsed });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { data: quota, error: quotaErr } = await admin.rpc("ai_take_quota", {
    p_user: userId,
    p_ip: ip,
    p_user_limit: USER_LIMIT,
    p_ip_limit: IP_LIMIT,
    p_global_limit: GLOBAL_LIMIT,
  });
  if (quotaErr) {
    console.error("quota", quotaErr.message);
    return reply(req, 503, { ok: false, reason: "unavailable" });
  }
  if (!quota?.ok) return reply(req, 429, { ok: false, reason: quota?.reason ?? "limit", remaining: 0 });

  const result = await runAi(parsed, env);
  if (!result) {
    await admin.rpc("ai_refund_quota", { p_user: userId });
    return reply(req, 503, { ok: false, reason: "unavailable", remaining: quota.remaining + 1 });
  }
  return reply(req, 200, { ok: true, mode: parsed.mode, remaining: quota.remaining, ...result.data });
});
