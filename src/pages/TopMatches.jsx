/**
 * Step 2 + 3 of the find-a-flat flow: right after the preference wizard
 * (AIBroker) or for a returning user with saved prefs, show the 5
 * best-matched homes as single swipeable cards, then a "sit back and relax"
 * interstitial before handing off to the full map. Placeholder visuals for
 * both — the design for this page is coming separately.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import PropertyModal from "../components/PropertyModal";
import SwipeDeck from "../components/SwipeDeck";
import { useAuth } from "../context/AuthContext";
import { fetchAllListings } from "../lib/listingsFeed";
import { matchRequirementToListings, normalizeRequirement } from "../lib/inventoryMatch";
import { fetchUserRequirement, rowToPrefs } from "../lib/userRequirements";
import { toggleSavedListing } from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { setReaction } from "../lib/visits";

const TOP_N = 5;

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

  const loading = authLoading || listingsLoading || !prefsChecked;

  return (
    <div style={{ minHeight: "100vh", background: "#F7FAF8" }}>
      <MovEazyNav />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 16px", color: "#5c554e" }}>Finding your best matches…</div>
        ) : !prefs ? (
          <div style={{ textAlign: "center", padding: "80px 16px" }}>
            <p style={{ color: "#5c554e", marginBottom: 16 }}>We don't have your preferences yet.</p>
            <button
              type="button"
              onClick={() => navigate("/?search=1")}
              style={{ padding: "12px 24px", borderRadius: 999, border: "none", background: "#04211D", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Tell us what you're looking for
            </button>
          </div>
        ) : phase === "swiping" && topMatches.length > 0 ? (
          <>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 28, textAlign: "center", margin: "0 0 6px", color: "#171412" }}>
              Your top {topMatches.length} matches
            </h1>
            <p style={{ textAlign: "center", color: "#5c554e", fontSize: 13.5, margin: "0 0 20px" }}>
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
            />
          </>
        ) : (
          // "Sit back and relax" — placeholder. Also the landing spot when no
          // listing cleared the match bar at all, so the flow never dead-ends.
          <div style={{ textAlign: "center", padding: "72px 16px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛋️</div>
            <h1 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: 26, margin: "0 0 10px", color: "#171412" }}>
              Sit back and relax.
            </h1>
            <p style={{ color: "#5c554e", fontSize: 14, lineHeight: 1.6, maxWidth: 340, margin: "0 auto 28px" }}>
              We've noted what you liked. Explore the rest of what's available on the map whenever you're ready.
            </p>
            <button
              type="button"
              onClick={goToMap}
              style={{ padding: "14px 28px", borderRadius: 999, border: "none", background: "#04211D", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
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
        />
      )}
    </div>
  );
}
