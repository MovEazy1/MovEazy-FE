import {
  BHK_OPTIONS,
  BUDGET_PRESETS,
  EMPTY_PREFERENCES,
  FURNISHING_OPTIONS,
  POPULAR_AREAS,
  TIMELINE_OPTIONS,
  recommendListings,
} from "./flatRecommendationEngine";

export const AGENT_STEPS = [
  "welcome",
  "area",
  "budget",
  "bhk",
  "furnishing",
  "timeline",
  "mustHaves",
  "results",
];

function parseRentNumber(text) {
  const t = String(text || "").toLowerCase().replace(/,/g, "").replace(/₹/g, "").trim();
  const range = t.match(/(\d+(?:\.\d+)?)\s*(?:k|000)?\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(?:k|000)?/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const mul = (n) => (n < 1000 ? n * 1000 : n);
    return { min: mul(Math.min(a, b)), max: mul(Math.max(a, b)) };
  }
  const under = t.match(/(?:under|below|max|upto|up to)\s*(\d+(?:\.\d+)?)\s*(k|000)?/);
  if (under) {
    const n = Number(under[1]);
    const max = n < 1000 ? n * 1000 : n;
    return { min: null, max };
  }
  const single = t.match(/(\d+(?:\.\d+)?)\s*(k|000)?/);
  if (single) {
    const n = Number(single[1]);
    const val = n < 1000 ? n * 1000 : n;
    return { min: Math.round(val * 0.85), max: Math.round(val * 1.15) };
  }
  return null;
}

function matchFromOptions(input, options) {
  const t = String(input || "").trim().toLowerCase();
  if (!t) return null;
  const exact = options.find((o) => o.toLowerCase() === t);
  if (exact) return exact;
  const partial = options.find((o) => t.includes(o.toLowerCase()) || o.toLowerCase().includes(t));
  return partial || null;
}

const AREA_ALIASES = {
  hsr: "HSR Layout",
  "hsr layout": "HSR Layout",
  koramangala: "Koramangala",
  indiranagar: "Indiranagar",
  bellandur: "Bellandur",
  whitefield: "Whitefield",
  mahadevpura: "Mahadevpura",
  jayanagar: "Jayanagar",
  hebbal: "Hebbal",
  marathahalli: "Marathahalli",
  "electronic city": "Electronic City",
  "sarjapur": "Sarjapur Road",
  btm: "BTM Layout",
};

function parseAreas(input) {
  const t = String(input || "").trim();
  if (!t) return null;
  if (/flexible|any|anywhere|no preference|doesn.t matter/i.test(t)) return ["Flexible"];
  const found = POPULAR_AREAS.filter((a) => t.toLowerCase().includes(a.toLowerCase()));
  for (const [alias, canonical] of Object.entries(AREA_ALIASES)) {
    if (new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(t) && !found.includes(canonical)) {
      found.push(canonical);
    }
  }
  if (found.length) return found;
  const parts = t
    .split(/[,;/]+|\band\b/)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 4) : null;
}

function parseBudget(input) {
  const preset = BUDGET_PRESETS.find(
    (p) =>
      String(input || "")
        .toLowerCase()
        .includes(p.label.toLowerCase().replace(/[–-]/g, "-")) ||
      String(input || "").includes(String(p.min)) ||
      String(input || "").includes(String(p.max)),
  );
  if (preset) return { budgetMin: preset.min, budgetMax: preset.max, label: preset.label };
  const parsed = parseRentNumber(input);
  if (parsed) {
    return {
      budgetMin: parsed.min,
      budgetMax: parsed.max,
      label:
        parsed.min != null && parsed.max != null
          ? `₹${Math.round(parsed.min / 1000)}k – ₹${Math.round(parsed.max / 1000)}k`
          : parsed.max != null
            ? `Up to ₹${Math.round(parsed.max / 1000)}k`
            : "",
    };
  }
  return null;
}

function parseBhk(input) {
  const t = String(input || "").toUpperCase();
  if (/ROOMMATE|FLATMATE|SHARING/.test(t)) return "Roommate needed";
  if (/1\s*RK|RK/.test(t)) return "1 RK";
  if (/1\s*BHK/.test(t)) return "1 BHK";
  if (/2\s*BHK/.test(t)) return "2 BHK";
  if (/3\+|4\s*BHK/.test(t)) return "3+ BHK";
  if (/3\s*BHK/.test(t)) return "3 BHK";
  return matchFromOptions(input, BHK_OPTIONS);
}

function parseFurnishing(input) {
  const t = String(input || "").toLowerCase();
  if (/any|flex|no pref|doesn.t matter/.test(t)) return "Any";
  if (/unfurn|none|empty/.test(t)) return "None";
  if (/semi|partial/.test(t)) return "Semi";
  if (/full|furnish/.test(t)) return "Full";
  return matchFromOptions(input, FURNISHING_OPTIONS);
}

function parseTimeline(input) {
  const t = String(input || "").toLowerCase();
  if (/flex|no rush|whenever/.test(t)) return "Flexible";
  if (/immediate|asap|now|urgent/.test(t)) return "Immediate";
  if (/15|two week|2 week/.test(t)) return "Within 15 days";
  if (/30|month|one month/.test(t)) return "Within 30 days";
  return matchFromOptions(input, TIMELINE_OPTIONS);
}

