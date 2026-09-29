/**
 * Shared by the partner payment functions: environment, the caller's account,
 * and service-role calls to Supabase.
 *
 * Needs, in Vercel → Settings → Environment Variables:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   create payment links
 *   RAZORPAY_WEBHOOK_SECRET                verify Razorpay's webhook
 *   SUPABASE_SERVICE_ROLE_KEY              record the link / activate the plan
 * (VITE_SUPABASE_URL and the anon key are already there for the site.)
 */
export const env = {
  supabaseUrl: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim(),
  anonKey: (process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim(),
  serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  keyId: (process.env.RAZORPAY_KEY_ID || "").trim(),
  keySecret: (process.env.RAZORPAY_KEY_SECRET || "").trim(),
  webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim(),
};

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** The signed-in user behind a bearer token, or null. */
export async function userFromToken(token) {
  if (!token || !env.supabaseUrl || !env.anonKey) return null;
  const r = await fetch(`${env.supabaseUrl}/auth/v1/user`, { headers: { apikey: env.anonKey, authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? u : null;
}

/** PostgREST as the service role. */
export async function service(path, init = {}) {
  const r = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      authorization: `Bearer ${env.serviceKey}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(`supabase ${r.status}: ${typeof body === "string" ? body : body?.message || ""}`);
  return body;
}

/** Constant-time compare of two hex strings. */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
