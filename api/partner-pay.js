/**
 * POST /api/partner-pay  { payment: "<id from partner_payment_start>" }
 * Authorization: Bearer <the broker's Supabase access token>
 *
 * Creates a Razorpay Payment Link for exactly that payment — the amount comes
 * from our database, never from the browser — tags it with the payment id,
 * stores the link on the payment, and answers { url }. Razorpay sends the
 * broker back to /premium/return, and its webhook (razorpay-webhook.js)
 * activates the plan.
 *
 * 503 { fallback: true } when the keys aren't configured yet: the app then
 * uses the plan's static payment link and a super admin approves by hand.
 */
import { env, json, service, userFromToken } from "./_razorpay.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!env.keyId || !env.keySecret || !env.serviceKey || !env.supabaseUrl) {
    return json({ error: "Online payment isn't set up yet.", fallback: true }, 503);
  }
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const user = await userFromToken(token);
  if (!user) return json({ error: "Sign in again." }, 401);

  let paymentId = "";
  try {
    paymentId = String((await req.json())?.payment || "");
  } catch { /* handled below */ }
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return json({ error: "Bad payment." }, 400);

  try {
    const [pay] = await service(`partner_payments?id=eq.${paymentId}&select=id,user_id,plan_id,amount,status,link_url`);
    if (!pay || pay.user_id !== user.id) return json({ error: "Not your payment." }, 403);
    if (pay.status !== "started") return json({ error: "This payment is already done." }, 409);
    if (pay.link_url) return json({ url: pay.link_url });

    const [plan] = await service(`partner_plans?id=eq.${encodeURIComponent(pay.plan_id)}&select=label,months`);
    const [partner] = await service(`broker_partners?user_id=eq.${user.id}&select=name,phone,email`);
    // Always back to the partner app, wherever the request came from.
    const origin = "https://partners.moveazy.co.in";

    const r = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${env.keyId}:${env.keySecret}`)}`, "content-type": "application/json" },
      body: JSON.stringify({
        amount: pay.amount * 100,
        currency: "INR",
        accept_partial: false,
        reference_id: pay.id,
        description: `MovEazy Partners — ${plan?.label || pay.plan_id}`,
        customer: {
          name: (partner?.name || "").slice(0, 60),
          contact: partner?.phone ? `+91${partner.phone}` : undefined,
          email: partner?.email || user.email || undefined,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { payment_id: pay.id, user_id: user.id, plan_id: pay.plan_id, product: "partners" },
        callback_url: `${origin}/premium/return?payment=${pay.id}`,
        callback_method: "get",
      }),
    });
    const link = await r.json();
    if (!r.ok || !link?.short_url) {
      return json({ error: link?.error?.description || "Razorpay could not create the payment.", fallback: true }, 502);
    }
    await service(`partner_payments?id=eq.${pay.id}`, {
      method: "PATCH",
      body: JSON.stringify({ link_id: link.id, link_url: link.short_url }),
    });
    return json({ url: link.short_url });
  } catch (e) {
    return json({ error: "Payment could not start. Please try again.", detail: String(e?.message || e).slice(0, 200) }, 500);
  }
}
