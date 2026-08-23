import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";

const PERKS = [
  { h: "Your own CRM", b: "Track hunters, leads and follow-ups in one dashboard built for how brokers actually work." },
  { h: "Matched leads", b: "We surface renters whose budget and locality already fit your listings — less cold outreach." },
  { h: "Verified badge", b: "Get a MovEazy-verified badge on your profile once your application is reviewed — more trust, more replies." },
];

export default function BrokerRegister() {
  const navigate = useNavigate();
  const { user, loading, becomeBroker } = useAuth();
  const { openLogin } = useLoginModal();

  const [form, setForm] = useState({ businessName: "", phone: "", gst: "", experienceYears: "", areas: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.businessName.trim() || !form.phone.trim()) {
      setError("Business/agency name and phone are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await becomeBroker(form);
    setSubmitting(false);
    if (res.success) setJustSubmitted(true);
    else setError(res.error || "Something went wrong — please try again.");
  };

  const status = user?.sellerBadgeStatus || "none";
  const isVerified = status === "verified";
  const isPending = justSubmitted || status === "pending";
  const isRejected = !justSubmitted && status === "rejected";

  return (
    <div className="br-root">
      <style>{`
        .br-root { min-height: 100dvh; background: #f4f1ea; color: #1c1a17; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .br-wrap { max-width: 880px; margin: 0 auto; padding: 48px 20px 70px; }
        .br-eyebrow { font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #b0392b; }
        .br-title { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(28px, 4vw, 40px); font-weight: 700; letter-spacing: -0.01em; margin-top: 8px; }
        .br-sub { font-size: 14.5px; color: #7a7267; margin-top: 10px; max-width: 560px; line-height: 1.6; }
        .br-perks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 34px; }
        .br-perk { background: #fff; border: 1px solid #ece6da; border-radius: 16px; padding: 18px; }
        .br-perk h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 15.5px; font-weight: 700; margin: 0 0 6px; }
        .br-perk p { font-size: 12.5px; color: #7a7267; line-height: 1.55; margin: 0; }
        .br-card { background: #fff; border: 1px solid #ece6da; border-radius: 20px; padding: 28px; margin-top: 34px; }
        .br-card-title { font-size: 15px; font-weight: 800; margin-bottom: 4px; }
        .br-card-sub { font-size: 13px; color: #7a7267; margin-bottom: 20px; }
        .br-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .br-field { display: flex; flex-direction: column; gap: 6px; }
        .br-field.full { grid-column: 1 / -1; }
        .br-label { font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #7a7267; }
        .br-input { min-height: 46px; padding: 0 14px; border-radius: 12px; border: 1px solid #e2dccf; background: #fff; font: 500 14px 'Plus Jakarta Sans', sans-serif; color: #2a2621; }
        .br-input:focus { outline: none; border-color: #ef5a45; }
        .br-error { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: #fdeceb; color: #b0392b; font-size: 13px; font-weight: 600; }
        .br-submit { margin-top: 22px; width: 100%; min-height: 52px; border: none; border-radius: 14px; background: #1c1a17; color: #fff; font: 800 14.5px 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
        .br-submit:disabled { opacity: .6; cursor: default; }
        .br-signin { margin-top: 26px; display: inline-flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 26px; border: none; border-radius: 14px; background: #ef5a45; color: #fff; font: 800 14.5px 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
        .br-status { text-align: center; padding: 46px 24px; }
        .br-status-icon { width: 60px; height: 60px; margin: 0 auto 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .br-status-h { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; }
        .br-status-p { font-size: 13.5px; color: #7a7267; margin-top: 8px; max-width: 420px; margin-left: auto; margin-right: auto; line-height: 1.6; }
        .br-status-cta { margin-top: 22px; display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 24px; border: none; border-radius: 12px; background: #1c1a17; color: #fff; font: 700 13.5px 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
        .br-note { margin-bottom: 20px; padding: 12px 14px; border-radius: 12px; background: #fef6e6; color: #92620f; font-size: 13px; font-weight: 600; }
        @media (max-width: 700px) {
          .br-perks { grid-template-columns: 1fr; }
          .br-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <MovEazyNav active="register-broker" />

      <div className="br-wrap">
        {loading ? null : isVerified ? (
          <div className="br-card br-status">
            <div className="br-status-icon" style={{ background: "#eaf6ee" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <div className="br-status-h">You're a verified broker</div>
            <p className="br-status-p">Your MovEazy Assured badge is live. Head to your dashboard to manage leads, listings and visits.</p>
            <button type="button" className="br-status-cta" onClick={() => navigate("/broker")}>Go to broker dashboard →</button>
          </div>
        ) : isPending ? (
          <div className="br-card br-status">
            <div className="br-status-icon" style={{ background: "#fef9c3" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a16207" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </div>
            <div className="br-status-h">Application under review</div>
            <p className="br-status-p">Thanks — your broker account is live and your verification badge application is with our team. Your CRM dashboard is ready now; we'll notify you once you're verified.</p>
            <button type="button" className="br-status-cta" onClick={() => navigate("/broker")}>Go to broker dashboard →</button>
          </div>
        ) : (
          <>
            <div className="br-eyebrow">For real-estate brokers</div>
            <h1 className="br-title">Register as a Broker</h1>
            <p className="br-sub">List, manage and grow your book of business on MovEazy — a dedicated CRM, matched leads, and a verified badge that gets you more replies.</p>

            <div className="br-perks">
              {PERKS.map((p) => (
                <div className="br-perk" key={p.h}><h3>{p.h}</h3><p>{p.b}</p></div>
              ))}
            </div>

            {!user ? (
              <div className="br-card" style={{ textAlign: "center" }}>
                <p className="br-card-title">Sign in to register</p>
                <p className="br-card-sub">Create a free account or sign in — takes a minute.</p>
                <button type="button" className="br-signin" onClick={() => openLogin()}>
                  Sign in to continue
                </button>
              </div>
            ) : (
              <form className="br-card" onSubmit={submit}>
                <p className="br-card-title">Tell us about your business</p>
                <p className="br-card-sub">This becomes your verification application — our team reviews it for the MovEazy Assured badge.</p>

                {isRejected && (
                  <div className="br-note">Your last application wasn't approved. You can update your details and reapply below.</div>
                )}

                <div className="br-grid">
                  <div className="br-field full">
                    <label className="br-label">Business / Agency Name *</label>
                    <input className="br-input" value={form.businessName} onChange={set("businessName")} placeholder="e.g. Skyline Realty" />
                  </div>
                  <div className="br-field">
                    <label className="br-label">Phone *</label>
                    <input className="br-input" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" />
                  </div>
                  <div className="br-field">
                    <label className="br-label">GST Number</label>
                    <input className="br-input" value={form.gst} onChange={set("gst")} placeholder="Optional" />
                  </div>
                  <div className="br-field">
                    <label className="br-label">Years of Experience</label>
                    <input className="br-input" value={form.experienceYears} onChange={set("experienceYears")} placeholder="Optional" />
                  </div>
                  <div className="br-field">
                    <label className="br-label">Areas You Cover</label>
                    <input className="br-input" value={form.areas} onChange={set("areas")} placeholder="e.g. HSR, Koramangala" />
                  </div>
                </div>

                {error && <div className="br-error">{error}</div>}

                <button type="submit" className="br-submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Register as Broker →"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
