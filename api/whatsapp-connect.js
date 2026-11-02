/**
 * POST /api/whatsapp-connect — finish connecting our WhatsApp Business number
 * after Meta's sign-up popup in the CRM (WhatsApp inbox → Setup).
 * Authorization: Bearer <the super admin's Supabase access token>
 *
 *   { code, waba_id, phone_number_id }   from the popup (coexistence:
 *                                        "WhatsApp Business app" onboarding)
 *
 * Swaps the code for the business's token, subscribes our Meta app to the
 * account's webhooks, asks Meta to sync contacts (the number stays on the
 * WhatsApp Business app), and saves the connection (wa_connection_save).
 *
 * Needs, in Vercel: META_APP_SECRET, and the app id as META_APP_ID (or the
 * VITE_META_APP_ID the CRM page uses).
 */
import { env, json, service, userFromToken } from "./_razorpay.js";

export const config = { runtime: "edge" };

const GRAPH = "https://graph.facebook.com/v23.0";
const SUPER_ADMIN = "yatharth200018@gmail.com";

async function graph(path, token, init = {}) {
  const r = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(body?.error?.message || `Meta ${r.status}`);
  return body;
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const user = await userFromToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  if (!user || String(user.email || "").toLowerCase() !== SUPER_ADMIN || !user.email_confirmed_at) {
    return json({ error: "Only the super admin can connect WhatsApp." }, 403);
  }
  const appId = (process.env.META_APP_ID || process.env.VITE_META_APP_ID || "").trim();
  const appSecret = (process.env.META_APP_SECRET || "").trim();
  if (!appId || !appSecret || !env.serviceKey) {
    return json({ error: "Add META_APP_ID, META_APP_SECRET and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy." }, 503);
  }

  let body = {};
  try { body = (await req.json()) || {}; } catch { /* checked below */ }
  const code = String(body.code || "");
  const wabaId = String(body.waba_id || "").replace(/\D/g, "");
  const phoneId = String(body.phone_number_id || "").replace(/\D/g, "");
  if (!code || !wabaId || !phoneId) return json({ error: "Meta didn't send the account details — try connecting again." }, 400);

  try {
    const q = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    const tok = await fetch(`${GRAPH}/oauth/access_token?${q}`).then((r) => r.json());
    if (!tok?.access_token) throw new Error(tok?.error?.message || "Meta didn't return a token");
    const token = tok.access_token;

    await graph(`${wabaId}/subscribed_apps`, token, { method: "POST" });
    const phone = await graph(`${phoneId}?fields=display_phone_number,verified_name`, token);
    // Contacts sync is what Meta asks of a coexistence number; we read messages either way.
    await graph(`${phoneId}/smb_app_data`, token, {
      method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", sync_type: "smb_app_state_sync" }),
    }).catch(() => null);

    await service("rpc/wa_connection_save", {
      method: "POST",
      body: JSON.stringify({ p: {
        waba_id: wabaId, phone_number_id: phoneId, display_phone: phone?.display_phone_number || "",
        verified_name: phone?.verified_name || "", access_token: token, connected_by: user.email,
      } }),
    });
    return json({ ok: true, display_phone: phone?.display_phone_number || "", verified_name: phone?.verified_name || "" });
  } catch (e) {
    return json({ error: String(e?.message || e).slice(0, 300) }, 502);
  }
}
