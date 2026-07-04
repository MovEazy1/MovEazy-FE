/**
 * Python Flat Agent API client (`be/agent`).
 * Set VITE_FLAT_AGENT_API_URL=http://127.0.0.1:8080 in fe/.env
 */

const BASE = String(import.meta.env.VITE_FLAT_AGENT_API_URL || "").replace(/\/$/, "");

export function isFlatAgentApiConfigured() {
  return Boolean(BASE);
}

export async function fetchFlatAgentStats() {
  if (!BASE) return null;
  const res = await fetch(`${BASE}/catalog/stats`);
  if (!res.ok) throw new Error(`Flat agent stats failed (${res.status})`);
  return res.json();
}

/**
 * @param {import('./flatRecommendationEngine').EMPTY_PREFERENCES extends infer T ? Record<string, unknown> : never} preferences
 * @param {{ limit?: number, minScore?: number }} [options]
 */
export async function fetchFlatAgentRecommendations(preferences, options = {}) {
  if (!BASE) throw new Error("VITE_FLAT_AGENT_API_URL is not configured");

  const res = await fetch(`${BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      preferences: {
        areas: preferences.areas || [],
        budgetMin: preferences.budgetMin ?? null,
        budgetMax: preferences.budgetMax ?? null,
        bhk: preferences.bhk || "",
        furnishing: preferences.furnishing || "",
        timeline: preferences.timeline || "",
        mustHaves: preferences.mustHaves || "",
      },
      limit: options.limit ?? 8,
      minScore: options.minScore ?? 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err || `Recommend failed (${res.status})`);
  }

  const data = await res.json();
  return {
    recommendations: (data.recommendations || []).map((row) => ({
      listing: row.listing,
      score: row.score,
      ruleScore: row.ruleScore,
      mlScore: row.mlScore,
      breakdown: row.breakdown,
    })),
    catalogSize: data.catalogSize ?? 0,
    modelLoaded: Boolean(data.modelLoaded),
  };
}

export async function checkFlatAgentHealth() {
  if (!BASE) return false;
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
