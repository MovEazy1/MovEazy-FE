/**
 * Step 2 + 3 of the find-a-flat flow: right after the preference wizard
 * (AIBroker) or for a returning user with saved prefs, show the 5
 * best-matched homes as single swipeable cards, then "sit back and relax"
 * with a live countdown to when the team's curated shortlist lands.
 *
 * That interstitial used to be a pause before handing off to the full map.
 * There is no map now, and that is the point: the five homes are what we have
 * on hand, and everything after them is our model searching every portal there
 * is and our team sending back a shortlist. The countdown is the promise we
 * made them made visible — and the moment a shortlist actually exists, this
 * screen hands straight over to it rather than making them notice and tap
 * through on their own.
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
import { fetchUserRequirement, markMatchesSeen, persistShortlistDeadline, rowToPrefs } from "../lib/userRequirements";
import { toggleSavedListing } from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { setReaction } from "../lib/visits";
import { fetchMyCuratedProperties } from "../lib/curatedShares";
import { MOVEAZY_TEAM_WHATSAPP } from "../config/contactChannels";

const TOP_N = 5;
const T = { ink: "#04211D", teal: "#0E7C68", gold: "#E8A33D", text: "#171412", textDim: "#5c554e" };
const SHORTLIST_WINDOW_MS = 6 * 60 * 60 * 1000;
// While waiting with nothing sent yet, check back for a curated list without
// asking someone to reload — infrequent enough that a whole afternoon left on
// this tab costs a handful of reads, not a background job.
const CURATED_POLL_MS = 45 * 1000;

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Counts down to a fixed deadline (an account-level timestamp, not a
 * per-browser one) — returns null until the deadline is known, so callers
 * can tell "still figuring out the deadline" apart from "the deadline is
 * now/past". */
