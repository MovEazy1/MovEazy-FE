import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { AGENTS as SEED_AGENTS } from "../data/agentsDirectory";
import { db, isFirebaseConfigured } from "./firebase";

const DOC_ID = "directoryAgents";
const MAX_AGENTS = 48;

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toList(value) {
  if (Array.isArray(value)) return value.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAgent(raw, index) {
  const tab = raw?.tab === "brokers" ? "brokers" : "experts";
  const name = String(raw?.name || "")
    .trim()
    .slice(0, 80);
  if (!name) return null;
  const budgetTier = [1, 2, 3, 4].includes(Number(raw?.budgetTier)) ? Number(raw.budgetTier) : 2;
  return {
    id: String(raw?.id || `agent-${index + 1}`).slice(0, 64),
    tab,
    name,
    initials:
      String(raw?.initials || "")
        .trim()
        .slice(0, 3)
        .toUpperCase() || initials(name),
    team: Boolean(raw?.team),
    brokerage: String(raw?.brokerage || "MovEazy").trim().slice(0, 120),
    priceRangeLabel: String(raw?.priceRangeLabel || "").trim().slice(0, 120),
    recentActivity: String(raw?.recentActivity || "").trim().slice(0, 120),
    localExpertise: String(raw?.localExpertise || "").trim().slice(0, 160),
    specialties: toList(raw?.specialties).slice(0, 8),
    languages: toList(raw?.languages).slice(0, 8),
    areas: toList(raw?.areas).slice(0, 12),
    rentFocus: raw?.rentFocus !== false,
    buyFocus: Boolean(raw?.buyFocus),
    budgetTier,
    sortOrder: Number.isFinite(raw?.sortOrder) ? raw.sortOrder : index,
  };
}

function stripLegacyFields(agent) {
  const { rating, reviewCount, topRated, ...rest } = agent || {};
  void rating;
  void reviewCount;
  void topRated;
  return rest;
}

export function getDefaultDirectoryAgents() {
  return SEED_AGENTS.map((a, i) => normalizeAgent(stripLegacyFields({ ...a, sortOrder: i }), i)).filter(Boolean);
}

function normalizeAgentsArray(arr) {
  if (!Array.isArray(arr)) return null;
  const out = arr
    .slice(0, MAX_AGENTS)
    .map((a, i) => normalizeAgent(stripLegacyFields(a), i))
    .filter(Boolean);
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchDirectoryAgents() {
  const fallback = getDefaultDirectoryAgents();
  if (!isFirebaseConfigured) return fallback;
  try {
    const ref = doc(db, "siteSettings", DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return fallback;
    const normalized = normalizeAgentsArray(snap.data()?.agents);
    return normalized?.length ? normalized : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeDirectoryAgentsForSave(draft) {
  const normalized = normalizeAgentsArray(draft);
  return normalized?.length ? normalized : getDefaultDirectoryAgents();
}

export async function saveDirectoryAgents(draft) {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured");
  const agents = normalizeDirectoryAgentsForSave(draft).map((a, i) => ({ ...a, sortOrder: i }));
  await setDoc(
    doc(db, "siteSettings", DOC_ID),
    {
      agents,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return agents;
}
