import { httpsCallable } from "firebase/functions";
import { functions, isFirebaseConfigured } from "./firebase";

/**
 * Server builds wa.me URL from private agent phone + customer profile (never exposed in public Firestore).
 * Requires deployed Cloud Function `createAgentWhatsAppConnect`.
 */
export async function requestAgentWhatsAppConnect(agentId) {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured");
  }
  const id = String(agentId || "").trim();
  if (!id) throw new Error("Missing agent");
  const fn = httpsCallable(functions, "createAgentWhatsAppConnect");
  const res = await fn({ agentId: id });
  const waUrl = res?.data?.waUrl;
  if (!waUrl || typeof waUrl !== "string") {
    throw new Error(res?.data?.error || "Could not start WhatsApp — try again or contact support.");
  }
  return waUrl;
}
