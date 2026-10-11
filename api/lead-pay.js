/**
 * Razorpay for the 30-lead pack (MovEazy leads, partner app).
 *
 * GET  /api/lead-pay                → { online } — whether Razorpay is set up;
 *                                     the app shows the UPI QR + UTR when not.
 * POST /api/lead-pay { request }    → { url } — a Payment Link for exactly that
 *      Authorization: Bearer <token>   request (amount from our database, never
 *                                     the browser). Razorpay sends the broker
 *                                     back to Leads → MovEazy leads, and its
 *                                     webhook (razorpay-webhook.js) opens the
 *                                     request for assigning.
 *
 * Same keys as partner-pay.js (see _razorpay.js); 503 { fallback } without them.
 */
import { env, json, service, userFromToken } from "./_razorpay.js";

export const config = { runtime: "edge" };

const ready = () => Boolean(env.keyId && env.keySecret && env.serviceKey && env.supabaseUrl && env.webhookSecret);

export default async function handler(req) {
  if (req.method === "GET") return json({ online: ready() });
  if (req.method !== "POST") return json({ error: "GET or POST" }, 405);
  if (!ready()) return json({ error: "Online payment isn't set up yet.", fallback: true }, 503);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const user = await userFromToken(token);
  if (!user) return json({ error: "Sign in again." }, 401);

  let requestId = "";
  try {
    requestId = String((await req.json())?.request || "");
  } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json({ error: "Bad request." }, 400);

  try {
    const [q] = await service(`partner_lead_requests?id=eq.${requestId}&select=id,broker_id,pack,amount,status,link_url`);
    if (!q || q.broker_id !== user.id) return json({ error: "Not your request." }, 403);
    if (q.status !== "awaiting_payment" || q.pack !== "paid30") return json({ error: "This request isn't waiting for a payment." }, 409);
    if (q.link_url) return json({ url: q.link_url });

    const [partner] = await service(`broker_partners?user_id=eq.${user.id}&select=name,phone,email`);
    const origin = "https://partners.moveazy.co.in";
    const r = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${env.keyId}:${env.keySecret}`)}`, "content-type": "application/json" },
      body: JSON.stringify({
        amount: q.amount * 100,
        currency: "INR",
        accept_partial: false,
        reference_id: q.id,
        description: "MovEazy Partners — 30 MovEazy leads",
        customer: {
          name: (partner?.name || "").slice(0, 60),
          contact: partner?.phone ? `+91${String(partner.phone).replace(/\D/g, "").slice(-10)}` : undefined,
          email: partner?.email || user.email || undefined,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { request_id: q.id, user_id: user.id, product: "partner_leads" },
        callback_url: `${origin}/leads?tab=moveazy&paid=1`,
        callback_method: "get",
      }),
    });
    const link = await r.json();
    if (!r.ok || !link?.short_url) {
      return json({ error: link?.error?.description || "Razorpay could not create the payment.", fallback: true }, 502);
    }
    await service(`partner_lead_requests?id=eq.${q.id}`, {
      method: "PATCH",
      body: JSON.stringify({ link_id: link.id, link_url: link.short_url }),
    });
    return json({ url: link.short_url });
  } catch (e) {
    return json({ error: "Payment could not start. Please try again.", detail: String(e?.message || e).slice(0, 200) }, 500);
  }
}
