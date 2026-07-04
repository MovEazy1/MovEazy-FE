/** MovEazy checkout / Razorpay product catalog — amounts in rupees for UPI; paise for Razorpay API. */

export const BRAND_PAYEE_NAME = "MovEazy";

export const PAYMENT_SKUS = {
  "flat-search": {
    key: "flat-search",
    amountRupee: 1499,
    amountPaise: "1499",
    title: "MovEazy Flat Search",
    subtitle: "On-ground search, filtering & visit scheduling — one-time fee",
    bullets: [
      "Dedicated area guide & shortlist",
      "Neighbourhood-fit filtering",
      "Visit scheduling & broker coordination",
      "WhatsApp updates through your search",
    ],
    whatsappPath:
      "I've%20paid%20₹1499%20for%20MovEazy%20Flat%20Search.%20Here's%20my%20receipt%20—%20please%20confirm%20next%20steps.",
    confirmTitle: "Flat Search payment",
    confirmBody:
      "We will verify your payment and assign your guide on WhatsApp within a few hours.",
    qrAlt: "UPI QR code for ₹1,499 MovEazy Flat Search",
  },
  guarantee: {
    key: "guarantee",
    amountRupee: 1999,
    amountPaise: "1999",
    title: "MovEazy Guarantee",
    subtitle: "Legal verification + escrow-style deposit protection",
    bullets: [
      "Binding contract verification",
      "Escrow-style deposit protection",
      "Broker negligence coverage",
      "24/7 legal support hotline",
      "100% refund if deal falls through",
    ],
    whatsappPath:
      "I've%20paid%20₹1999%20for%20MovEazy%20Deposit%20Saver.%20Here's%20my%20receipt.",
    confirmTitle: "Deposit Saver enrollment",
    confirmBody:
      "Our team will verify your payment and activate your plan within 2 hours. You'll receive a confirmation on WhatsApp.",
    qrAlt: "UPI QR code for ₹1,999 MovEazy Guarantee",
  },
  "personalized-match": {
    key: "personalized-match",
    amountRupee: 1999,
    amountPaise: "1999",
    title: "Personalized property match",
    subtitle: "Human-curated shortlist from your requirements — priority on exclusive listings",
    bullets: [
      "Shortlist matched to budget, commute & move-in date",
      "Exclusive & fast-moving deals surfaced first",
      "Priority queue when you are ready to visit or lock",
      "WhatsApp handoff to your area expert after payment",
    ],
    whatsappPath:
      "I've%20paid%20₹1999%20for%20Personalized%20Property%20Match.%20Here's%20my%20receipt%20—%20please%20send%20the%20intake%20form.",
    confirmTitle: "Personalized property match",
    confirmBody:
      "We will verify your ₹1,999 payment and send the intake form on WhatsApp within a few hours. A consultant will then build your curated shortlist.",
    qrAlt: "UPI QR code for ₹1,999 personalized property match",
  },
};

export function getPaymentProduct(searchParamsOrSku) {
  const raw =
    typeof searchParamsOrSku === "string"
      ? searchParamsOrSku
      : searchParamsOrSku?.get?.("sku") || "";
  const sku = String(raw || "").trim().toLowerCase();
  if (sku === "personalized-match") return PAYMENT_SKUS["flat-search"];
  if (sku === "flat-search") return PAYMENT_SKUS["flat-search"];
  if (sku === "deposit-saver") return PAYMENT_SKUS.guarantee;
  return PAYMENT_SKUS.guarantee;
}
