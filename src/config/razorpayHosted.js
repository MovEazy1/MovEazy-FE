/**
 * Razorpay Payment Pages (rzp.io) — hosted checkout with UPI, cards, netbanking, etc.
 * @see https://razorpay.com/docs/payments/payment-pages/
 */

/** Default MovEazy payment page from Razorpay Dashboard (replace per product when you create more links). */
export const RAZORPAY_PAYMENT_PAGE_DEFAULT = "https://rzp.io/rzp/fiQh2PZ";

function trimEnv(key) {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * @param {string} productKey - from paymentProducts: guarantee | flat-search | personalized-match
 */
export function getRazorpayHostedPaymentUrl(productKey) {
  const k = String(productKey || "guarantee").toLowerCase();
  const generic = trimEnv("VITE_RAZORPAY_PAYMENT_LINK");
  if (k === "flat-search") {
    const u = trimEnv("VITE_RAZORPAY_PAYMENT_LINK_FLAT") || generic;
    if (u) return u;
  }
  if (k === "guarantee") {
    const u = trimEnv("VITE_RAZORPAY_PAYMENT_LINK_DEPOSIT") || generic;
    if (u) return u;
  }
  if (k === "personalized-match") {
    const u = trimEnv("VITE_RAZORPAY_PAYMENT_LINK_MATCH") || generic;
    if (u) return u;
  }
  if (generic) return generic;
  return RAZORPAY_PAYMENT_PAGE_DEFAULT;
}
