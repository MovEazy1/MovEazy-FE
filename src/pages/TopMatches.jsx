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
import { motion, useReducedMotion } from "framer-motion";
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
import { fetchBookings, fetchReactions, setReaction } from "../lib/visits";
import { MOVEAZY_TEAM_WHATSAPP } from "../config/contactChannels";
import { fetchMyCuratedProperties } from "../lib/curatedShares";

const TOP_N = 5;
const T = { ink: "#04211D", teal: "#0E7C68", gold: "#E8A33D", text: "#171412", textDim: "#5c554e" };
/** The app's standard ease, matching the swipe deck and the questionnaire. */
const EASE = [0.22, 1, 0.36, 1];

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

/**
 * Your shortlist is ready.
 *
 * The one screen in this flow that is an arrival rather than a wait, so it is
 * the one that gets to be loud. Everything else here is pale and patient; this
 * is ink, and the only dark screen in the journey — which is what makes it
 * read as an event rather than another step.
 *
 * The three tilted cards are not photographs of their homes. Loading three
 * covers to decorate a screen whose entire job is to be tapped through would
 * trade the moment for a spinner, and the shortlist itself is one tap away.
 */
function CuratedReady({ count, onOpen }) {
  const reduce = useReducedMotion();
  const rise = (delay) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: EASE, delay },
        };

  return (
    <div
      style={{
        position: "relative", overflow: "hidden",
        // Cancels the page wrapper's own padding on all four sides. It was
        // only cancelled horizontally, so the panel asked for most of the
        // viewport and then had 12px and 60px added back around it — enough to
        // overflow and leave a pale strip under the dark screen.
        margin: "-12px -16px -60px", padding: "56px 24px 48px",
        background: T.ink, color: "#fff", textAlign: "center",
        minHeight: "100dvh", boxSizing: "border-box",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}
    >
      {/* A single soft light behind the cards. One source, off-centre — the
          cheapest way to make a flat colour look lit rather than filled. */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: "12%", left: "50%", width: 520, height: 520,
          transform: "translateX(-50%)", pointerEvents: "none",
          background: `radial-gradient(circle, ${T.teal}55 0%, transparent 62%)`,
          filter: "blur(18px)",
        }}
      />

      <motion.div style={{ position: "relative" }} {...rise(0)}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 14px", borderRadius: 999, marginBottom: 26,
            background: "rgba(94,234,212,0.12)", border: "1px solid rgba(94,234,212,0.32)",
            color: "#5EEAD4", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden
            style={{ width: 6, height: 6, borderRadius: "50%", background: "#5EEAD4" }}
          />
          Hand-picked for you
        </span>
      </motion.div>

      {/* Three cards fanned out: the shortlist as an object, before it is a
          list. Tilts are fixed, not random — a layout that reshuffles itself
          on every render reads as a glitch. */}
      <motion.div
        aria-hidden
        style={{ position: "relative", width: 230, height: 138, marginBottom: 34 }}
        {...rise(0.08)}
      >
        {[
          // Far enough apart to read as three cards. At a tighter spread the
          // outer two vanish behind the middle one and the fan looks like a
          // smudge rather than a stack.
          { x: -62, rot: -14, o: 0.4, z: 1 },
          { x: 62, rot: 14, o: 0.4, z: 1 },
          { x: 0, rot: 0, o: 1, z: 2 },
        ].map((c) => (
          <span
            key={`${c.x}-${c.rot}`}
            style={{
              position: "absolute", inset: 0, margin: "auto",
              width: 116, height: 132, borderRadius: 16, zIndex: c.z,
              transform: `translateX(${c.x}px) rotate(${c.rot}deg)`,
              background: c.o === 1
                ? "linear-gradient(160deg, #10473C 0%, #071F1A 100%)"
                : "rgba(255,255,255,0.07)",
              border: `1px solid rgba(94,234,212,${c.o === 1 ? 0.38 : 0.22})`,
              boxShadow: c.o === 1 ? "0 18px 40px rgba(0,0,0,0.45)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {c.o === 1 && (
              <span style={{ fontSize: 34, fontWeight: 800, color: "#5EEAD4", letterSpacing: "-0.03em" }}>
                {count}
              </span>
            )}
          </span>
        ))}
      </motion.div>

      <motion.h1
        style={{
          position: "relative", fontWeight: 800, fontSize: 34, lineHeight: 1.1,
          letterSpacing: "-0.03em", margin: "0 0 14px", maxWidth: 340,
        }}
        {...rise(0.16)}
      >
        Your curated list
        <br />
        <span style={{ color: "#5EEAD4" }}>is ready</span>
      </motion.h1>

      <motion.p
        style={{
          position: "relative", color: "rgba(255,255,255,0.72)", fontSize: 15.5,
          lineHeight: 1.55, margin: "0 0 32px", maxWidth: 320,
        }}
        {...rise(0.22)}
      >
        {count} {count === 1 ? "home" : "homes"}, picked by our team from everything we could
        find. Your perfect home is a few taps away.
      </motion.p>

      <motion.button
        type="button"
        onClick={onOpen}
        style={{
          position: "relative", width: "100%", maxWidth: 340,
          padding: "16px 24px", borderRadius: 22, border: "none", cursor: "pointer",
          background: "#5EEAD4", color: T.ink, fontFamily: "inherit",
          // Wraps to two lines on a phone, so it is a rounded rectangle rather
          // than a pill: a two-line pill reads as a mistake.
          fontWeight: 800, fontSize: 15, lineHeight: 1.35, letterSpacing: "-0.01em",
          boxShadow: "0 14px 34px rgba(94,234,212,0.28)",
        }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        {...rise(0.28)}
      >
        Show me what Shit have you guys pulled out in 6 Hours
      </motion.button>
    </div>
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

  /**
   * Homes this person has already answered for.
   *
   * A like, a skip or a booked visit is an answer, and re-dealing the same
   * card asks the question again — which is what the deck has been doing on
   * every visit. Each of those answers lives somewhere they can go back to:
   * likes on /shortlists, visits on /visits, skips deliberately nowhere.
   *
   * Loaded once per account rather than watched: the deck removes a card as it
   * is swiped, so this only has to cover coming *back*.
   */
  const [decided, setDecided] = useState(null);
  useEffect(() => {
    if (!user?.uid) { setDecided(new Set()); return undefined; }
    let alive = true;
    Promise.all([fetchReactions(user.uid), fetchBookings(user.uid)])
      .then(([reactions, bookings]) => {
        if (!alive) return;
        setDecided(new Set([
          ...Object.keys(reactions || {}),
          ...(bookings || []).map((b) => b.property_id),
        ]));
      })
      .catch(() => { if (alive) setDecided(new Set()); });
    return () => { alive = false; };
  }, [user?.uid]);

  /**
   * What this account already told us, and whether it has already finished.
   *
   * Runs whether or not the wizard handed prefs over, which is the bug it
   * replaces: the old version returned early when prefs were already set, so
   * anybody arriving straight from the questionnaire never had matches_seen
   * read at all and was dealt the same five again, however many times they had
   * answered them.
   *
   * Wizard prefs still win — they are what the person just typed — but the
   * row is read either way for the one flag that decides which screen this is.
   */
  useEffect(() => {
    if (authLoading) return undefined;
    if (!user?.uid) { setPrefsChecked(true); return undefined; }
    let alive = true;
    fetchUserRequirement(user.uid)
      .then((row) => {
        if (!alive || !row) return;
        if (!prefs) setPrefs(rowToPrefs(row));
        // They have been through the five already. Dealing them again is a
        // worse answer than the true one: we are still looking, and the
        // shortlist lands when it lands.
        if (row.matches_seen) setPhase("relax");
      })
      .finally(() => { if (alive) setPrefsChecked(true); });
    return () => { alive = false; };
    // prefs deliberately absent: this reads the row once per account, and
    // depending on it would re-run the moment it sets prefs itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  /**
   * Mark it finished when they actually reach the end, not when they arrive.
   *
   * It used to fire as soon as prefs existed — so opening the deck and
   * swiping one card of five counted as having seen all five, and the next
   * visit skipped the other four. Landing on this screen is the thing that
   * means finished, so that is what records it.
   */
  useEffect(() => {
    if (phase !== "relax" || !user?.uid) return;
    void markMatchesSeen(user.uid);
  }, [phase, user?.uid]);

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
    // Wait for the answered set before dealing anything: showing five cards and
    // then pulling three of them out as it arrives is worse than a beat of
    // loading.
    if (!prefs || !listings.length || decided === null) return [];
    const req = normalizeRequirement(prefs);
    return listings
      .filter((l) => !decided.has(l.id))
      .map((listing) => ({ listing, ...scoreMatch(listingForScoring(listing), req) }))
      .filter((m) => m.blockers.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N)
      .map((r) => ({ ...r.listing, matchScore: r.score, matchReasons: r.reasons }));
  }, [prefs, listings, decided]);

  /**
   * What the nudge says. Carries their own answers, so the team opens a
   * message that already knows what they are looking for.
   */
  const nudgeHref = useMemo(() => {
    const where = (prefs?.localities ?? []).slice(0, 3).join(", ");
    const text = [
      "Hi MovEazy — I'm looking for a flat and I'd rather not wait.",
      where ? `Areas: ${where}` : "",
      prefs?.budgetMax ? `Budget: up to ₹${Number(prefs.budgetMax).toLocaleString("en-IN")}/mo` : "",
      prefs?.flatTypes?.length ? `Type: ${prefs.flatTypes.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    return `${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`;
  }, [prefs]);



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
        ) : curatedCount > 0 ? (
          // The team has picked. That is the answer to "find my flat" now,
          // whether or not the five were ever swiped through.
          <CuratedReady count={curatedCount} onOpen={() => navigate("/curated")} />
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

            {/* Waiting is the honest answer, but it should not be the only
                thing on offer. The number is the team's own, from
                contactChannels — never one inferred from elsewhere. */}
            <p style={{ color: T.textDim, fontSize: 13, margin: "22px 0 10px" }}>
              In a hurry?
            </p>
            <a
              href={nudgeHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "13px 26px", borderRadius: 999, textDecoration: "none",
                border: `1.5px solid ${T.teal}`, color: T.teal,
                fontWeight: 700, fontSize: 14.5,
              }}
            >
              Nudge us on WhatsApp
            </a>
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
