/**
 * The first thing we ask for, in place of the Google wall.
 *
 * The funnel used to open with an OAuth popup on the first meaningful click.
 * Everyone not ready to hand over an account left, and left nothing behind. A
 * mobile number is a far smaller thing to ask for, and it is the one field the
 * team actually needs: an agent calls it to arrange visits.
 *
 * So this is not RequirePhoneModal. That one runs after sign-in, against an
 * account, and writes to user_profiles. This runs before there is an account at
 * all, and writes to lead_intake keyed by the browser. The two share their
 * palette and their idea of a valid number (lib/mobile.js), nothing else.
 *
 * Dismissible, unlike its sibling. This gate stands between a visitor and the
 * thing they just clicked, on their first visit, before they owe us anything —
 * a modal with no way out at that moment is how you lose the visit as well as
 * the number.
 */
import { useEffect, useRef, useState } from "react";
import { hasLeadPhone, saveLead } from "../lib/leadIntake";
import { formatForDisplay, normalizeIndianMobile } from "../lib/mobile";

const INK     = "#1A2421";
const WHITE   = "#FFFEFB";
const LINE    = "#D9D3C4";
const RUST    = "#C8500F";
const RUST_BG = "#FBEAE0";

export default function RequirePhoneFirst({ open, onDone, onClose }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setValue("");
    setErr("");
    setBusy(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // A frame's delay, or the autofocus lands before the dialog is painted and
    // the mobile keyboard opens against a half-rendered sheet.
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const ready = Boolean(normalizeIndianMobile(value));

  const submit = async () => {
    const mobile = normalizeIndianMobile(value);
    if (!mobile) { setErr("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    setErr("");
    // Never block the journey on this write. The number is already in
    // localStorage by the time saveLead resolves, and the next questionnaire
    // step sends it again — a failed round trip must not strand somebody on a
    // spinner before they have seen a single flat.
    await saveLead({ phone: mobile });
    setBusy(false);
    onDone?.(mobile);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background: "rgba(26,36,33,0.45)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        zIndex: 999997,
      }}
      role="dialog"
      aria-modal="true"
      // No visible heading to point at, so the label lives here. A screen
      // reader still announces what this is; nothing is drawn for it.
      aria-label="Enter your mobile number"
      onClick={onClose}
    >
      <div
        className="w-full my-auto"
        style={{
          maxWidth: 340, background: WHITE, border: `1px solid ${LINE}`,
          borderRadius: 16, padding: "22px 20px",
          boxShadow: "0 16px 44px rgba(26,36,33,0.14)",
          fontFamily: "Inter, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* No heading and no explanatory copy: the field and its +91 prefix
            say what this wants. Same shell as RequirePhoneModal, which this
            now matches pixel for pixel apart from that modal's own title. */}
        <div>
          <div
            style={{
              display: "flex", alignItems: "center", height: 44,
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
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={value}
              onChange={(e) => { setValue(formatForDisplay(e.target.value)); if (err) setErr(""); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) submit(); }}
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
          onClick={submit}
          disabled={busy || !ready}
          style={{
            width: "100%", height: 44, marginTop: 14, borderRadius: 10,
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

/** Whether this browser still owes us a number. Re-exported so a caller can
 *  decide whether to open the gate without reaching into the lead store. */
export { hasLeadPhone };
