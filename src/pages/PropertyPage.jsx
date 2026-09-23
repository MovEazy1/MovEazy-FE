/**
 * One home, at its own address.
 *
 * Every link we share — WhatsApp, Facebook, a curated shortlist, the share
 * sheet on the listing itself — lands here. It used to land on the map with
 * ?listingId=…, which meant a shared flat arrived wrapped in a browsing surface
 * we are no longer running. This is the same property view, on a route of its
 * own, so a share is a page rather than a mode of something bigger.
 *
 * `?visit=1` opens straight on the booking panel — that is what "Schedule a
 * visit" sends when it has to leave the page it was on.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PropertyModal from "../components/PropertyModal";
import AIBroker from "../components/AIBroker";
import Toast from "../components/Toast";
import { useLoginModal } from "../context/LoginModalContext";
import { fetchInventoryByIds, mapInventoryToListing } from "../lib/inventory";

const T = { ink: "#04211D", text: "#171412", textDim: "#5c554e" };

export default function PropertyPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // "Get personalised flats" opens the questionnaire over this page rather
  // than navigating away, so the flat they were sent stays underneath it.
  // useBackClose makes that a real history entry, so back closes the wizard
  // and returns here instead of leaving the site the link came from.
  const [showBroker, setShowBroker] = useState(false);
  const { closeLogin } = useLoginModal();

  /**
   * Back, on a flat somebody was sent, goes nowhere useful.
   *
   * They arrived on this page — it is the first entry in the tab — so back is
   * the app they came from: WhatsApp, a feed, a subreddit. One press and the
   * visit is over, whatever they were in the middle of.
   *
   * So the first couple of presses open the questionnaire instead. It is the
   * one thing on the site that is worth more to them than the flat they were
   * sent, and it is where a lead actually starts. After that the intercepting
   * stops and back means the homepage, because a page that will not let go is
   * worse than the drop-off it is trying to prevent.
   *
   * Only for a deep-link entry: location.key is "default" only for the entry a
   * tab opened on, so browsing in from the map or the deck keeps a normal back.
   */
  const [deepLinkEntry] = useState(() => !location.key || location.key === "default");
  const backsLeft = useRef(2);

  useEffect(() => {
    if (!deepLinkEntry) return undefined;

    let armed = true;
    // Same URL, one extra entry: back now has somewhere to land that is not
    // the app they came from.
    const arm = () =>
      window.history.pushState({ ...window.history.state, mzExitGuard: true }, "", window.location.href);

    arm();

    const onPop = () => {
      if (!armed) return;
      if (backsLeft.current > 0) {
        backsLeft.current -= 1;
        // A sign-in sheet would otherwise sit on top of the questionnaire we
        // are about to show, and it is above it in the stacking order.
        closeLogin();
        setShowBroker(true);
        arm();
        return;
      }
      // Out of chances. The homepage, not the site they came from.
      armed = false;
      navigate("/", { replace: true });
    };

    window.addEventListener("popstate", onPop);
    return () => {
      armed = false;
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkEntry]);

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const openVisitForm = useMemo(
    () => new URLSearchParams(location.search).get("visit") === "1",
    [location.search],
  );

  useEffect(() => {
    const id = String(propertyId || "").trim();
    if (!id) { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    fetchInventoryByIds([id])
      .then((rows) => {
        if (!alive) return;
        setListing(mapInventoryToListing((rows || [])[0]) || null);
      })
      .catch(() => { if (alive) setListing(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [propertyId]);

  /**
   * Closing goes back where they came from, and home only when there is no
   * "back" — someone who opened this from a WhatsApp link has no history in
   * our app to return to, and sending them to a blank tab is worse than
   * sending them to the front page.
   */
  const close = () => {
    // location.key is "default" only for the entry a tab opened on, which is
    // exactly the WhatsApp case: there is nothing of ours behind this page.
    if (location.key && location.key !== "default") navigate(-1);
    else navigate("/");
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#fff", color: T.textDim }}>
        Loading this home…
      </div>
    );
  }

  if (!listing) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#fff", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, margin: "0 0 10px", color: T.text }}>
            This home isn&apos;t available
          </h1>
          <p style={{ color: T.textDim, fontSize: 14.5, lineHeight: 1.55, margin: "0 0 22px" }}>
            It may have been taken off the market since the link was sent. Our team can find you
            something similar.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{ padding: "13px 26px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Back to MovEazy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#04211D" }}>
      <PropertyModal
        property={listing}
        onClose={close}
        initialShowVisitForm={openVisitForm}
        manageHistory={false}
        onVisitBooked={(message) => setToast(message)}
        banner={
          /* Above the photos: this flat is one of many, and somebody who was
             sent a link has no other way into the rest. The visit CTA sits at
             the bottom of the modal, so the two never compete for the thumb. */
          <button
            type="button"
            onClick={() => setShowBroker(true)}
            style={{
              display: "flex", width: "100%", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "13px 18px", border: "none", cursor: "pointer",
              background: "#0E7C68", color: "#fff", fontSize: 14.5, fontWeight: 700,
              fontFamily: "inherit", letterSpacing: "-0.005em",
            }}
          >
            Get personalised flats
            <span aria-hidden="true">→</span>
          </button>
        }
      />
      {/* startFresh: an invitation to start, not a half-finished form to
          resume — they came here for a flat, not to pick a questionnaire up. */}
      <AIBroker open={showBroker} onClose={() => setShowBroker(false)} startFresh />
      <Toast message={toast} />
    </div>
  );
}
