import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, RotateCcw, MapPin, ExternalLink, Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchCustomerSearchProfile, saveCustomerSearchProfile } from "../lib/customerSearchProfile";
import { createChatSession, saveChatMessage, updateChatSessionPreferences } from "../lib/chatbotSessionStore";
import { openBrokerWhatsApp } from "../lib/brokerWhatsApp";
import { isPropertySaved, toggleSavedProperty } from "../lib/savedProperties";
import { logSavedListingChange } from "../lib/crmSync";
import PropertyModal from "./PropertyModal";
import {
  AGENT_STEPS,
  createInitialAgentState,
  getStepPrompt,
  nextStep,
  parseStepInput,
} from "../lib/flatSearchAgent";
import { buildRecommendationMapHref } from "../lib/flatRecommendationEngine";
import {
  checkFlatAgentHealth,
  fetchFlatAgentRecommendations,
  fetchFlatAgentStats,
  isFlatAgentApiConfigured,
} from "../lib/flatAgentApi";

function listingLocality(listing) {
  const parts = [listing.area, listing.address, listing.location, listing.title]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  if (!parts.length) return "Bengaluru";
  return parts[0].split(",")[0].trim();
}

function fmtRent(val) {
  if (!val) return "—";
  const n = typeof val === "number" ? val : Number(String(val).replace(/[^0-9.]/g, ""));
  if (!n) return String(val);
  return `₹${n.toLocaleString("en-IN")}/mo`;
}

