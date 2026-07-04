import { DEFAULT_CONTACT_TEAM } from "../lib/sitePublicSettings";

export { DEFAULT_CONTACT_TEAM };

const DEFAULT_WA_GREETING =
  "Hi — I'd like to book a free consultation with MovEazy. Please share next steps.";

export const SALES_WA_GREETING =
  "Hi — I'd like to speak with MovEazy sales about flat search or guarantee plans. Please share next steps.";

/** Kuldeep Meena — primary consultation WhatsApp. */
export const KULDEEP_MEENA_WHATSAPP = "https://wa.me/917055954373";

/** Build a WhatsApp deep link (E.164 digits without +). */
export function buildWhatsAppUrl(phoneRaw, message = DEFAULT_WA_GREETING) {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Build wa.me link from a contact row (uses explicit whatsappUrl when set). */
export function buildContactWhatsAppUrl(contact, message = DEFAULT_WA_GREETING) {
  const base = String(contact?.whatsappUrl || "")
    .trim()
    .split("?")[0];
  if (base.startsWith("https://wa.me/")) {
    return `${base}?text=${encodeURIComponent(message)}`;
  }
  return buildWhatsAppUrl(contact?.phoneRaw, message);
}

export function formatContactDisplayName(contact) {
  const name = String(contact?.name || "").trim();
  const title = String(contact?.title || "").trim();
  if (!name) return "MovEazy team";
  if (!title) return name;
  return `${name} (${title})`;
}

export function buildTeamWhatsAppUrl(message = DEFAULT_WA_GREETING) {
  const primary = DEFAULT_CONTACT_TEAM[0];
  if (!primary) return null;
  return buildContactWhatsAppUrl(primary, message);
}

export function whatsAppLabelForContact(contact) {
  const first = String(contact?.name || "team").split(/\s+/)[0];
  return `WhatsApp ${first}`;
}

export function formatTelHref(phoneRaw) {
  const digits = String(phoneRaw || "").replace(/\D/g, "");
  if (digits.length < 10) return "#";
  return `tel:+${digits}`;
}

export function contactRoleLabel(contact) {
  const role = String(contact?.role || "Sales").trim();
  return role || "Sales";
}
