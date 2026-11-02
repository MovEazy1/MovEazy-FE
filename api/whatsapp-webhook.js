/**
 * Meta → us: every WhatsApp message to our WhatsApp Business number
 * (Cloud API, coexistence — the number stays on the WhatsApp Business app too).
 *
 * Set up in the Meta app → WhatsApp → Configuration → Webhook:
 *   Callback URL   https://www.moveazy.co.in/api/whatsapp-webhook
 *   Verify token   the same value as WHATSAPP_VERIFY_TOKEN in Vercel
 *   Fields         messages
 * and in Vercel: META_APP_SECRET (the app's secret, to check Meta's signature).
 *
 * Each message goes to the database (whatsapp_intake.sql wa_intake_message),
 * which keeps it only when the sender is a marked number or an approved
 * partner. Their photos and videos are copied into storage at once — Meta's
 * media links expire. Reading the batch into a draft happens later
 * (api/whatsapp-process.js), once the sender has finished sending.
 */
import { env, hmacHex, json, safeEqual, service } from "./_razorpay.js";

export const config = { runtime: "edge" };

const GRAPH = "https://graph.facebook.com/v23.0";
const MAX_BYTES = 25 * 1024 * 1024;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/3gpp": "3gp", "video/quicktime": "mov" };

/** A Cloud API message → wa_intake_message's shape. */
export function toIntake(m, names = {}) {
  const base = { id: m.id, from: m.from, name: names[m.from] || "", sent_at: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : "" };
  switch (m.type) {
    case "text": return { ...base, kind: "text", body: m.text?.body || "" };
    case "image": return { ...base, kind: "image", body: m.image?.caption || "", media_id: m.image?.id, mime: m.image?.mime_type };
    case "video": return { ...base, kind: "video", body: m.video?.caption || "", media_id: m.video?.id, mime: m.video?.mime_type };
    case "document": {
      const mime = m.document?.mime_type || "";
      const kind = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "other";
      return { ...base, kind, body: m.document?.caption || "", media_id: kind === "other" ? "" : m.document?.id, mime };
    }
    // A forwarded listing sometimes arrives as an interactive or button reply; keep any words.
    default: return { ...base, kind: "other", body: m.button?.text || m.interactive?.button_reply?.title || "" };
  }
}

async function copyMedia(token, intake) {
  const meta = await fetch(`${GRAPH}/${encodeURIComponent(intake.media_id)}`, { headers: { authorization: `Bearer ${token}` } });
  if (!meta.ok) throw new Error(`media lookup ${meta.status}`);
  const info = await meta.json();
  if (Number(info.file_size) > MAX_BYTES) throw new Error("file over 25 MB");
  const file = await fetch(info.url, { headers: { authorization: `Bearer ${token}` } });
  if (!file.ok) throw new Error(`media download ${file.status}`);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) throw new Error("file over 25 MB");
  const mime = (info.mime_type || intake.mime || "application/octet-stream").split(";")[0].trim();
  const ext = EXT[mime] || (mime.startsWith("video/") ? "mp4" : "jpg");
  const month = new Date().toISOString().slice(0, 7);
  const path = `whatsapp/${month}/${String(intake.id).replace(/[^A-Za-z0-9_-]/g, "").slice(-60)}.${ext}`;
  const up = await fetch(`${env.supabaseUrl}/storage/v1/object/listings/${path}`, {
    method: "POST",
    headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}`, "content-type": mime, "x-upsert": "true", "cache-control": "max-age=31536000" },
    body: bytes,
  });
  if (!up.ok) throw new Error(`storage ${up.status}`);
  return `${env.supabaseUrl}/storage/v1/object/public/listings/${path}`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    // Meta's one-time check when the webhook is saved.
    const verify = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
    if (verify && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === verify) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200, headers: { "content-type": "text/plain" } });
    }
    return json({ error: "Forbidden" }, 403);
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = (process.env.META_APP_SECRET || "").trim();
  if (!secret || !env.serviceKey || !env.supabaseUrl) return json({ error: "not configured" }, 503);
  const raw = await req.text();
  const sig = (req.headers.get("x-hub-signature-256") || "").replace(/^sha256=/, "");
  if (!safeEqual(await hmacHex(secret, raw), sig)) return json({ error: "bad signature" }, 401);

  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad body" }, 400); }

  const rpc = (fn, args) => service(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  let token = null;
  const out = [];
  try {
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        // Only messages people send us; our own replies (smb_message_echoes), delivery statuses and the rest are not listings.
        if (change?.field !== "messages") continue;
        const v = change.value ?? {};
        const names = Object.fromEntries((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name || ""]));
        for (const m of v.messages ?? []) {
          const intake = toIntake(m, names);
          const r = await rpc("wa_intake_message", { p: intake });
          out.push({ id: m.id, stored: Boolean(r?.stored) });
          if (!r?.media) continue;
          try {
            if (token == null) token = (await rpc("wa_connection_get", {}))?.access_token || "";
            if (!token) throw new Error("WhatsApp is not connected in the CRM");
            await rpc("wa_set_media", { p_message: r.message, p_url: await copyMedia(token, intake), p_error: "" });
          } catch (e) {
            await rpc("wa_set_media", { p_message: r.message, p_url: "", p_error: String(e?.message || e).slice(0, 200) });
          }
        }
      }
    }
  } catch (e) {
    // A 5xx makes Meta retry; messages already stored are skipped as duplicates.
    return json({ error: String(e?.message || e).slice(0, 200) }, 500);
  }
  return json({ ok: true, messages: out.length });
}
