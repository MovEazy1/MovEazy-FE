/**
 * The shortlist we picked for one person, as one screen.
 *
 * Two ways in, one experience:
 *   /curated/:token — the link sent over WhatsApp. Works signed out, which is
 *                     the normal case: nobody is logged in when they tap a link
 *                     in a chat.
 *   /curated        — the same set for a signed-in client coming back without
 *                     the link, resolved from their own account.
 *
 * Same swipe as the first five homes they saw, deliberately: right shortlists,
 * left skips, tapping opens the home. Every swipe goes back to the CRM through
 * the token, so "did not like" is something the agent can see rather than
 * something they have to ask about.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Sparkles } from "lucide-react";
import PropertyModal from "../components/PropertyModal";
import SwipeDeck from "../components/SwipeDeck";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import { fetchInventoryByIds, mapInventoryToListing } from "../lib/inventory";
import {
  fetchMyCuratedProperties, openCuratedShare, reactToCuratedProperty,
} from "../lib/curatedShares";
import { toggleSavedListing } from "../lib/userActivity";
import { logSavedListingChange } from "../lib/crmSync";
import { setReaction } from "../lib/visits";
import { persistRequestedMoreFlats } from "../lib/userRequirements";
import { DEFAULT_CONTACT_TEAM } from "../lib/sitePublicSettings";

const T = { ink: "#04211D", teal: "#0E7C68", gold: "#E8A33D", text: "#171412", textDim: "#5c554e", line: "#e9e3db" };

/** Statuses that mean this home has already been answered for. */
const ANSWERED = new Set(["liked", "disliked", "okay", "visit_scheduled", "visited", "rejected"]);

function Header({ title, subtitle, onBack, onShortlist }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 2px" }}>
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flexShrink: 0 }}
      >
        <ArrowLeft size={21} />
      </button>
      <div style={{ minWidth: 0, flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {subtitle ? <div style={{ fontSize: 11.5, color: "#948c83", marginTop: 1 }}>{subtitle}</div> : null}
      </div>
      <button
        type="button"
        aria-label="View shortlist"
        onClick={onShortlist}
        style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, flexShrink: 0 }}
      >
        <Heart size={20} />
      </button>
    </div>
  );
}

/** The counter, in the one place the requirement puts it: on top of the home. */
function CountBanner({ position, total }) {
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "9px 14px", background: "#E4F6F1", color: T.teal,
        fontSize: 13, fontWeight: 700, textAlign: "center", lineHeight: 1.35,
        borderBottom: "1px solid #CCE9E1",
      }}
    >
      <Sparkles size={15} strokeWidth={2.3} style={{ flexShrink: 0 }} />
      Viewing {position} out of {total} shortlisted {total === 1 ? "property" : "properties"}
    </div>
  );
}

