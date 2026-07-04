// src/lib/emailService.js
import { reportClientError, reportClientWarn } from "./clientLog";
// Server-side onboarding email trigger — delivered via EmailJS from the browser.

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "";

export function isOnboardingEmailConfigured() {
  return Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
}

async function triggerEmailJsOnboarding({ email, name, role }) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    return { ok: false, skipped: true, error: "Onboarding email service is not configured." };
  }

  const templateParams = {
    to_email: String(email || ""),
    to_name: String(name || "MovEazy user"),
    role: role === "seller" ? "seller" : "customer",
  };

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: EMAILJS_SERVICE_ID, template_id: EMAILJS_TEMPLATE_ID, user_id: EMAILJS_PUBLIC_KEY, template_params: templateParams }),
    });
    if (!res.ok) {
      return { ok: false, retryable: res.status === 429 || res.status >= 500, error: res.status === 429 ? "Welcome email is rate-limited. Please try again later." : `Welcome email service returned ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : "Could not send welcome email." };
  }
}

export async function triggerVerifiedOnboardingEmails({ profile }) {
  return triggerEmailJsOnboarding({
    email: profile?.email,
    name: profile?.name || profile?.email?.split("@")[0],
    role: profile?.role || "customer",
  });
}

function adminEmailsFromEnv() {
  return String(import.meta.env.VITE_ADMIN_EMAILS || "jiyanshudhaka20@gmail.com")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Sends EmailJS messages to each admin and to the listing seller (if email present).
 * Uses VITE_EMAILJS_INTEREST_TEMPLATE_ID when set, otherwise the same template as visit/onboarding.
 */
export async function triggerListingInterestEmails({
  listingId,
  listingTitle,
  customerEmail,
  customerName,
  sellerEmail,
  sellerName,
  preference,
  adultsSharing,
  notes,
}) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY) {
    reportClientWarn("emailjs", "EmailJS not configured; skipping listing-interest emails.");
    return { ok: false, skipped: true };
  }
  const templateId = import.meta.env.VITE_EMAILJS_INTEREST_TEMPLATE_ID || EMAILJS_TEMPLATE_ID;
  if (!templateId) {
    reportClientWarn("emailjs", "No EmailJS template id; set VITE_EMAILJS_TEMPLATE_ID or VITE_EMAILJS_INTEREST_TEMPLATE_ID.");
    return { ok: false, skipped: true };
  }

  const baseParams = {
    listing_id: String(listingId ?? ""),
    listing_title: String(listingTitle ?? ""),
    customer_email: String(customerEmail ?? ""),
    customer_name: String(customerName ?? ""),
    seller_email: String(sellerEmail ?? ""),
    seller_name: String(sellerName ?? ""),
    preference: String(preference ?? ""),
    adults_sharing: String(adultsSharing ?? 1),
    notes: String(notes ?? "").slice(0, 800),
  };

  const sendOne = async (to_email) => {
    const template_params = { ...baseParams, to_email };
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params,
      }),
    });
    return res.ok;
  };

  const results = [];
  for (const em of adminEmailsFromEnv()) {
    results.push(await sendOne(em));
  }
  const se = String(sellerEmail || "").trim().toLowerCase();
  if (se.includes("@")) {
    results.push(await sendOne(se));
  }
  return { ok: results.some(Boolean), results };
}

/**
 * Email to the renter when application / assignment status changes.
 * Template should accept to_email, customer_name, listing_title, listing_id, status, status_label, previous_status, message.
 * Uses VITE_EMAILJS_STATUS_TEMPLATE_ID, then interest template, then VITE_EMAILJS_TEMPLATE_ID.
 */
export async function triggerCustomerApplicationStatusEmail({
  to_email,
  customer_name,
  listing_title,
  listing_id,
  status,
  status_label,
  previous_status,
  message,
}) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY) {
    reportClientWarn("emailjs", "EmailJS not configured; skipping customer status email.");
    return { ok: false, skipped: true };
  }
  const templateId =
    import.meta.env.VITE_EMAILJS_STATUS_TEMPLATE_ID ||
    import.meta.env.VITE_EMAILJS_INTEREST_TEMPLATE_ID ||
    EMAILJS_TEMPLATE_ID;
  if (!templateId) {
    reportClientWarn("emailjs", "No EmailJS template for customer status; set VITE_EMAILJS_STATUS_TEMPLATE_ID or VITE_EMAILJS_TEMPLATE_ID.");
    return { ok: false, skipped: true };
  }
  const to = String(to_email || "").trim().toLowerCase();
  if (!to.includes("@") || to.includes("guest@local")) {
    return { ok: false, skipped: true };
  }
  const template_params = {
    to_email: to,
    customer_name: String(customer_name || "there"),
    listing_title: String(listing_title || ""),
    listing_id: String(listing_id ?? ""),
    status: String(status || ""),
    status_label: String(status_label || ""),
    previous_status: String(previous_status ?? ""),
    message: String(message || "").slice(0, 2000),
  };
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params,
      }),
    });
    return { ok: res.ok };
  } catch (e) {
    reportClientError("emailjs_customer_status", e);
    return { ok: false };
  }
}

export async function triggerVisitNotificationEmail({ customerEmail, customerPhone, sellerEmail, visitTime, notes, listingId }) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    reportClientWarn("emailjs", "EmailJS not configured, skipping visit notification.");
    return { ok: false };
  }

  const templateParams = {
    customer_email: customerEmail,
    customer_phone: customerPhone,
    seller_email: sellerEmail,
    admin_email: "moveasy.official@gmail.com", // Assuming an admin email or default routing
    visit_time: visitTime,
    notes: notes,
    listing_id: listingId,
  };

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        service_id: EMAILJS_SERVICE_ID, 
        template_id: EMAILJS_TEMPLATE_ID, 
        user_id: EMAILJS_PUBLIC_KEY, 
        template_params: templateParams 
      }),
    });
    return { ok: res.ok };
  } catch (error) {
    reportClientError("emailjs_visit_notification", error);
    return { ok: false };
  }
}