/* ── Requirement Brief Card ────────────────────────────────────────────────── */
function RequirementBriefCard({ prefs, matchCount, loading }) {
  const rows = [
    { label: "Area",       value: (prefs.areas || []).join(", ") || "Flexible" },
    { label: "Home size",  value: prefs.bhk || "Any" },
    { label: "Furnishing", value: prefs.furnishing || "Any" },
    { label: "Budget",     value: prefs.budgetMax
        ? `₹${Number(prefs.budgetMax).toLocaleString("en-IN")}/mo`
        : prefs.budgetLabel || "—" },
    { label: "Move-in",    value: prefs.timeline || "Flexible" },
    prefs.mustHaves ? { label: "Must-haves", value: prefs.mustHaves } : null,
  ].filter(Boolean);

  const area = (prefs.areas || [])[0] || "Bangalore";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        background: "#F7F4ED", border: "1px solid #D9D3C4", borderRadius: 16,
        padding: "20px 18px", margin: "4px 0", position: "relative",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Verified stamp */}
      <div style={{
        position: "absolute", top: 14, right: 14,
        width: 58, height: 58, borderRadius: "50%",
        border: "2px solid #C8500F", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 1,
      }}>
        <span style={{ fontSize: 7.5, fontWeight: 800, color: "#C8500F", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.2 }}>
          VERIFIED
        </span>
        <span style={{ fontSize: 7.5, fontWeight: 800, color: "#C8500F", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.2 }}>
          BRIEF
        </span>
      </div>

      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, color: "#8B8578", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        Requirement Brief — Confirmed
      </div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 600, color: "#1A2421", lineHeight: 1.25, marginBottom: 16, paddingRight: 64 }}>
        Here&apos;s how you told us you want to live.
      </div>

      {/* Table */}
      <div style={{ borderTop: "1px solid #D9D3C4" }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            padding: "8px 0", borderBottom: "1px solid #EAE6DC", gap: 12,
          }}>
            <span style={{ fontSize: 12.5, color: "#8B8578", fontWeight: 400, flexShrink: 0 }}>{r.label}</span>
            <span style={{ fontSize: 13, color: "#1A2421", fontWeight: 600, textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Matching status */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 7 }}>
        {loading ? (
          <>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C8500F", flexShrink: 0, animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 12, color: "#8B8578" }}>Matching against verified listings in {area}…</span>
          </>
        ) : (
          <>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2D6A4F", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#2D6A4F", fontWeight: 600 }}>
              {matchCount} match{matchCount !== 1 ? "es" : ""} found
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ── Property Match Card ────────────────────────────────────────────────────── */
function AgentListingCard({ row, onOpen, onEnquire }) {
  const { user } = useAuth();
  const { listing, score } = row;
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const trustScore = Math.min(99, Math.max(60, Math.round(score * 100)));
  const rent = listing.monthlyRent || listing.rent || listing.price;
  const bhk = String(listing.bhk || "").replace(/\s+/g, " ") || "Flat";
  const locality = listingLocality(listing);
  const address = [listing.address, listing.location]
    .map((x) => String(x || "").trim()).filter(Boolean)[0] || locality;
  const floor = listing.floor ? `${listing.floor}${["st","nd","rd"][listing.floor-1] || "th"} floor` : null;
  const isVerified = listing.verified || listing.ownerVerified || score > 0.7;

  // Amenity chips — pick up to 3 from known fields
  const rawAmenities = [
    ...(listing.amenities || []),
    listing.parking && "Parking included",
    listing.petFriendly && "Pet friendly",
    listing.gym && "Gym",
    listing.powerBackup && "Power backup 24×7",
    listing.lift && "Lift",
    listing.nearMetro && "Near metro",
    listing.facing && `${listing.facing}-facing`,
  ].filter(Boolean).slice(0, 4);

  useEffect(() => {
    let alive = true;
    isPropertySaved(user, listing.id).then((v) => {
      if (alive) setSaved(v);
    });
    return () => { alive = false; };
  }, [user, listing.id]);

  const handleSave = async (e) => {
    e.stopPropagation();
    if (savePending) return;
    setSavePending(true);
    try {
      const now = await toggleSavedProperty(user, listing);
      setSaved(now);
      void logSavedListingChange(user, listing.id, now, listing.title);
    } finally {
      setSavePending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "#FFFEFB", border: "1px solid #D9D3C4", borderRadius: 14,
        padding: "16px 16px 12px", fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: "#1A2421", marginBottom: 2, lineHeight: 1.2 }}>
            {listing.title || `${bhk} in ${locality}`}
          </div>
          <div style={{ fontSize: 11.5, color: "#8B8578" }}>{address}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={savePending}
            aria-label={saved ? "Remove from saved" : "Save listing"}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              border: `1.5px solid ${saved ? "#C8500F" : "#D9D3C4"}`,
              background: saved ? "#FBEAE0" : "#FFFEFB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: savePending ? "wait" : "pointer",
            }}
          >
            <Heart size={16} color={saved ? "#C8500F" : "#8B8578"} fill={saved ? "#C8500F" : "none"} />
          </button>
          {/* Trust Score badge */}
          <div style={{
            width: 52, height: 52, borderRadius: 10, flexShrink: 0,
            border: `2px solid #2D6A4F`, background: "#E3EEE7",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#2D6A4F", lineHeight: 1 }}>{trustScore}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#2D6A4F", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "JetBrains Mono, monospace" }}>TRUST</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 18, marginBottom: 10 }}>
        {[
          { label: "RENT",  value: fmtRent(rent) },
          { label: "TYPE",  value: bhk },
          floor ? { label: "FLOOR", value: floor } : null,
        ].filter(Boolean).map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#8B8578", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "JetBrains Mono, monospace", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A2421" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {isVerified && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600, color: "#2D6A4F",
            background: "#E3EEE7", border: "1px solid #2D6A4F",
            padding: "3px 10px", borderRadius: 99,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10"><path d="M4 12l5 5L20 7"/></svg>
            Owner verified
          </span>
        )}
        {rawAmenities.map((a) => (
          <span key={a} style={{ fontSize: 11, color: "#4a5568", background: "#F0ECE4", padding: "3px 10px", borderRadius: 99, fontWeight: 500 }}>
            {a}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onOpen(listing)}
          style={{
            flex: 1, height: 38, borderRadius: 8,
            border: "1.5px solid #D9D3C4", background: "#FFFEFB",
            fontSize: 13, fontWeight: 600, color: "#1A2421", cursor: "pointer",
          }}
        >
          View details
        </button>
        <button
          type="button"
          onClick={() => onEnquire(listing)}
          style={{
            flex: 1, height: 38, borderRadius: 8,
            background: "#25D366", border: "none",
            fontSize: 13, fontWeight: 600, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            cursor: "pointer",
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.829L.057 23.625a.375.375 0 00.46.46l5.797-1.466A11.95 11.95 0 0012 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.83 9.83 0 01-5.012-1.37l-.36-.213-3.71.939.955-3.624-.234-.373A9.783 9.783 0 012.182 12c0-5.422 4.396-9.818 9.818-9.818 5.423 0 9.818 4.396 9.818 9.818 0 5.423-4.395 9.818-9.818 9.818z"/></svg>
          Enquire
        </button>
      </div>
    </motion.div>
  );
}

const CHAT_STORAGE_PREFIX = "movEazyFlatChat:";

function loadStoredChatState(key) {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredChatState(key, state) {
  try {
    localStorage.setItem(
      CHAT_STORAGE_PREFIX + key,
      JSON.stringify({
        step: state.step,
        preferences: state.preferences,
        messages: state.messages,
        quickReplies: state.quickReplies,
        sessionId: state.sessionId,
      }),
    );
  } catch {
    /* storage unavailable (private mode, quota) — chat just won't persist */
  }
}

function clearStoredChatState(key) {
  try {
    localStorage.removeItem(CHAT_STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
}

function ChatBubble({ role, children }) {
  const isAgent = role === "agent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isAgent
            ? "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
            : "bg-rose-600 text-white rounded-tr-md"
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

export default function FlatSearchAgentChat({ compact = false, embedded = false, className = "" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const storageKey = user?.uid || "guest";
  const [state, setState] = useState(createInitialAgentState);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loadingListings, setLoadingListings] = useState(true);
  const [selectedListing, setSelectedListing] = useState(null);
  const [enquireIntent, setEnquireIntent] = useState(false);
  const [typing, setTyping] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState({ size: 0, modelLoaded: false });
  const usePythonApi = isFlatAgentApiConfigured();
  const agentUnavailable = !usePythonApi || !apiOnline;
  const syncedResultsRef = useRef(false);
  const sessionIdRef = useRef(null);
  const sessionCreatingRef = useRef(null);

  // Get (or lazily create) the chatbot_sessions row backing this conversation.
  const ensureChatSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    if (sessionCreatingRef.current) return sessionCreatingRef.current;
    sessionCreatingRef.current = (async () => {
      const id = await createChatSession(user?.uid, state.preferences);
      sessionIdRef.current = id;
      if (id) setState((prev) => ({ ...prev, sessionId: id }));
      return id;
    })();
    const id = await sessionCreatingRef.current;
    sessionCreatingRef.current = null;
    return id;
  }, [user?.uid, state.preferences]);

  // Restore an in-progress conversation for this browser + user, or pre-fill
  // known answers from the customer's saved dashboard search profile.
  useEffect(() => {
    let alive = true;
    setHydrated(false);
    async function hydrate() {
      const stored = loadStoredChatState(storageKey);
      if (stored) {
        sessionIdRef.current = stored.sessionId || null;
        if (alive) setState(stored);
        if (alive) setHydrated(true);
        return;
      }
      sessionIdRef.current = null;

      if (user?.uid && user?.role === "customer") {
        try {
          const profile = await fetchCustomerSearchProfile(user.uid);
          const overrides = {
            areas: profile.preferredAreas?.length ? profile.preferredAreas : [],
            budgetMin: profile.budgetMin,
            budgetMax: profile.budgetMax,
            bhk: profile.bhk || "",
            mustHaves: profile.mustHaves || "",
          };
          const hasSavedAnswers = overrides.areas.length || overrides.budgetMax || overrides.bhk || overrides.mustHaves;
          if (alive) setState(createInitialAgentState(hasSavedAnswers ? overrides : undefined));
        } catch {
          if (alive) setState(createInitialAgentState());
        }
      } else if (alive) {
        setState(createInitialAgentState());
      }
      if (alive) setHydrated(true);
    }
    hydrate();
    return () => {
      alive = false;
    };
  }, [storageKey, user?.uid, user?.role]);

  // Persist progress so a refresh (or navigating away and back) doesn't lose it.
  useEffect(() => {
    if (!hydrated) return;
    saveStoredChatState(storageKey, state);
  }, [hydrated, storageKey, state]);

  // Once the customer reaches results, save the confirmed preferences back to
  // their dashboard profile so both stay in sync without asking them twice.
  useEffect(() => {
    if (state.step !== "results") {
      syncedResultsRef.current = false;
      return;
    }
    if (syncedResultsRef.current || !user?.uid || user?.role !== "customer") return;
    syncedResultsRef.current = true;
    const p = state.preferences;
    saveCustomerSearchProfile(user.uid, {
      preferredAreas: p.areas || [],
      budgetMin: p.budgetMin,
      budgetMax: p.budgetMax,
      bhk: p.bhk || "",
      mustHaves: p.mustHaves || "",
    }).catch(() => {
      /* best-effort sync — chat still works if this fails */
    });
  }, [state.step, state.preferences, user?.uid, user?.role]);

  // Keep the stored session's preferences snapshot in sync as the customer answers.
  useEffect(() => {
    if (!sessionIdRef.current) return;
    updateChatSessionPreferences(sessionIdRef.current, state.preferences);
  }, [state.preferences]);

  // Listings live only in Supabase, served through the Python flat-agent API — no local/browser fallback.
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoadingListings(true);
      if (!usePythonApi) {
        if (alive) {
          setApiOnline(false);
          setLoadingListings(false);
        }
        return;
      }
      try {
        const healthy = await checkFlatAgentHealth();
        if (!alive) return;
        setApiOnline(healthy);
        if (healthy) {
          const stats = await fetchFlatAgentStats();
          if (!alive) return;
          setCatalogInfo({ size: stats.catalogSize || 0, modelLoaded: Boolean(stats.modelLoaded) });
        }
      } catch {
        if (alive) setApiOnline(false);
      } finally {
        if (alive) setLoadingListings(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [usePythonApi]);

  useEffect(() => {
    if (state.step !== "results") {
      setRecommendations([]);
      return;
    }
    if (agentUnavailable) {
      setRecommendations([]);
      return;
    }

    let alive = true;
    async function loadRecommendations() {
      setRecoLoading(true);
      try {
        const result = await fetchFlatAgentRecommendations(state.preferences);
        if (!alive) return;
        setRecommendations(result.recommendations);
        setCatalogInfo({ size: result.catalogSize, modelLoaded: result.modelLoaded });
      } catch {
        if (alive) setRecommendations([]);
      } finally {
        if (alive) setRecoLoading(false);
      }
    }

    loadRecommendations();
    return () => {
      alive = false;
    };
  }, [state.step, state.preferences, agentUnavailable]);

  const pushMessage = useCallback(
    (role, text) => {
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, { id: `${Date.now()}-${Math.random()}`, role, text }],
      }));
      ensureChatSession().then((sessionId) => saveChatMessage(sessionId, role, text));
    },
    [ensureChatSession],
  );

  const showAgentPrompt = useCallback(
    (step, prefs) => {
      const { text, quickReplies } = getStepPrompt(step, prefs);
      pushMessage("agent", text);
      setState((prev) => ({ ...prev, step, quickReplies: quickReplies || [] }));
    },
    [pushMessage],
  );

  useEffect(() => {
    if (!hydrated || state.messages.length > 0) return;
    showAgentPrompt("welcome", state.preferences);
    const p = state.preferences;
    const known = [];
    if (p.areas?.length) known.push(p.areas.join(", "));
    if (p.bhk) known.push(p.bhk);
    if (p.budgetMax) known.push(`up to ₹${Number(p.budgetMax).toLocaleString("en-IN")}/mo`);
    if (known.length) {
      pushMessage("agent", `I've pulled in what you saved earlier — ${known.join(", ")}. Let's fill in the rest.`);
    }
  }, [hydrated, state.messages.length, showAgentPrompt, pushMessage, state.preferences]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages, recommendations, typing]);

  const handleUserInput = useCallback(
    async (rawText) => {
      const text = String(rawText || "").trim();
      if (!text) return;

      if (state.step === "results") {
        if (/start over|restart|reset/i.test(text)) {
          clearStoredChatState(storageKey);
          sessionIdRef.current = null;
          setState(createInitialAgentState());
          setInput("");
          return;
        }
        if (/map|browse|more|listing/i.test(text)) {
          navigate(buildRecommendationMapHref(state.preferences));
          return;
        }
      }

      pushMessage("user", text);
      setInput("");

      const parsed = parseStepInput(state.step, text);
      if (!parsed.ok) {
        setTyping(true);
        await new Promise((r) => setTimeout(r, 400));
        pushMessage("agent", parsed.error);
        setTyping(false);
        return;
      }

      const prefs = { ...state.preferences, ...parsed.patch };
      const upcoming = nextStep(state.step, prefs);

      setTyping(true);
      await new Promise((r) => setTimeout(r, 500));
      setTyping(false);

      if (upcoming === "results") {
        setState((prev) => ({
          ...prev,
          step: "results",
          preferences: prefs,
          quickReplies: [],
        }));
        const { text: resultText, quickReplies } = getStepPrompt("results", prefs);
        pushMessage("agent", resultText);
        setState((prev) => ({ ...prev, quickReplies: quickReplies || [] }));
        return;
      }

      setState((prev) => ({ ...prev, preferences: prefs }));
      showAgentPrompt(upcoming, prefs);
    },
    [navigate, pushMessage, showAgentPrompt, state.preferences, state.step, storageKey],
  );

  const handleReset = () => {
    clearStoredChatState(storageKey);
    sessionIdRef.current = null;
    setState(createInitialAgentState());
    setInput("");
    setSelectedListing(null);
    setRecommendations([]);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleUserInput(input);
  };

  const stepIndex = AGENT_STEPS.indexOf(state.step);
  const progress = state.step === "results" ? 100 : Math.round(((stepIndex + 1) / AGENT_STEPS.length) * 100);

  const shellHeight = embedded
    ? "h-full min-h-0 max-h-full"
    : compact
      ? "h-[520px]"
      : "h-[min(720px,calc(100dvh-12rem))]";

  const headerStatus = loadingListings
    ? "Loading listings…"
    : agentUnavailable
      ? "Agent temporarily unavailable"
      : `${catalogInfo.size} homes in catalogue`;

  return (
    <div
      className={`flex flex-col bg-slate-50 border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/60 ${shellHeight} ${className} ${
        embedded ? "rounded-none border-0 shadow-none bg-transparent" : "rounded-3xl"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
            <Bot className="text-rose-600" size={22} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">MovEazy Flat Agent</div>
            <div className="text-xs text-slate-500 truncate">{headerStatus}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="h-1 bg-slate-100">
        <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 bg-gradient-to-b from-slate-50 to-white">
        {!hydrated && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-400">
              Loading your conversation…
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {state.messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role}>
              {msg.text}
            </ChatBubble>
          ))}
        </AnimatePresence>

        {typing && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm text-slate-400">
              Typing…
            </div>
          </div>
        )}

        {state.step === "results" && !typing && (
          <div className="space-y-3 pt-1">
            {/* Requirement brief card */}
            <RequirementBriefCard
              prefs={state.preferences}
              matchCount={recommendations.length}
              loading={recoLoading}
            />

            {recoLoading ? null : agentUnavailable ? (
              <div style={{ background: "#FFFEFB", border: "1px dashed #D9D3C4", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#8B8578", marginBottom: 14 }}>
                  The flat agent is temporarily unavailable. Please try again shortly.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(buildRecommendationMapHref(state.preferences))}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1A2421", color: "#F7F4ED", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
                >
                  <MapPin size={14} />
                  Browse all listings
                </button>
              </div>
            ) : recommendations.length > 0 ? (
              <>
                {/* Match count header */}
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "#8B8578", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    {recommendations.length} matches found
                  </div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: "#1A2421", marginBottom: 12 }}>
                    Your shortlist, verified
                  </div>
                  <div style={{ fontSize: 12, color: "#8B8578", marginBottom: 14 }}>
                    Every listing below has a confirmed owner and at least one verified detail.
                  </div>
                </div>

                {recommendations.map((row) => (
                  <AgentListingCard
                    key={row.listing.id}
                    row={row}
                    onOpen={(listing) => {
                      setEnquireIntent(false);
                      setSelectedListing(listing);
                    }}
                    onEnquire={async (listing) => {
                      const opened = await openBrokerWhatsApp({ user, property: listing, source: "flat_agent_chat" });
                      if (!opened) {
                        // No WhatsApp number on this listing — fall back to the visit-request form.
                        setEnquireIntent(true);
                        setSelectedListing(listing);
                      }
                    }}
                  />
                ))}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate(buildRecommendationMapHref(state.preferences))}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1A2421", color: "#F7F4ED", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
                  >
                    <ExternalLink size={14} />
                    Browse all listings
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/contact")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: "#C8500F", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "1.5px solid #C8500F", cursor: "pointer" }}
                  >
                    Talk to a consultant
                  </button>
                </div>
              </>
            ) : (
              <div style={{ background: "#FFFEFB", border: "1px dashed #D9D3C4", borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#8B8578", marginBottom: 14 }}>
                  No strong matches yet. Try a flexible area or wider budget.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(buildRecommendationMapHref(state.preferences))}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1A2421", color: "#F7F4ED", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
                >
                  <MapPin size={14} />
                  Browse all listings
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {state.quickReplies?.length > 0 && (
        <div className="px-4 pt-1 pb-2 flex flex-wrap gap-2 shrink-0">
          {state.quickReplies.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => handleUserInput(label)}
              className={
                state.step === "results"
                  ? "text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "text-xs font-bold px-3 py-1.5 rounded-full border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 transition-colors"
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="px-4 py-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={state.step === "mustHaves" ? "Parking, gym, pet-friendly… or skip" : "Type your answer…"}
          className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center disabled:opacity-40 hover:bg-rose-700 transition-colors shrink-0"
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </form>

      {selectedListing && (
        <PropertyModal
          property={selectedListing}
          listings={recommendations.map((r) => r.listing)}
          onSelectListing={setSelectedListing}
          onClose={() => {
            setSelectedListing(null);
            setEnquireIntent(false);
          }}
          initialShowVisitForm={enquireIntent}
        />
      )}
    </div>
  );
}
