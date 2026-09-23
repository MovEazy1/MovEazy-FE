/**
 * Step 2 + 3 of the find-a-flat flow: right after the preference wizard
 * (AIBroker) or for a returning user with saved prefs, show the 5
 * best-matched homes as single swipeable cards, then "sit back and relax".
 *
 * That interstitial used to be a pause before handing off to the full map.
 * There is no map now, and that is the point: the five homes are what we have
 * on hand, and everything after them is our model searching every portal there
 * is and our team sending back a shortlist. So this screen ends the session
 * rather than opening a search box — unless a shortlist has already landed, in
 * which case it hands straight over to it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Heart } from "lucide-react";
import PropertyModal from "../components/PropertyModal";
import SwipeDeck from "../components/SwipeDeck";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { fetchAllListings } from "../lib/listingsFeed";
import { listingForScoring, normalizeRequirement, scoreMatch } from "../lib/inventoryMatch";
import { fetchUserRequirement, markMatchesSeen, rowToPrefs } from "../lib/userRequirements";
import { toggleSavedListing } from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { setReaction } from "../lib/visits";
import { fetchMyCuratedProperties } from "../lib/curatedShares";

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
  const [viewing, setViewing] = useState(null); // { listing, openVisitForm }
  const [visitToast, setVisitToast] = useState("");
  const [advanceOn, setAdvanceOn] = useState(null);
  // A shortlist the team has already sent. If one exists, the relax screen is a
  // handover rather than a dead end.
  const [curatedCount, setCuratedCount] = useState(0);
  const visitToastTimer = useRef(null);

  // Prefs handed over by the wizard win; otherwise load what's saved for this account.
  useEffect(() => {
    if (prefs || authLoading) return;
    if (!user?.uid) { setPrefsChecked(true); return; }
    let alive = true;
    fetchUserRequirement(user.uid)
      .then((row) => {
        if (!alive || !row) return;
        setPrefs(rowToPrefs(row));
        // They have swiped these five before. Showing them the same five again
        // is a worse answer than the true one: we are still looking, and the
        // shortlist lands when it lands.
        if (row.matches_seen) setPhase("relax");
      })
      .finally(() => { if (alive) setPrefsChecked(true); });
    return () => { alive = false; };
  }, [prefs, user?.uid, authLoading]);

  // This is the one-time screen — mark it seen as soon as it's actually
  // shown, so a returning visit (even one that never finishes swiping)
  // lands on the map next time instead of back here.
  useEffect(() => {
    if (!prefs || !user?.uid) return;
    void markMatchesSeen(user.uid);
  }, [prefs, user?.uid]);

  useEffect(() => {
    if (!user?.uid) { setCuratedCount(0); return undefined; }
    let alive = true;
    fetchMyCuratedProperties()
      .then((res) => { if (alive) setCuratedCount(res?.propertyIds?.length || 0); })
      .catch(() => { if (alive) setCuratedCount(0); });
    return () => { alive = false; };
  }, [user?.uid]);

  useEffect(() => {
    let alive = true;
    fetchAllListings({ limit: 500 })
      .then((rows) => { if (alive) setListings(rows); })
      .finally(() => { if (alive) setListingsLoading(false); });
    return () => { alive = false; };
  }, []);

  /**
   * The five, actually ranked.
   *
   * fetchAllListings returns the display shape — location, monthlyRent, bhk —
   * and scoreMatch reads the inventory column names — area, rent, flat_type.
   * Handing it the display shape scored every home 0 on every axis, so "your
   * top 5 matches" was really "five homes, in whatever order they came back",
   * and a deal-breaker never blocked anything. listingForScoring is the bridge
   * that exists for exactly this; the map has always used it.
   */
  const topMatches = useMemo(() => {
    if (!prefs || !listings.length) return [];
    const req = normalizeRequirement(prefs);
    return listings
      .map((listing) => ({ listing, ...scoreMatch(listingForScoring(listing), req) }))
      .filter((m) => m.blockers.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N)
      .map((r) => ({ ...r.listing, matchScore: r.score, matchReasons: r.reasons }));
  }, [prefs, listings]);



  const onVisitBooked = useCallback((message, listing) => {
    setVisitToast(message);
    setAdvanceOn({ id: listing.id, ts: Date.now() });
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
              office={prefs?.office}
              onSwipeRight={(l) => {
                const now = toggleSavedListing(user, l.id, l.title);
                void logSavedListingChange(user, l.id, now, l.title);
                void setReaction(user?.uid, l.id, "like", null);
              }}
              onSwipeLeft={(l) => {
                void setReaction(user?.uid, l.id, "dislike", null);
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
          <div style={{ textAlign: "center", padding: "48px 16px 24px" }}>
            <h1 style={{ fontWeight: 800, fontSize: 32, lineHeight: 1.15, margin: "0 0 14px", color: T.text }}>
              Sit back and relax
            </h1>
            <p style={{ color: T.textDim, fontSize: 15.5, lineHeight: 1.5, margin: "0 0 4px" }}>
              while our model figures out the best homes for you
            </p>
            <p style={{ color: T.teal, fontWeight: 800, fontSize: 17, margin: "0 0 28px" }}>
              across every listing site there is.
            </p>
            <div style={{ display: "flex", justifyContent: "center", margin: "0 0 30px" }}>
              <RelaxCup />
            </div>

            {curatedCount > 0 ? (
              <>
                <p style={{ color: T.textDim, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 16px" }}>
                  Your shortlist is ready — {curatedCount} {curatedCount === 1 ? "home" : "homes"} we
                  picked for you.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/curated")}
                  style={{ padding: "14px 28px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
                >
                  See the {curatedCount} we shortlisted
                </button>
              </>
            ) : (
              <>
                <p style={{ color: T.textDim, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 18px", maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
                  We&apos;ll WhatsApp you a shortlist as soon as it&apos;s ready — usually within a day.
                  Anything you liked is saved.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/shortlists")}
                  style={{ padding: "14px 28px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
                >
                  See what I liked
                </button>
              </>
            )}
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
