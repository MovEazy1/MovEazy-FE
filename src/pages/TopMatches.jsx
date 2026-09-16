/**
 * Step 2 + 3 of the find-a-flat flow: right after the preference wizard
 * (AIBroker) or for a returning user with saved prefs, show the 5
 * best-matched homes as single swipeable cards, then a "sit back and relax"
 * interstitial before handing off to the full map. A focused, full-screen
 * session rather than the usual site chrome — closer to the reference flow
 * than a marketing page with a nav bar bolted on top.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Heart } from "lucide-react";
import PropertyModal from "../components/PropertyModal";
import SwipeDeck from "../components/SwipeDeck";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { fetchAllListings } from "../lib/listingsFeed";
import { matchRequirementToListings, normalizeRequirement } from "../lib/inventoryMatch";
import { fetchUserRequirement, rowToPrefs } from "../lib/userRequirements";
import { toggleSavedListing } from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { setReaction } from "../lib/visits";

const TOP_N = 5;
const T = { ink: "#04211D", teal: "#0E7C68", gold: "#E8A33D", text: "#171412", textDim: "#5c554e" };

function TopBar({ center }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 4px" }}>
      <button
        type="button"
        aria-label="Close"
        onClick={() => navigate("/")}
        style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text }}
      >
        <X size={22} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#948c83" }}>{center}</span>
      <button
        type="button"
        aria-label="View shortlist"
        onClick={() => navigate("/shortlists")}
        style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text }}
      >
        <Heart size={21} />
      </button>
    </div>
  );
}

/** A cute, brand-toned stand-in for the "sit back and relax" illustration. */
function RelaxCup() {
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" fill="none" aria-hidden>
      <path d="M75 20 Q70 34 78 44 Q84 34 78 22" stroke={`${T.gold}99`} strokeWidth="3" strokeLinecap="round" />
      <path d="M56 26 Q51 38 58 48" stroke={`${T.gold}99`} strokeWidth="3" strokeLinecap="round" />
      <path d="M96 26 Q101 38 94 48" stroke={`${T.gold}99`} strokeWidth="3" strokeLinecap="round" />
      <g stroke={T.gold} strokeWidth="2.4" strokeLinecap="round">
        <path d="M28 44 L24 38 M28 44 L34 42 M28 44 L26 50" />
        <path d="M124 50 L128 44 M124 50 L118 48 M124 50 L126 56" />
      </g>
      <ellipse cx="75" cy="126" rx="46" ry="9" fill="#EDF3F1" />
      <path d="M42 68 H108 L101 112 Q100 120 92 120 H58 Q50 120 49 112 Z" fill="#F7FAF8" stroke={T.ink} strokeWidth="2.5" />
      <path d="M107 78 Q124 78 124 92 Q124 105 108 104" stroke={T.ink} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="62" cy="94" r="4" fill="none" />
      <path d="M60 92 Q62 96 64 92" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M84 92 Q86 96 88 92" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M67 100 Q75 106 83 100" stroke={T.ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <circle cx="57" cy="98" r="4" fill={`${T.gold}55`} />
      <circle cx="93" cy="98" r="4" fill={`${T.gold}55`} />
    </svg>
  );
}

