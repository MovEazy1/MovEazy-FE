/**
 * Business UPI on /checkout — optional fallback beside Razorpay hosted link.
 * Personal VPAs must not be hardcoded; set VITE_BUSINESS_UPI_VPA or a static QR URL from Razorpay.
 */

function trimEnv(key) {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * @returns {{
 *   businessUpiVpa: string,
 *   checkoutQrImageUrl: string,
 *   whatsappOrderE164: string,
 *   hasDirectUpiFallback: boolean,
 * }}
 */
export function getBusinessUpiCheckoutEnv() {
  const businessUpiVpa = trimEnv("VITE_BUSINESS_UPI_VPA");
  const checkoutQrImageUrl = trimEnv("VITE_CHECKOUT_UPI_QR_IMAGE_URL");
  let whatsappOrderE164 = trimEnv("VITE_WHATSAPP_ORDER_E164") || "919413186425";
  whatsappOrderE164 = whatsappOrderE164.replace(/^\+/, "");

  return {
    businessUpiVpa,
    checkoutQrImageUrl,
    whatsappOrderE164,
    hasDirectUpiFallback: Boolean(businessUpiVpa || checkoutQrImageUrl),
  };
}