function useCountdownTo(deadline) {
  const [remaining, setRemaining] = useState(() => (deadline ? Math.max(0, deadline - Date.now()) : null));
  useEffect(() => {
    if (!deadline) { setRemaining(null); return undefined; }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return remaining;
}

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
  const [likedListings, setLikedListings] = useState([]);
  // A shortlist the team has already sent. The moment this is > 0 we hand
  // straight over to /curated — the count itself is never shown, it only
  // ever gates the redirect.
  const [curatedCount, setCuratedCount] = useState(0);
  const visitToastTimer = useRef(null);
  // The deadline the countdown counts down to. Deliberately NOT derived from
  // `prefs` — prefs can arrive as a snapshot handed over in router state
  // (ForkHome passes the row it already had in hand), and that snapshot goes
  // stale the moment a deadline gets written after it was captured. A plain
  // reload then reuses that same stale snapshot (browsers keep history.state
  // across a reload of the same entry) forever, so `prefs.notes` never picks
  // up the real value and a fresh deadline gets minted on every visit. This
  // fetches straight from the account on every "relax" render instead, which
  // is the actual fix, not just a different cache to go stale.
  const [shortlistDeadline, setShortlistDeadline] = useState(null);
  const countdownMs = useCountdownTo(shortlistDeadline);

  useEffect(() => {
    if (phase !== "relax" || !user?.uid) return;
    let alive = true;
    (async () => {
      const row = await fetchUserRequirement(user.uid);
      if (!alive) return;
      const existing = row?.notes?.shortlistDeadline;
      if (existing) {
        setShortlistDeadline(new Date(existing).getTime());
      } else {
        const deadline = Date.now() + SHORTLIST_WINDOW_MS;
        setShortlistDeadline(deadline);
        void persistShortlistDeadline(user.uid, row?.notes, new Date(deadline).toISOString());
      }
    })();
    return () => { alive = false; };
  }, [phase, user?.uid]);

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
  // lands on the relax screen next time instead of back here.
  useEffect(() => {
    if (!prefs || !user?.uid) return;
    void markMatchesSeen(user.uid);
  }, [prefs, user?.uid]);

  // Check for a curated shortlist once on mount, then keep checking on a slow
  // poll for as long as we're sitting on the relax screen with nothing sent
  // yet — an agent can send one at any moment while this tab is still open.
  // The instant one shows up, hand over to it; nothing here ever renders the
  // count itself.
  useEffect(() => {
    if (!user?.uid) { setCuratedCount(0); return undefined; }
    let alive = true;
    const check = () =>
      fetchMyCuratedProperties()
        .then((res) => { if (alive) setCuratedCount(res?.propertyIds?.length || 0); })
        .catch(() => {});
    check();
    if (phase !== "relax") return () => { alive = false; };
    const id = setInterval(check, CURATED_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [user?.uid, phase]);

  useEffect(() => {
    if (curatedCount > 0) navigate("/curated", { replace: true });
  }, [curatedCount, navigate]);

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

  // `prefs` is either AIBroker's camelCase shape or a raw user_requirements
  // row (a returning visitor's saved answers) — read both so a WhatsApp
  // message doesn't come out blank depending on entry point.
  const describePrefs = () => {
    const rupee = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
    const flatTypes = prefs?.flatTypes?.length ? prefs.flatTypes : prefs?.flat_types;
    const flatType = flatTypes?.length ? flatTypes.join("/") : "flat";
    const budgetMin = prefs?.budgetMin ?? prefs?.budget_min;
    const budgetMax = prefs?.budgetMax ?? prefs?.budget_max;
    const budget = prefs ? `${rupee(budgetMin)} - ${rupee(budgetMax)}` : "";
    return { flatType, budget };
  };

  const openWhatsapp = (message) => {
    window.open(`${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const goToPriorityWhatsapp = () => {
    const { flatType, budget } = describePrefs();
    openWhatsapp(
      "Priority Move In\n" +
      `Hey Team, I'm looking to move-in ASAP in a ${flatType}. My budget is ${budget}.`
    );
  };

  const goToNudgeWhatsapp = () => {
    const { flatType, budget } = describePrefs();
    openWhatsapp(
      "Shortlist Nudge\n" +
      `Hey Team, it's been over 6 hours and I haven't received my curated shortlist yet. Could you please prioritize my ${flatType} search (budget ${budget})?`
    );
  };

  const onVisitBooked = useCallback((message, listing) => {
    setVisitToast(message);
    setAdvanceOn({ id: listing.id, ts: Date.now() });
    setLikedListings((ls) => (ls.some((x) => x.id === listing.id) ? ls : [...ls, listing]));
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
                setLikedListings((ls) => (ls.some((x) => x.id === l.id) ? ls : [...ls, l]));
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
          // cleared the match bar at all, so the flow never dead-ends. If a
          // curated shortlist already exists this is only ever on screen for
          // the instant before the redirect effect above fires.
          <div style={{ textAlign: "center", padding: "48px 16px 24px" }}>
            <h1 style={{ fontWeight: 800, fontSize: 32, lineHeight: 1.15, margin: "0 0 14px", color: T.text }}>
              Sit back and relax
            </h1>
            <p style={{ color: T.textDim, fontSize: 15.5, lineHeight: 1.5, margin: "0 0 2px" }}>
              while our team is figuring out the
            </p>
            <p style={{ color: T.teal, fontWeight: 800, fontSize: 17, margin: "0 0 20px" }}>
              best flat for you.
            </p>
            {countdownMs !== null && countdownMs <= 0 ? (
              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10, background: "#FCF3E8", border: "1px solid #E8A33D55", borderRadius: 16, padding: "16px 22px", margin: "0 0 32px", maxWidth: 340 }}>
                <p style={{ color: T.text, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  Due to high demand our team is a little behind right now.
                </p>
                <button
                  type="button"
                  onClick={goToNudgeWhatsapp}
                  style={{ padding: "10px 20px", borderRadius: 999, border: "none", background: T.gold, color: T.ink, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
                >
                  Nudge us on WhatsApp to take this up on priority
                </button>
              </div>
            ) : (
              <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6, background: "#EAF6F2", border: `1px solid ${T.teal}33`, borderRadius: 16, padding: "14px 22px", margin: "0 0 32px" }}>
                <p style={{ color: T.text, fontSize: 14, lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
                  Our team will be sharing your curated shortlist in
                </p>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 24, letterSpacing: "0.02em", color: T.teal }}>
                  {countdownMs === null ? "--:--:--" : formatCountdown(countdownMs)}
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", margin: "0 0 30px" }}>
              <RelaxCup />
            </div>
            {likedListings.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/shortlists")}
                style={{ display: "block", width: "100%", maxWidth: 320, margin: "0 auto 12px", padding: "14px 28px", borderRadius: 999, border: "none", background: T.teal, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
              >
                Finalize your visits ({likedListings.length} shortlisted)
              </button>
            )}
            <button
              type="button"
              onClick={goToPriorityWhatsapp}
              style={{ padding: "14px 28px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
            >
              No, I&apos;m in a hurry &amp; I can&apos;t relax
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
