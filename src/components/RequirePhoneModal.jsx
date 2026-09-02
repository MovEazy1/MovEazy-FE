/**
 * Mandatory mobile-number capture, shown after sign-in to any account whose
 * profile has no number saved.
 *
 * Signup collects a phone (see pages/SupabaseLogin.jsx), but two groups still
 * arrive without one: Google OAuth users, who never see that form, and every
 * account created before the field existed. This gate closes that hole without
 * touching the login flows themselves — it watches the signed-in user and only
 * appears when `phone` is genuinely empty, so anyone who already has one saved
 * never sees it.
 *
 * Deliberately not dismissible: no close button, no backdrop click, no Escape.
 * The number is what a ground agent calls to arrange visits, so an account
 * without one can't actually be served.
 *
 * Styled on the same light palette as the /auth page (SupabaseLogin.jsx) so the
 * two account screens read as one system rather than two products.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const INK     = "#1A2421";
const WHITE   = "#FFFEFB";
const LINE    = "#D9D3C4";
const MUTED   = "#8B8578";
const RUST    = "#C8500F";
const RUST_BG = "#FBEAE0";

/** Indian mobile: 10 digits starting 6-9, tolerating spaces and a +91 prefix. */
function normalizeIndianMobile(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : "";
}

/** "98765 43210" — the spacing Indian numbers are normally read in. */
function formatForDisplay(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

export default function RequirePhoneModal() {
  const { user, loading, updateUserProfile } = useAuth();
  const { pathname } = useLocation();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const needsPhone =
    !loading && !!user?.uid && !String(user.phone || "").trim() && !pathname.startsWith("/auth");

  // The modal owns the scroll lock while it's up, so the page behind can't be
  // scrolled past a gate the visitor can't dismiss.
  useEffect(() => {
    if (!needsPhone) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [needsPhone]);

  if (!needsPhone) return null;

  const ready = !!normalizeIndianMobile(value);

  const save = async () => {
    const mobile = normalizeIndianMobile(value);
    if (!mobile) { setErr("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    setErr("");
    // Pass the existing name through — updateUserProfile writes name and phone
    // together, so omitting it would blank the name out.
    const res = await updateUserProfile(user.name || "", mobile);
    if (res?.success) return; // user.phone updates, needsPhone flips false, gate unmounts
    setErr(res?.error || "Could not save your number. Please try again.");
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(26,36,33,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqphone-title"
    >
      <div
        className="w-full my-auto"
        style={{
          maxWidth: 400, background: WHITE, border: `1px solid ${LINE}`,
          borderRadius: 20, padding: "32px 28px",
          boxShadow: "0 20px 60px rgba(26,36,33,0.14)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 44, height: 44, borderRadius: 12,
            background: RUST_BG, marginBottom: 18,
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={RUST} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
          </svg>
        </span>

        <h2 id="reqphone-title" style={{ color: INK, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>
          Verify your Mobile No.
        </h2>

        <div style={{ marginTop: 22 }}>
          <label
            htmlFor="reqphone-input"
            style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED, marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}
          >
            Mobile Number<span style={{ color: RUST, marginLeft: 2 }}>*</span>
          </label>

          <div
            style={{
              display: "flex", alignItems: "center", height: 48,
              borderRadius: 10, background: WHITE, overflow: "hidden",
              border: `1px solid ${err ? "#C0392B" : focused ? RUST : LINE}`,
              boxShadow: focused && !err ? `0 0 0 3px ${RUST_BG}` : "none",
              transition: "border-color .15s, box-shadow .15s",
            }}
          >
            <span
              style={{
                display: "flex", alignItems: "center", gap: 6, flex: "none",
                padding: "0 12px 0 14px", height: "100%",
                color: INK, fontSize: 14.5, fontWeight: 600,
                borderRight: `1px solid ${LINE}`,
              }}
            >
              <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>🇮🇳</span>
              +91
            </span>
            <input
              id="reqphone-input"
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={value}
              onChange={(e) => { setValue(formatForDisplay(e.target.value)); if (err) setErr(""); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) save(); }}
              placeholder="98765 43210"
              style={{
                flex: 1, minWidth: 0, height: "100%", padding: "0 14px",
                border: "none", outline: "none", background: "transparent",
                fontSize: 15.5, letterSpacing: "0.02em", color: INK,
                fontFamily: "Inter, sans-serif",
              }}
            />
          </div>

          {err && <p style={{ color: "#C0392B", fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>{err}</p>}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={busy || !ready}
          style={{
            width: "100%", height: 46, marginTop: 20, borderRadius: 10,
            background: INK, color: WHITE, border: "none",
            fontSize: 14.5, fontWeight: 600, fontFamily: "Inter, sans-serif",
            cursor: busy ? "wait" : ready ? "pointer" : "not-allowed",
            opacity: busy || !ready ? 0.45 : 1,
            transition: "opacity .15s",
          }}
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
