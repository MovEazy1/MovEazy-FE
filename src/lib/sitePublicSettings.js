import { supabase, isSupabaseConfigured } from "./supabase";

export const CONTACT_GRADIENTS = [
  "from-red-500 to-orange-500",
  "from-blue-600 to-indigo-600",
  "from-emerald-600 to-teal-600",
  "from-violet-600 to-purple-600",
  "from-amber-500 to-rose-600",
  "from-cyan-600 to-blue-700",
];

export const DEFAULT_CONTACT_TEAM = [
  {
    name: "Kuldeep Meena",
    title: "IITK BS Physics",
    role: "Sales",
    phone: "+91 70559 54373",
    phoneRaw: "917055954373",
    whatsappUrl: "https://wa.me/917055954373",
    avatar: "KM",
    gradient: CONTACT_GRADIENTS[0],
  },
  {
    name: "Suresh Meena",
    title: "IITK Electrical",
    role: "Sales",
    phone: "+91 78179 40441",
    phoneRaw: "917817940441",
    whatsappUrl: "https://wa.me/917817940441",
    avatar: "SM",
    gradient: CONTACT_GRADIENTS[1],
  },
];

export const DEFAULT_SITE_PUBLIC = {
  contacts: DEFAULT_CONTACT_TEAM,
  supportEmail: "support@moveazy.co.in",
  privacyEmail: "privacy@moveazy.co.in",
  legalPhoneDisplay: "+91 70559 54373",
  legalPhoneTel: "tel:+917055954373",
};

const MAX_CONTACTS = 12;

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Build wa.me / tel id: prefer explicit phoneRaw digits, else parse from phone label. */
export function normalizePhoneRaw(phone, phoneRaw) {
  let d = onlyDigits(phoneRaw);
  if (!d) d = onlyDigits(phone);
  if (d.length === 10) d = `91${d}`;
  return d.slice(0, 15);
}

function normalizeContactEntry(c, index) {
  const name = String(c?.name || "")
    .trim()
    .slice(0, 80);
  const title = String(c?.title || "")
    .trim()
    .slice(0, 140);
  const role = String(c?.role || "Sales")
    .trim()
    .slice(0, 24);
  const phone = String(c?.phone || "")
    .trim()
    .slice(0, 48);
  const phoneRaw = normalizePhoneRaw(phone, c?.phoneRaw);
  const avatar = String(c?.avatar || "")
    .trim()
    .slice(0, 4)
    .toUpperCase() || initials(name);
  const g = String(c?.gradient || "").trim();
  const gradient = CONTACT_GRADIENTS.includes(g) ? g : CONTACT_GRADIENTS[index % CONTACT_GRADIENTS.length];
  const whatsappBase = String(c?.whatsappUrl || "")
    .trim()
    .split("?")[0];
  const whatsappUrl = whatsappBase.startsWith("https://wa.me/") ? whatsappBase : undefined;
  return {
    name,
    title,
    role: role || "Sales",
    phone: phone || formatPhoneDisplay(phoneRaw),
    phoneRaw,
    ...(whatsappUrl ? { whatsappUrl } : {}),
    avatar,
    gradient,
  };
}

function formatPhoneDisplay(phoneRaw) {
  const d = onlyDigits(phoneRaw);
  if (d.length >= 12 && d.startsWith("91")) {
    const rest = d.slice(2);
    if (rest.length === 10) return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  return phoneRaw ? `+${d}` : "";
}

function normalizeContactsArray(arr) {
  if (!Array.isArray(arr)) return null;
  const out = arr.slice(0, MAX_CONTACTS).map((c, i) => normalizeContactEntry(c, i));
  return out.filter((c) => c.name && c.phoneRaw.length >= 10);
}

/** Ensure Kuldeep / Suresh (and other defaults) stay on the public contact list. */
export function mergeDefaultContacts(contacts) {
  const list = Array.isArray(contacts) ? [...contacts] : [];
  const seen = new Set(list.map((c) => c.phoneRaw));
  for (const seed of DEFAULT_CONTACT_TEAM) {
    if (!seen.has(seed.phoneRaw)) {
      list.push({ ...seed });
      seen.add(seed.phoneRaw);
    }
  }
  return list.slice(0, MAX_CONTACTS);
}

function mergeSitePublic(data) {
  const base = { ...DEFAULT_SITE_PUBLIC, contacts: [...DEFAULT_CONTACT_TEAM] };
  if (!data || typeof data !== "object") return base;
  const contacts = normalizeContactsArray(data.contacts);
  return {
    contacts: mergeDefaultContacts(contacts?.length ? contacts : base.contacts),
    supportEmail: String(data.supportEmail || base.supportEmail)
      .trim()
      .slice(0, 120),
    privacyEmail: String(data.privacyEmail || base.privacyEmail)
      .trim()
      .slice(0, 120),
    legalPhoneDisplay: String(data.legalPhoneDisplay || base.legalPhoneDisplay)
      .trim()
      .slice(0, 48),
    legalPhoneTel: (() => {
      const t = String(data.legalPhoneTel || base.legalPhoneTel).trim();
      if (t.startsWith("tel:")) return t.slice(0, 40);
      const d = normalizePhoneRaw(data.legalPhoneDisplay, t);
      return d.length >= 10 ? `tel:+${d}` : base.legalPhoneTel;
    })(),
  };
}

export async function fetchSitePublicSettings() {
  const fallback = { ...DEFAULT_SITE_PUBLIC, contacts: [...DEFAULT_CONTACT_TEAM] };
  if (!isSupabaseConfigured || !supabase) return fallback;
  try {
    const { data, error } = await supabase
      .from("site_public_settings")
      .select("data")
      .eq("id", "public")
      .maybeSingle();
    if (error || !data) return fallback;
    return mergeSitePublic(data.data);
  } catch {
    return fallback;
  }
}

export function normalizeSitePublicForSave(draft) {
  const normalized = normalizeContactsArray(draft?.contacts);
  const contacts = mergeDefaultContacts(
    normalized?.length ? normalized : [...DEFAULT_CONTACT_TEAM],
  );
  return {
    contacts,
    supportEmail: String(draft?.supportEmail || DEFAULT_SITE_PUBLIC.supportEmail)
      .trim()
      .slice(0, 120),
    privacyEmail: String(draft?.privacyEmail || DEFAULT_SITE_PUBLIC.privacyEmail)
      .trim()
      .slice(0, 120),
    legalPhoneDisplay: String(draft?.legalPhoneDisplay || DEFAULT_SITE_PUBLIC.legalPhoneDisplay)
      .trim()
      .slice(0, 48),
    legalPhoneTel: (() => {
      const raw = String(draft?.legalPhoneTel || "").trim();
      if (raw.startsWith("tel:")) return raw.slice(0, 40);
      const d = normalizePhoneRaw(draft?.legalPhoneDisplay, raw);
      return d.length >= 10 ? `tel:+${d}` : DEFAULT_SITE_PUBLIC.legalPhoneTel;
    })(),
  };
}

export async function saveSitePublicSettings(draft) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured");
  const payload = normalizeSitePublicForSave(draft);
  const { error } = await supabase
    .from("site_public_settings")
    .upsert({ id: "public", data: payload, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw error;
}