export default function TopMatches() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const [prefs, setPrefs] = useState(location.state?.prefs || null);
  const [prefsChecked, setPrefsChecked] = useState(!!location.state?.prefs);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [phase, setPhase] = useState("swiping"); // swiping | relax
  const [seenIds, setSeenIds] = useState([]);
  const [viewing, setViewing] = useState(null); // { listing, openVisitForm }
  const [visitToast, setVisitToast] = useState("");
  const [advanceOn, setAdvanceOn] = useState(null);
  const visitToastTimer = useRef(null);

  // Prefs handed over by the wizard win; otherwise load what's saved for this account.
  useEffect(() => {
    if (prefs || authLoading) return;
    if (!user?.uid) { setPrefsChecked(true); return; }
    let alive = true;
    fetchUserRequirement(user.uid)
      .then((row) => { if (alive && row) setPrefs(rowToPrefs(row)); })
      .finally(() => { if (alive) setPrefsChecked(true); });
    return () => { alive = false; };
  }, [prefs, user?.uid, authLoading]);

  useEffect(() => {
    let alive = true;
    fetchAllListings({ limit: 500 })
      .then((rows) => { if (alive) setListings(rows); })
      .finally(() => { if (alive) setListingsLoading(false); });
    return () => { alive = false; };
  }, []);

  const topMatches = useMemo(() => {
    if (!prefs || !listings.length) return [];
    const ranked = matchRequirementToListings(normalizeRequirement(prefs), listings, { min: 0 });
    return ranked.slice(0, TOP_N).map((r) => ({ ...r.listing, matchScore: r.score, matchReasons: r.reasons }));
  }, [prefs, listings]);

  const goToMap = () => navigate("/map", { state: { prefs, seenListingIds: seenIds } });

  const recordSeen = (listing) => setSeenIds((ids) => (ids.includes(listing.id) ? ids : [...ids, listing.id]));

  const onVisitBooked = useCallback((message, listing) => {
    setVisitToast(message);
    setAdvanceOn({ id: listing.id, ts: Date.now() });
    recordSeen(listing);
    clearTimeout(visitToastTimer.current);
    visitToastTimer.current = setTimeout(() => setVisitToast(""), 2800);
  }, []);
  useEffect(() => () => clearTimeout(visitToastTimer.current), []);

  const loading = authLoading || listingsLoading || !prefsChecked;
  const total = topMatches.length;

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {!loading && prefs && <TopBar center={phase === "relax" ? `${total} of ${total || TOP_N}` : ""} />}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 16px", color: T.textDim }}>Finding your best matches…</div>
        ) : !prefs ? (
          <div style={{ textAlign: "center", padding: "80px 16px" }}>
            <p style={{ color: T.textDim, marginBottom: 16 }}>We don't have your preferences yet.</p>
            <button
              type="button"
              onClick={() => navigate("/?search=1")}
              style={{ padding: "12px 24px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Tell us what you're looking for
            </button>
          </div>
        ) : phase === "swiping" && total > 0 ? (
          <>
            <h1 style={{ fontWeight: 800, fontSize: 24, textAlign: "center", margin: "8px 0 4px", color: T.text }}>
              Your top {total} matches
            </h1>
            <p style={{ textAlign: "center", color: T.textDim, fontSize: 13.5, margin: "0 0 16px" }}>
              Swipe right to shortlist, left to skip.
            </p>
            <SwipeDeck
              listings={topMatches}
              onSwipeRight={(l) => {
                const now = toggleSavedListing(user, l.id, l.title);
                void logSavedListingChange(user, l.id, now, l.title);
                void setReaction(user?.uid, l.id, "like", null);
                recordSeen(l);
              }}
              onSwipeLeft={(l) => {
                void setReaction(user?.uid, l.id, "dislike", null);
                recordSeen(l);
              }}
              onOpenDetails={(l) => setViewing({ listing: l, openVisitForm: false })}
              onScheduleVisit={(l) => setViewing({ listing: l, openVisitForm: true })}
              onExhausted={() => setPhase("relax")}
              advanceOn={advanceOn}
            />
          </>
        ) : (
          // "Sit back and relax" — also the landing spot when no listing
          // cleared the match bar at all, so the flow never dead-ends.
          <div style={{ textAlign: "center", padding: "56px 16px 24px" }}>
            <h1 style={{ fontWeight: 800, fontSize: 32, lineHeight: 1.15, margin: "0 0 14px", color: T.text }}>
              Sit back and relax
            </h1>
            <p style={{ color: T.textDim, fontSize: 15.5, lineHeight: 1.5, margin: "0 0 2px" }}>
              while our team is figuring out the
            </p>
            <p style={{ color: T.teal, fontWeight: 800, fontSize: 17, margin: "0 0 32px" }}>
              Best flat for you.
            </p>
            <div style={{ display: "flex", justifyContent: "center", margin: "0 0 36px" }}>
              <RelaxCup />
            </div>
            <button
              type="button"
              onClick={goToMap}
              style={{ padding: "14px 28px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
            >
              Explore more homes
            </button>
          </div>
        )}
      </div>

      {viewing && (
        <PropertyModal
          property={viewing.listing}
          listings={listings}
          onSelectListing={(l) => setViewing({ listing: l, openVisitForm: false })}
          onClose={() => setViewing(null)}
          initialShowVisitForm={viewing.openVisitForm}
          onVisitBooked={onVisitBooked}
        />
      )}

      <Toast message={visitToast} />
    </div>
  );
}