export function getStepPrompt(step, prefs = EMPTY_PREFERENCES) {
  switch (step) {
    case "welcome":
      return {
        text: "Hi! I'm your MovEazy flat search assistant. I'll ask a few quick questions and recommend homes from our live listings — updated from verified broker feeds across Bangalore.",
        quickReplies: ["Let's go", "Help me find a flat"],
      };
    case "area":
      return {
        text: "Which area(s) are you looking in? You can pick one or type a few (e.g. HSR, Koramangala).",
        quickReplies: [...POPULAR_AREAS.slice(0, 6), "Flexible"],
      };
    case "budget":
      return {
        text: "What's your monthly rent budget?",
        quickReplies: BUDGET_PRESETS.map((b) => b.label),
      };
    case "bhk":
      return {
        text: "How many bedrooms do you need?",
        quickReplies: [...BHK_OPTIONS.slice(0, 5), "Any"],
      };
    case "furnishing":
      return {
        text: "Furnishing preference?",
        quickReplies: FURNISHING_OPTIONS,
      };
    case "timeline":
      return {
        text: "When do you want to move in?",
        quickReplies: TIMELINE_OPTIONS,
      };
    case "mustHaves":
      return {
        text: "Any must-haves? (e.g. parking, pet-friendly, gym). Type them or say skip.",
        quickReplies: ["Parking", "Pet-friendly", "Gym", "Skip"],
      };
    case "results": {
      const areaLabel = prefs.areas?.join(", ") || "Bangalore";
      const budgetLabel =
        prefs.budgetMin != null && prefs.budgetMax != null
          ? `₹${Math.round(prefs.budgetMin / 1000)}k–₹${Math.round(prefs.budgetMax / 1000)}k`
          : "your budget";
      return {
        text: `Here are my top picks for ${areaLabel} around ${budgetLabel}. Tap a card for details.`,
        quickReplies: ["Start over", "Browse all listings"],
      };
    }
    default:
      return { text: "How can I help with your flat search?", quickReplies: [] };
  }
}

export function parseStepInput(step, input) {
  const text = String(input || "").trim();
  if (!text) return { ok: false, error: "Please type a reply or tap a suggestion." };

  switch (step) {
    case "welcome":
      return { ok: true, patch: {} };
    case "area": {
      const areas = parseAreas(text);
      if (!areas) return { ok: false, error: "Tell me an area like HSR Layout or Koramangala." };
      return { ok: true, patch: { areas } };
    }
    case "budget": {
      const b = parseBudget(text);
      if (!b) return { ok: false, error: "Try a range like 25k–50k or tap a budget option." };
      return { ok: true, patch: { budgetMin: b.budgetMin, budgetMax: b.budgetMax, budgetLabel: b.label } };
    }
    case "bhk": {
      const bhk = text.toLowerCase() === "any" ? "" : parseBhk(text);
      if (!bhk && text.toLowerCase() !== "any") {
        return { ok: false, error: "Pick a BHK like 2 BHK or tap Any." };
      }
      return { ok: true, patch: { bhk: bhk || "" } };
    }
    case "furnishing": {
      const furnishing = parseFurnishing(text);
      if (!furnishing) return { ok: false, error: "Choose Full, Semi, None, or Any." };
      return { ok: true, patch: { furnishing: furnishing === "Any" ? "" : furnishing } };
    }
    case "timeline": {
      const timeline = parseTimeline(text);
      if (!timeline) return { ok: false, error: "When do you want to move? Try Immediate or Flexible." };
      return { ok: true, patch: { timeline } };
    }
    case "mustHaves":
      if (/^skip$|^no$|^none$|^nothing$/i.test(text)) return { ok: true, patch: { mustHaves: "" } };
      return { ok: true, patch: { mustHaves: text.slice(0, 500) } };
    default:
      return { ok: true, patch: {} };
  }
}

/** First step in the flow whose answer isn't already known — lets us skip
 * questions the customer already answered on their dashboard profile. */
export function firstMissingStep(prefs = EMPTY_PREFERENCES) {
  if (!prefs.areas?.length) return "area";
  if (prefs.budgetMin == null && prefs.budgetMax == null) return "budget";
  if (!prefs.bhk) return "bhk";
  if (!prefs.furnishing) return "furnishing";
  if (!prefs.timeline) return "timeline";
  if (!prefs.mustHaves) return "mustHaves";
  return "results";
}

export function nextStep(currentStep, prefs) {
  const idx = AGENT_STEPS.indexOf(currentStep);
  if (idx < 0 || idx >= AGENT_STEPS.length - 1) return "results";
  if (currentStep === "welcome" && prefs) return firstMissingStep(prefs);
  return AGENT_STEPS[idx + 1];
}

export function createInitialAgentState(preferencesOverride) {
  return {
    step: "welcome",
    preferences: { ...EMPTY_PREFERENCES, ...preferencesOverride },
    messages: [],
  };
}

export function runRecommendations(listings, preferences) {
  return recommendListings(listings, preferences, { limit: 8, minScore: 0.3 });
}
