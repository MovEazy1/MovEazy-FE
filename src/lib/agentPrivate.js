import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

/** Normalize to WhatsApp wa.me digits (India 91…). */
export function normalizeWhatsAppE164(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length >= 10 && d.length <= 15) return d;
  return "";
}

export async function getAgentPrivatePhone(agentId) {
  if (!isFirebaseConfigured || !agentId) return "";
  try {
    const snap = await getDoc(doc(db, "agentPrivate", String(agentId)));
    if (!snap.exists()) return "";
    return normalizeWhatsAppE164(snap.data()?.whatsappE164 || snap.data()?.phoneE164 || "");
  } catch {
    return "";
  }
}

/** Admin: load private WhatsApp for many agents (doc id = agent id). */
export async function fetchAgentPrivateMap(agentIds) {
  const map = {};
  if (!isFirebaseConfigured) return map;
  const ids = [...new Set(agentIds.map((id) => String(id || "").trim()).filter(Boolean))];
  await Promise.all(
    ids.map(async (id) => {
      const phone = await getAgentPrivatePhone(id);
      if (phone) map[id] = phone;
    }),
  );
  return map;
}

export async function saveAgentPrivatePhone(agentId, whatsappRaw) {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured");
  const id = String(agentId || "").trim();
  if (!id) return;
  const whatsappE164 = normalizeWhatsAppE164(whatsappRaw);
  const ref = doc(db, "agentPrivate", id);
  if (!whatsappE164) {
    await setDoc(ref, { whatsappE164: "", updatedAt: serverTimestamp() }, { merge: true });
    return;
  }
  await setDoc(ref, { whatsappE164, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveAgentPrivateBatch(entries) {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured");
  await Promise.all(
    entries.map(({ agentId, whatsappPrivate }) => saveAgentPrivatePhone(agentId, whatsappPrivate)),
  );
}