export default function CuratedProperties() {
  const { token: routeToken } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();

  const [share, setShare] = useState(null);      // { ok, token, propertyIds, reactions, clientName }
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deckIndex, setDeckIndex] = useState(0);
  // What this person has said about each home: what the CRM already held when
  // the link opened, plus every swipe since. Kept here rather than read back
  // from the server, so the summary at the end reflects the session they just
  // had even if a write was slow or failed.
  const [reactions, setReactions] = useState({});
  // Bumped to deal the deck again; the listings themselves don't change, and
  // the deck restarts on a new identity.
  const [round, setRound] = useState(0);
  const [viewing, setViewing] = useState(null);  // { listing, openVisitForm }
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState("");
  const [advanceOn, setAdvanceOn] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const flash = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }, []);

  // A token in the URL wins; without one this is a signed-in client's own set,
  // so we wait for auth rather than deciding there is nothing to show.
  useEffect(() => {
    let alive = true;
    if (!routeToken && authLoading) return undefined;
    // No token and nobody signed in: there is no question to ask the server.
    if (!routeToken && !user?.uid) { setShare(null); setListings([]); setLoading(false); return undefined; }
    setLoading(true);
    const load = routeToken ? openCuratedShare(routeToken) : fetchMyCuratedProperties();
    load
      .then((res) => {
        if (!alive) return;
        setShare(res);
        setReactions(res?.reactions || {});
      })
      .catch(() => { if (alive) setShare(null); });
    return () => { alive = false; };
  }, [routeToken, authLoading, user?.uid]);

  // Hydrate the ids into real listings. Anything since taken down simply drops
  // out of the set — a shortlist should never open on a home that is gone.
  useEffect(() => {
    if (!share) return undefined;
    let alive = true;
    const ids = share.propertyIds || [];
    if (!ids.length) { setListings([]); setLoading(false); return undefined; }
    fetchInventoryByIds(ids)
      .then((rows) => {
        if (!alive) return;
        const byId = new Map((rows || []).map((r) => [String(r.property_id), r]));
        setListings(ids.map((id) => byId.get(String(id))).filter(Boolean).map(mapInventoryToListing).filter(Boolean));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [share]);

  const total = listings.length;
  /** Nothing to look up without either a link or an account. */
  const needsSignIn = !routeToken && !user?.uid;

  /**
   * Where to drop them in. Someone who swiped nine cards and closed the tab
   * should land on the tenth, not back at the first — the reactions we already
   * hold are what say which.
   */
  const startIndex = useMemo(() => {
    if (!listings.length) return 0;
    const firstOpen = listings.findIndex((l) => !ANSWERED.has(reactions[l.id]));
    return firstOpen < 0 ? 0 : firstOpen;
    // Only on a fresh set or a fresh round: recomputing this as they swipe would
    // move the deck out from under them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, round]);

  const record = useCallback(
    (listing, reaction) => {
      setReactions((r) => ({ ...r, [listing.id]: reaction === "like" ? "liked" : "disliked" }));
      if (share?.token) void reactToCuratedProperty(share.token, listing.id, reaction);
      // A signed-in client's own reaction row is what the app reads back; the
      // function above writes it too, but only when the CRM knows their account.
      if (user?.uid) void setReaction(user.uid, listing.id, reaction, null);
    },
    [share?.token, user?.uid],
  );

  const onVisitBooked = useCallback((message, listing) => {
    flash(message);
    setReactions((r) => ({ ...r, [listing.id]: "visit_scheduled" }));
    setAdvanceOn({ id: listing.id, ts: Date.now() });
  }, [flash]);

  const positionOf = (listing) => {
    const i = listings.findIndex((l) => l.id === listing?.id);
    return (i < 0 ? deckIndex : i) + 1;
  };

  const liked = useMemo(
    () => listings.filter((l) => ["liked", "visit_scheduled", "visited"].includes(reactions[l.id])),
    [listings, reactions],
  );
  // Whether a visit has actually been booked this session — the signal that
  // gates "Request more flats": asking for more only makes sense once
  // they've acted on the ones they already liked, not the moment they finish
  // swiping.
  const hasBookedVisit = useMemo(
    () => Object.values(reactions).includes("visit_scheduled"),
    [reactions],
  );

  const headerTitle = total
    ? `${total} ${total === 1 ? "home" : "homes"} shortlisted for you`
    : "Your shortlist";
  const firstName = String(share?.clientName || "").split(/\s+/)[0];

  const requestMoreUrl = useMemo(() => {
    const contact = DEFAULT_CONTACT_TEAM[0];
    const base = contact?.whatsappUrl || "https://wa.me/917055954373";
    const who = firstName ? ` for ${firstName}` : "";
    const text = liked.length
      ? `Hi MovEazy, please share some more flat options${who}.`
      : `Hi MovEazy, I don't like the options you've shared${who} — please share some more crazy options.`;
    return `${base}?text=${encodeURIComponent(text)}`;
  }, [liked.length, firstName]);

  const handleRequestMore = useCallback(() => {
    window.open(requestMoreUrl, "_blank", "noopener");
    if (user?.uid) void persistRequestedMoreFlats(user.uid);
  }, [requestMoreUrl, user?.uid]);

  return (
    <div style={{ minHeight: "100dvh", background: "#fff" }}>
      <Header
        title={headerTitle}
        subtitle={share?.agentName ? `Picked by ${share.agentName} · MovEazy` : "Picked by the MovEazy team"}
        onBack={() => navigate("/")}
        onShortlist={() => navigate("/shortlists")}
      />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 16px", color: T.textDim }}>Opening your shortlist…</div>
        ) : !total ? (
          <div style={{ textAlign: "center", padding: "72px 16px" }}>
            <h1 style={{ fontWeight: 800, fontSize: 23, margin: "0 0 10px", color: T.text }}>
              {needsSignIn ? "Sign in to see your shortlist" : "Nothing here yet"}
            </h1>
            <p style={{ color: T.textDim, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 22px" }}>
              {needsSignIn
                ? "The homes our team picked for you are tied to your MovEazy account. The link we sent on WhatsApp opens them without signing in."
                : routeToken
                  ? "This link has expired, or the homes on it are no longer available. Your MovEazy agent can send a fresh set."
                  : "We haven't sent you a shortlist yet. As soon as our team has homes that fit, they'll land here."}
            </p>
            <button
              type="button"
              onClick={() => (needsSignIn ? openLogin(() => navigate("/curated")) : navigate("/"))}
              style={{ padding: "13px 26px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              {needsSignIn ? "Sign in" : "Back to MovEazy"}
            </button>
          </div>
        ) : !done ? (
          <>
            <h1 style={{ fontWeight: 800, fontSize: 22, textAlign: "center", margin: "6px 0 4px", color: T.text }}>
              {firstName ? `${firstName}, we found these for you` : "Shortlisted for you"}
            </h1>
            <p style={{ textAlign: "center", color: T.textDim, fontSize: 13, margin: "0 0 14px" }}>
              Swipe right to shortlist, left to skip. Tap a home to see everything about it.
            </p>
            <SwipeDeck
              key={round}
              listings={listings}
              startIndex={startIndex}
              onIndexChange={setDeckIndex}
              counterLabel={(pos, n) => `Viewing ${pos} out of ${n} shortlisted ${n === 1 ? "property" : "properties"}`}
              onSwipeRight={(l) => {
                record(l, "like");
                if (user) {
                  const now = toggleSavedListing(user, l.id, l.title);
                  void logSavedListingChange(user, l.id, now, l.title);
                }
              }}
              onSwipeLeft={(l) => record(l, "dislike")}
              onOpenDetails={(l) => setViewing({ listing: l, openVisitForm: false })}
              onScheduleVisit={(l) => setViewing({ listing: l, openVisitForm: true })}
              onExhausted={() => setDone(true)}
              advanceOn={advanceOn}
            />
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "56px 12px 24px" }}>
            <h1 style={{ fontWeight: 800, fontSize: 27, lineHeight: 1.2, margin: "0 0 12px", color: T.text }}>
              {liked.length ? "That's the full set" : "Not feeling any of these?"}
            </h1>
            <p style={{ color: T.textDim, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 24px" }}>
              {liked.length
                ? `You shortlisted ${liked.length} of them. Schedule your visits whenever you're ready — we'll take it from here.`
                : "I don't like the options that you have shared, please share some more crazy options."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
              {liked.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/shortlists")}
                  style={{ padding: "14px 24px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
                >
                  Schedule visits for the {liked.length} you liked
                </button>
              )}
              {(liked.length === 0 || hasBookedVisit) && (
                <button
                  type="button"
                  onClick={handleRequestMore}
                  style={{ padding: "14px 24px", borderRadius: 999, border: `1px solid ${T.line}`, background: liked.length ? "#fff" : T.ink, color: liked.length ? T.text : "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
                >
                  Request more flats
                </button>
              )}
              <button
                type="button"
                onClick={() => { setReactions({}); setRound((n) => n + 1); setDone(false); }}
                style={{ padding: "13px 24px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                Go through them again
              </button>
            </div>
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
          banner={<CountBanner position={positionOf(viewing.listing)} total={total} />}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
