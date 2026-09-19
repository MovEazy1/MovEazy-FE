/**
 * Mandatory sign-in for a signed-out visitor whose very first pageview of
 * this session landed directly on a specific property — i.e. they arrived
 * via a shared /p/:id link (Facebook, WhatsApp, Reddit...), not by browsing
 * in from the homepage or the map.
 *
 * Google's OAuth redirect target is the current URL (AuthContext's
 * loginWithGoogle uses window.location.origin+pathname+search), and this
 * gate renders in place rather than navigating away, so the browser lands
 * back on this exact /map?listingId=... URL — UTM params and the CRM's
 * mz_s share token included — with nothing extra to wire up. Once signed
 * in, RequirePhoneModal takes over if the account still has no phone on
 * file; neither gate needs to know about the other.
 *
 * Deliberately not dismissible, same as RequirePhoneModal: no close, no
 * backdrop click, no Escape. A share-link visitor sees a locked property
 * until they sign in, not a peek that lets them wander off anonymously.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GoogleIcon } from "../context/LoginModalContext";

const INK = "#1A2421";
const WHITE = "#FFFEFB";
const LINE = "#D9D3C4";

export default function RequireSignInForListing() {
  const { user, loading, loginWithGoogle } = useAuth();
  const location = useLocation();

  // Captured once, from this component's very first render — a fresh page
  // load, not an in-app navigation. Browsing to a property from inside the
  // app (the swipe deck, a shared link already followed) doesn't remount
  // this component, so the gate never fires for that — only for someone
  // whose session opened right here.
  const [isDeepLinkEntry] = useState(
    () => location.pathname === "/map" && new URLSearchParams(location.search).has("listingId"),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const gate = isDeepLinkEntry && !loading && !user;

  useEffect(() => {
    if (!gate) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [gate]);

  if (!gate) return null;

  const onGoogle = async () => {
    setError("");
    setBusy(true);
    const r = await loginWithGoogle();
    // On success the browser redirects to Google; nothing else runs here.
    if (!r?.success) {
      setBusy(false);
      setError(r?.error || "Google sign-in is unavailable right now.");
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      // Above PropertyModal's own z-index (99999) — otherwise a property
      // opened straight from the URL renders on top of this gate instead
      // of being hidden behind it.
      style={{ background: INK, zIndex: 999999 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqsignin-title"
    >
      <div
        className="w-full my-auto"
        style={{
          maxWidth: 380, background: WHITE, border: `1px solid ${LINE}`,
          borderRadius: 18, padding: "32px 26px",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          fontFamily: "Inter, sans-serif", textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden>🔑</div>
        <h2 id="reqsignin-title" style={{ color: INK, fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>
          Sign in to view this home
        </h2>
        <p style={{ color: "#8B8578", fontSize: 13.5, margin: "8px 0 22px", lineHeight: 1.5 }}>
          Takes a few seconds with Google — you&apos;ll land right back on this listing.
        </p>

        {error && (
          <div style={{ marginBottom: 14, borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "#C0392B", background: "#FBEAE0", border: "1px solid #F3C6B0" }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          style={{
            width: "100%", height: 46, borderRadius: 10,
            border: `1px solid ${LINE}`, background: WHITE, color: INK,
            fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
          }}
        >
          <GoogleIcon /> {busy ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
