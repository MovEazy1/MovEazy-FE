import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/layout/Navbar";
import PlanPageSiteFooter from "../components/layout/PlanPageSiteFooter";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import { useAuth } from "../context/AuthContext";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { updateUserProfileData } from "../lib/firestoreStore";

const NAV_OFFSET_PX = 48;
const MIN_IFRAME_PX = 480;

function planHtmlUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  const v = import.meta.env.VITE_PLAN_PAGE_ASSET_VERSION ?? "20260520b";
  return `${normalized}moveazy-plan-page.html?embed=1&v=${encodeURIComponent(v)}`;
}

function measureIframeDocument(iframe) {
  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return null;
    const height = Math.max(
      doc.documentElement?.scrollHeight ?? 0,
      doc.body?.scrollHeight ?? 0,
      doc.documentElement?.offsetHeight ?? 0
    );
    return height > 400 ? height : null;
  } catch {
    return null;
  }
}

function InterestModal({ onClose, user }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    area: "",
  });
  const [status, setStatus] = useState("idle"); // idle | saving | done | error
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setErr("Name and phone are required."); return; }
    setErr(""); setStatus("saving");
    try {
      if (isFirebaseConfigured) {
        await addDoc(collection(db, "planSubInterest"), {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          area: form.area.trim(),
          source: "plan-page",
          status: "pending",
          createdAt: serverTimestamp(),
        });
        if (user?.email && !user?.phone && form.phone.trim()) {
          await updateUserProfileData(user.email, { phone: form.phone.trim() }).catch(() => {});
        }
      }
      setStatus("done");
    } catch {
      setErr("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const inp = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid #e5e7eb", fontSize: 14, fontWeight: 500,
    color: "#111827", outline: "none", fontFamily: "inherit",
    transition: "border-color 0.15s",
  };
  const lbl = {
    display: "block", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: "#6b7280", marginBottom: 6,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 24, padding: "44px 40px",
          maxWidth: 560, width: "100%", position: "relative",
          boxShadow: "0 32px 100px rgba(0,0,0,0.35)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 18, right: 20,
            background: "#f3f4f6", border: "none", cursor: "pointer",
            width: 32, height: 32, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {status === "done" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 64, height: 64, background: "#f0fdf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 10 }}>We've got your details!</h3>
            <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
              Our team will contact you shortly to help you find your perfect flat in Bengaluru.
            </p>
            <button
              onClick={onClose}
              style={{ marginTop: 24, padding: "12px 32px", borderRadius: 12, background: "#111827", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ff3131", marginBottom: 8 }}>Get Started</p>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: "#111827", marginBottom: 6, lineHeight: 1.2 }}>Find your flat in Bengaluru</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
              Share your details and our team will reach out within a few hours.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={lbl}>Full Name *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" required style={inp}
                    onFocus={e => e.target.style.borderColor = "#ff3131"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
                </div>
                <div>
                  <label style={lbl}>Phone Number *</label>
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" required style={inp}
                    onFocus={e => e.target.style.borderColor = "#ff3131"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
                </div>
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" style={inp}
                  onFocus={e => e.target.style.borderColor = "#ff3131"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
              </div>
              <div>
                <label style={lbl}>Preferred Area in Bengaluru</label>
                <input value={form.area} onChange={e => set("area", e.target.value)} placeholder="e.g. Koramangala, HSR Layout, Whitefield" style={inp}
                  onFocus={e => e.target.style.borderColor = "#ff3131"} onBlur={e => e.target.style.borderColor = "#e5e7eb"} />
              </div>
              {err && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", padding: "10px 14px", background: "#fef2f2", borderRadius: 8 }}>{err}</div>
              )}
              <button
                type="submit"
                disabled={status === "saving"}
                style={{ width: "100%", padding: 15, borderRadius: 14, background: "linear-gradient(135deg,#ff3131,#ef4444)", color: "#fff", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", opacity: status === "saving" ? 0.6 : 1, marginTop: 4, fontFamily: "inherit" }}
              >
                {status === "saving" ? "Saving…" : "Submit — Our team will contact you shortly"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function MoveazyPlanPage() {
  const { user } = useAuth();
  const src = useMemo(() => planHtmlUrl(), []);
  const iframeRef = useRef(null);
  const [iframeHeight, setIframeHeight] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const syncIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const measured = measureIframeDocument(iframe);
    if (!measured) return;
    setIframeHeight(Math.ceil(measured + 8));
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "MovEazy — Your Flat-Finding Plan";
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    const onMessage = async (event) => {
      if (event.data?.type === "moveazy-plan-iframe-height") {
        const height = Number(event.data.height);
        if (Number.isFinite(height) && height >= 400) setIframeHeight(Math.ceil(height + 8));
      } else if (event.data?.type === "moveazy-modal-open") {
        setShowModal(true);
        // track click event
        try {
          if (isFirebaseConfigured) {
            await addDoc(collection(db, "planPageEvents"), {
              type: "cta_click",
              createdAt: serverTimestamp(),
            });
          }
        } catch { /* silent */ }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showModal]);

  useEffect(() => {
    const delays = [0, 120, 400, 1000, 2500];
    const timers = delays.map((ms) => window.setTimeout(syncIframeHeight, ms));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [syncIframeHeight, src]);

  const fallbackHeight =
    typeof window !== "undefined"
      ? `max(${MIN_IFRAME_PX}px, calc(100dvh - ${NAV_OFFSET_PX}px))`
      : `${MIN_IFRAME_PX}px`;

  const iframeStyle = {
    width: "100%",
    minHeight: fallbackHeight,
    height: iframeHeight ? `${iframeHeight}px` : fallbackHeight,
    display: "block",
    border: "none",
  };

  const handleIframeLoad = () => {
    syncIframeHeight();
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: "moveazy-plan-request-height" }, "*");
    } catch { /* ignore */ }
  };

  return (
    <div className="relative min-h-0 bg-gradient-to-b from-[#fff5f2] via-white to-[#fff7f5] antialiased">
      <PremiumPageBackdrop variant="marketing" overlayOnly />
      <div className="relative z-30">
        <Navbar variant="marketing" />
      </div>
      <main className="relative z-10 w-full">
        <iframe
          ref={iframeRef}
          title="MovEazy flat-finding plan"
          src={src}
          style={iframeStyle}
          className="w-full bg-transparent"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={handleIframeLoad}
        />
      </main>
      <PlanPageSiteFooter />
      {showModal && <InterestModal onClose={() => setShowModal(false)} user={user} />}
    </div>
  );
}
