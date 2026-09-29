/**
 * Razorpay → us, when a partner's payment link is paid.
 *
 * Set up in Razorpay Dashboard → Settings → Webhooks:
 *   URL      https://www.moveazy.co.in/api/razorpay-webhook
 *   Secret   the same value as RAZORPAY_WEBHOOK_SECRET in Vercel
 *   Events   payment_link.paid
 *
 * The signature is checked over the raw body before anything is read. The
 * database (partner_razorpay_paid) then checks the link and the amount against
 * the payment it created, and activates the plan — idempotently, so Razorpay's
 * retries are harmless.
 */
import { env, hmacHex, json, safeEqual, service } from "./_razorpay.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env.webhookSecret || !env.serviceKey || !env.supabaseUrl) return json({ error: "not configured" }, 503);

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";
  if (!safeEqual(await hmacHex(env.webhookSecret, raw), signature)) return json({ error: "bad signature" }, 401);

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "bad body" }, 400);
  }
  if (event?.event !== "payment_link.paid") return json({ ok: true, ignored: event?.event || "" });

  const link = event.payload?.payment_link?.entity || {};
  const payment = event.payload?.payment?.entity || {};
  const paymentId = link.notes?.payment_id || link.reference_id || "";
  if (link.notes?.product && link.notes.product !== "partners") return json({ ok: true, ignored: "not a partner payment" });
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return json({ ok: true, ignored: "no partner payment id" });

  try {
    const result = await service("rpc/partner_razorpay_paid", {
      method: "POST",
      body: JSON.stringify({
        p_payment: paymentId,
        p_link_id: link.id || "",
        p_gateway_payment: payment.id || "",
        p_amount_paise: Number(link.amount_paid || payment.amount || 0),
      }),
    });
    return json({ ok: true, result });
  } catch (e) {
    // A 5xx makes Razorpay retry later.
    return json({ error: String(e?.message || e).slice(0, 200) }, 500);
  }
}
