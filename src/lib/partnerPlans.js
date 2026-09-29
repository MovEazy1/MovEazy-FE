/**
 * Plans, payment, referrals, profile and the sales funnel for MovEazy
 * Partners. The authority is MovEazy-BE/supabase/partner_launch.sql (§ 3–7):
 * what a plan costs, whether a payment counts and who may approve one are
 * decided there. This file only calls it, plus /api/partner-pay for the
 * Razorpay link.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const PARTNER_ORIGIN = "https://partners.moveazy.co.in";
export const REFERRAL_REWARD = 1500;

export const fetchPlans = () => rpc("partner_plans_list").then((r) => r ?? []);
export const fetchPartnerStatus = () => rpc("partner_status");
export const markCongratsSeen = () => rpc("partner_congrats_seen").catch(() => {});

/**
 * Pay for a plan: record the attempt, then send the broker to Razorpay.
 * Resolves to the URL to open. Falls back to the plan's static payment page
 * (activated by a super admin) when online payment isn't configured.
 */
export async function startPlanPayment(planId) {
  const pay = await rpc("partner_payment_start", { p_plan: planId });
  const { data: { session } = {} } = await supabase.auth.getSession();
  let res = null;
  try {
    const r = await fetch("/api/partner-pay", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token || ""}` },
      body: JSON.stringify({ payment: pay.id }),
    });
    res = { status: r.status, body: await r.json().catch(() => ({})) };
  } catch {
    res = { status: 0, body: { fallback: true } };
  }
  if (res.body?.url) return { url: res.body.url, payment: pay, mode: "razorpay" };
  if (res.body?.fallback && pay.payment_link) return { url: pay.payment_link, payment: pay, mode: "manual" };
  throw new Error(res.body?.error || "Online payment isn't available right now. Please message the MovEazy team.");
}

export const fetchMyReferrals = () => rpc("partner_my_referrals");
export const fetchReferralCode = () => rpc("partner_referral_code");
export const referralLink = (code) => `${PARTNER_ORIGIN}/?ref=${encodeURIComponent(code)}`;
export function referralMessage(code, name = "") {
  return `${name ? `${name} here — ` : ""}I use MovEazy Partners for rental inventory, AI tenant matching and my broker groups. `
    + `Join with my link: ${referralLink(code)}`;
}

export const completePartnerProfile = (areas, rera) => rpc("partner_complete_profile", { p_areas: areas, p_rera: rera });

/* ── Internal: /sales-funnel ─────────────────────────────────────────────── */
export const fetchFunnel = () => rpc("partner_funnel");
export const decidePayment = (paymentId, approve, note = "") =>
  rpc("partner_admin_payment_decide", { p_payment: paymentId, p_approve: approve, p_note: note });
export const markReferralPaid = (id) => rpc("partner_admin_referral_paid", { p_referral: id });
export const savePlan = (p) => rpc("partner_admin_set_plan", {
  p_id: p.id, p_label: p.label, p_price: Number(p.price), p_months: Number(p.months), p_refund_days: Number(p.refund_days),
  p_note: p.note || "", p_payment_link: p.payment_link || "", p_active: p.active !== false,
});

/** ROI for the congratulations page: what the plan pays back, with the program's numbers. */
export function planRoi({ price, months }, s = {}) {
  const avg = Number(s.avgBrokerage) || 25000;
  const share = Number(s.propertyShare) || 50;
  const perDeal = Math.round(avg * (share / 100));
  const perMonthCost = Math.round(price / Math.max(1, months));
  return {
    perDeal,
    perMonthCost,
    dealsToBreakEven: Math.max(1, Math.ceil(price / Math.max(1, perDeal))),
    // Two MovEazy deals a month, the calculator's default.
    twoDealsMonthly: perDeal * 2,
    multiple: perMonthCost > 0 ? Math.round((perDeal * 2) / perMonthCost) : null,
  };
}
