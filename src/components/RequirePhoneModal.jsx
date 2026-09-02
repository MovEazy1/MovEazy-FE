/**
 * Mandatory phone capture, shown once after sign-in to anyone whose profile
 * has no mobile number saved.
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
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const CORAL = "#f0554a";

/** Indian mobile: 10 digits starting 6-9, tolerating spaces and a +91 prefix. */
function normalizeIndianMobile(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const local = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : "";
}

export default function RequirePhoneModal() {
  const { user, loading, updateUserProfile } = useAuth();
  const { pathname } = useLocation();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const needsPhone =
    !loading && !!user?.uid && !String(user.phone || "").trim() && !pathname.startsWith("/auth");

  // The modal owns the scroll lock while it's up, so the page behind can't be
  // scrolled past a gate the visitor can't dismiss.
  useEffect(() => {
    if (!needsPhone) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [needsPhone]);

  if (!needsPhone) return null;

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
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reqphone-title"
    >
      <div
        className="relative w-full max-w-[420px] my-auto rounded-[26px] overflow-hidden border border-white/[0.12]"
        style={{
          background:
            "radial-gradient(120% 80% at 18% 6%, rgba(232,74,64,0.22), transparent 42%)," +
            "radial-gradient(90% 70% at 90% 40%, rgba(255,86,64,0.30), transparent 46%)," +
            "radial-gradient(130% 90% at 50% 120%, rgba(255,64,52,0.42), transparent 55%)," +
            "#0b0708",
          boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
        }}
      >
        <div className="p-7 sm:p-8">
          <span
            aria-hidden
            className="flex items-center justify-center w-12 h-12 rounded-full mb-5"
            style={{ background: "rgba(240,85,74,0.16)", border: "1px solid rgba(240,85,74,0.4)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
              <path d="M10.5 18.5h3" />
            </svg>
          </span>

          <h2 id="reqphone-title" className="text-white text-[20px] font-extrabold leading-snug">
            Add your mobile number
          </h2>
          <p className="text-white/60 text-[13.5px] leading-relaxed mt-2">
            We need a number to reach you about visits and enquiries. It&apos;s never shown publicly on your listings.
          </p>

          <div
            className="flex items-center gap-3 mt-6 rounded-2xl px-4"
            style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)" }}
          >
            <span className="text-white/55 text-[15px] font-bold pr-3 shrink-0" style={{ borderRight: "1px solid rgba(255,255,255,0.14)" }}>
              +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              value={value}
              onChange={(e) => { setValue(e.target.value); if (err) setErr(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) save(); }}
              placeholder="98765 43210"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-white text-[15px] py-4 placeholder:text-white/35"
            />
          </div>

          {err && <p className="text-[12.5px] font-semibold mt-2.5" style={{ color: "#ffa39b" }}>{err}</p>}

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="w-full h-[52px] mt-5 rounded-full text-[15px] font-extrabold text-white transition disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${CORAL}, #ff6a52)` }}
          >
            {busy ? "Saving…" : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
