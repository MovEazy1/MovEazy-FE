/**
 * POST /api/view-as — the super admin's "view as a user" (view_as.sql).
 * Authorization: Bearer <the super admin's Supabase access token>
 *
 *   { action: "start", userId }
 *       Opens a view-as session and a one-time sign-in for that account:
 *       answers { session, key, tokenHash, email, name }. The browser signs in
 *       with the token (supabase.auth.verifyOtp) and sends `x-mz-view-as:
 *       <session>` on every request after that; `key` is what lets it switch
 *       modes and end the session.
 *   { action: "remove-uploads", session }
 *       Deletes the files that session uploaded while actions were allowed
 *       (part of Revert): answers { removed }.
 *
 * Only for the super admin's Google-verified account; everyone else gets 404,
 * as if there were nothing here.
 */
import { env, json, service, userFromToken } from "./_razorpay.js";

export const config = { runtime: "edge" };

const SUPER_ADMIN = "yatharth200018@gmail.com";
const notFound = () => json({ error: "Not found" }, 404);

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** GoTrue's admin API, as the service role. */
async function authAdmin(path, init = {}) {
  const r = await fetch(`${env.supabaseUrl}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.msg || body?.message || body?.error_description || `auth ${r.status}`);
  return body;
}

export default async function handler(req) {
  if (req.method !== "POST") return notFound();
  if (!env.serviceKey || !env.supabaseUrl) return json({ error: "The server isn't set up for this." }, 503);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = await userFromToken(token);
  if (!admin || String(admin.email || "").toLowerCase() !== SUPER_ADMIN || !admin.email_confirmed_at) return notFound();

  let body = {};
  try { body = (await req.json()) || {}; } catch { /* handled below */ }

  try {
    if (body.action === "start") {
      const userId = String(body.userId || "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Pick a user." }, 400);
      const target = await authAdmin(`admin/users/${userId}`);
      const email = String(target?.email || "").toLowerCase();
      if (!email) return json({ error: "This account has no email, so it can't be opened." }, 422);
      if (email === SUPER_ADMIN) return json({ error: "That's you." }, 422);
      const meta = target.user_metadata || {};
      const name = String(meta.full_name || meta.name || "").slice(0, 120);

      const key = randomHex();
      const [session] = await service("view_as_sessions", {
        method: "POST",
        body: JSON.stringify({
          admin_id: admin.id, admin_email: SUPER_ADMIN, target_id: target.id, target_email: email, target_name: name,
          key_hash: await sha256Hex(key), prior_sign_in: target.last_sign_in_at || null,
        }),
      });
      const link = await authAdmin("admin/generate_link", { method: "POST", body: JSON.stringify({ type: "magiclink", email }) });
      const tokenHash = link?.properties?.hashed_token || link?.hashed_token;
      if (!tokenHash) throw new Error("Supabase didn't return a sign-in token.");
      return json({ session: session.id, key, tokenHash, email, name });
    }

    if (body.action === "remove-uploads") {
      const sid = String(body.session || "");
      if (!/^[0-9a-f-]{36}$/i.test(sid)) return json({ error: "Bad session." }, 400);
      const rows = await service(`view_as_uploads?session_id=eq.${sid}&removed=eq.false&select=id,bucket,path`);
      const byBucket = new Map();
      for (const r of rows || []) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) || []), r]);
      let removed = 0;
      for (const [bucket, list] of byBucket) {
        const r = await fetch(`${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}`, {
          method: "DELETE",
          headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}`, "content-type": "application/json" },
          body: JSON.stringify({ prefixes: list.map((x) => x.path) }),
        });
        if (!r.ok) continue;
        await service(`view_as_uploads?id=in.(${list.map((x) => x.id).join(",")})`, {
          method: "PATCH", body: JSON.stringify({ removed: true }),
        });
        removed += list.length;
      }
      return json({ removed });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: e?.message || "Something went wrong." }, 500);
  }
}
