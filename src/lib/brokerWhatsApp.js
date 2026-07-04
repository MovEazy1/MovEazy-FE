import { buildWhatsAppUrl } from "../config/contactChannels";
import { isSupabaseConfigured, supabase } from "./supabase";

/** Prefilled WhatsApp message when a renter contacts a broker about a listing. */
export function buildListingInterestMessage({ user, property }) {
  const name = user?.name?.trim() || user?.email?.split("@")[0] || "there";
  const title = String(property?.title || property?.listingTitle || "a property on Moveazy").trim();
  const area = String(
    property?.area || property?.address || property?.locationDetails || property?.neighborhood || ""
  ).trim();
  const rentRaw = property?.rent ?? property?.monthlyRent ?? property?.price;
  const rentNum = typeof rentRaw === "number" ? rentRaw : Number(String(rentRaw || "").replace(/[^\d.]/g, ""));
  const rentLine = Number.isFinite(rentNum) && rentNum > 0
    ? ` Rent: ₹${rentNum.toLocaleString("en-IN")}/mo.`
    : "";
  const areaLine = area ? ` Area: ${area}.` : "";

  return (
    `Hi, my name is ${name}. I'm looking at this property on Moveazy:\n` +
    `"${title}".${areaLine}${rentLine}\n\n` +
    `I'm interested in this home. Please share availability and next steps.`
  );
}

/** Resolve broker/listing contact phone (digits only). */
export function resolveBrokerPhone(property, privatePhone = "") {
  const candidates = [
    privatePhone,
    property?.brokerPhone,
    property?.ownerPhone,
    property?.owner_phone,
    property?.contact,
    property?.phone,
    import.meta.env.VITE_BROKER_WHATSAPP,
    import.meta.env.VITE_WHATSAPP_ORDER_E164,
  ];
  for (const raw of candidates) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length >= 10) return digits;
  }
  return null;
}

export function buildBrokerWhatsAppUrl({ user, property, privatePhone = "" }) {
  const phone = resolveBrokerPhone(property, privatePhone);
  if (!phone) return null;
  const message = buildListingInterestMessage({ user, property });
  return buildWhatsAppUrl(phone, message);
}

async function resolveBrokerId(property) {
  const direct = property?.broker_id || property?.brokerId || null;
  if (direct) return String(direct);
  const propertyId = property?.id ? String(property.id) : null;
  if (!propertyId || !isSupabaseConfigured || !supabase) return null;
  const { data } = await supabase
    .from("properties")
    .select("broker_id")
    .eq("id", propertyId)
    .maybeSingle();
  return data?.broker_id ? String(data.broker_id) : null;
}

export async function logBrokerWhatsAppContact({ user, property, privatePhone = "", source = "property_whatsapp" }) {
  if (!isSupabaseConfigured || !supabase || !property) return;

  const phone = resolveBrokerPhone(property, privatePhone);
  const message = buildListingInterestMessage({ user, property });
  const rentRaw = property?.rent ?? property?.monthlyRent ?? property?.rent_amount ?? property?.price;
  const rentAmount = typeof rentRaw === "number"
    ? rentRaw
    : Number(String(rentRaw || "").replace(/[^\d.]/g, ""));

  const brokerId = await resolveBrokerId(property);

  const payload = {
    broker_id: brokerId,
    property_id: property?.id ? String(property.id) : null,
    property_title: String(property?.title || property?.listingTitle || "").slice(0, 240),
    property_area: String(property?.area || property?.address || property?.locationDetails || property?.neighborhood || "").slice(0, 240),
    rent_amount: Number.isFinite(rentAmount) ? rentAmount : null,
    customer_uid: user?.uid ? String(user.uid) : null,
    customer_name: String(user?.name || "").slice(0, 160),
    customer_email: String(user?.email || "").toLowerCase().trim() || null,
    customer_phone: String(user?.phone || "").slice(0, 60),
    broker_phone_last4: phone ? phone.slice(-4) : null,
    message,
    source,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
  };

  const { error } = await supabase.from("broker_whatsapp_contacts").insert([payload]);
  if (error) {
    // Do not block WhatsApp redirect if the analytics table is not migrated yet.
    console.warn("broker_whatsapp_contacts insert failed:", error.message);
  }
}

/** Open broker WhatsApp in a new tab. Returns false if no phone available. */
export async function openBrokerWhatsApp({ user, property, privatePhone = "", source }) {
  const url = buildBrokerWhatsAppUrl({ user, property, privatePhone });
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  void logBrokerWhatsAppContact({ user, property, privatePhone, source });
  return true;
}
