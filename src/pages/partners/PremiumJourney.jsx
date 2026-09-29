/**
 * After the plan: the payment return, the congratulations one-pager (ROI +
 * Refer & Earn), the referrals page, and the home cards — Complete profile,
 * then the golden Premium card (with the logo turned gold).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, Copy, Crown, Gift, IndianRupee, MapPin, PartyPopper, Search, ShieldCheck, TrendingUp, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Loading, Sheet, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { useLocalities } from "./useLocalities";
import { useLandingSettings } from "../../lib/landingSettings";
import { friendlyError, inr, pp } from "../../lib/partners";
import {
  REFERRAL_REWARD, completePartnerProfile, fetchMyReferrals, fetchPartnerStatus, fetchPlans, markCongratsSeen, planRoi,
  referralLink, referralMessage,
} from "../../lib/partnerPlans";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/* ── /premium/return ─────────────────────────────────────────────────────── */

/** Back from Razorpay: wait for the webhook to activate the plan, then celebrate. */
export function PaymentReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reloadMe, reloadStatus, reloadInventory } = usePartner();
  const failed = /failed|cancel/i.test(params.get("razorpay_payment_link_status") || "");
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    if (failed) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const st = await fetchPartnerStatus();
        if (!alive) return;
        if (st?.plan?.active) {
          await Promise.all([reloadMe(), reloadStatus(), reloadInventory()]);
          navigate(pp("/welcome"), { replace: true });
          return;
        }
      } catch { /* keep waiting */ }
      if (alive) setWaited((w) => w + 1);
    };
    tick();
    const id = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(id); };
  }, [failed, navigate, reloadMe, reloadStatus, reloadInventory]);

  return (
    <>
      <TopBar title="Payment" />
      <div className="pz-pad" style={{ textAlign: "center", paddingTop: 48 }}>
        {failed ? (
          <>
            <h2 style={{ margin: "0 0 8px" }}>The payment didn’t go through</h2>
            <p className="pz-meta">No money was taken for this attempt. You can try again.</p>
            <Link className="pz-btn pz-btn--primary pz-btn--block" style={{ marginTop: 18 }} to={pp("/premium")} replace>Try again</Link>
          </>
        ) : (
          <>
            <div className="pj-spin" aria-hidden />
            <style>{`.pj-spin { width: 46px; height: 46px; margin: 0 auto 18px; border-radius: 99px; border: 4px solid var(--gl2); border-top-color: var(--g); animation: pjs .8s linear infinite; } @keyframes pjs { to { transform: rotate(360deg); } }`}</style>
            <h2 style={{ margin: "0 0 8px" }}>Confirming your payment…</h2>
            <p className="pz-meta">{waited > 20 ? "Razorpay is taking a moment. If you were charged, your plan starts as soon as it confirms — you can keep using the app." : "This takes a few seconds."}</p>
            {waited > 20 && <Link className="pz-btn" style={{ marginTop: 16 }} to={pp("/")} replace>Go to the app</Link>}
          </>
        )}
      </div>
    </>
  );
}

/* ── /welcome — the congratulations one-pager ────────────────────────────── */

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 29) % 100, delay: (i % 12) * 0.12, dur: 2.4 + (i % 5) * 0.35, hue: ["#E4B659", "#F7E9C6", "#5EEAD4", "#fff", "#15803D"][i % 5], rot: (i * 47) % 360,
}));

export function WelcomePremium() {
  const navigate = useNavigate();
  const { me, status } = usePartner();
  const s = useLandingSettings();
  const [plans, setPlans] = useState([]);
  const [ref, setRef] = useState(null);
  useEffect(() => { markCongratsSeen(); }, []);
  useEffect(() => { fetchPlans().then(setPlans, () => {}); fetchMyReferrals().then(setRef, () => {}); }, []);

  const plan = plans.find((p) => p.id === status?.plan?.plan_id) || { price: 4999, months: 5, label: "Premium" };
  const roi = planRoi(plan, { avgBrokerage: s.avgBrokerage, propertyShare: me?.property_share ?? s.propertyShare });
  const first = (me?.partner?.name || "Partner").split(" ")[0];

  return (
    <div className="wp">
      <style>{WP_CSS}</style>
      <div className="wp-confetti" aria-hidden>
        {CONFETTI.map((c, i) => <i key={i} style={{ left: `${c.left}%`, background: c.hue, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, transform: `rotate(${c.rot}deg)` }} />)}
      </div>
      <div className="wp-in">
        <span className="wp-badge"><PartyPopper size={30} /></span>
        <p className="wp-kicker">Welcome to Premium</p>
        <h1>Congratulations, {first}!<br /><span>You’re a MovEazy Partner.</span></h1>
        <p className="wp-sub">{status?.plan?.label || plan.label} · active until {fmtDate(status?.plan?.until)}</p>

        <div className="wp-roi">
          <div><IndianRupee size={18} /><b>{inr(roi.perDeal)}</b><span>you keep on one MovEazy deal</span></div>
          <div><TrendingUp size={18} /><b>{roi.dealsToBreakEven} deal{roi.dealsToBreakEven === 1 ? "" : "s"}</b><span>pays for your whole plan</span></div>
          <div><Crown size={18} /><b>{roi.multiple ? `${roi.multiple}×` : "—"}</b><span>return at 2 deals a month</span></div>
        </div>
        <p className="wp-small">At 2 MovEazy deals a month that’s {inr(roi.twoDealsMonthly)} a month, against {inr(roi.perMonthCost)} a month for your plan.</p>

        <div className="wp-refer">
          <Gift size={22} />
          <div>
            <b>Refer & Earn {inr(REFERRAL_REWARD)}</b>
            <span>For every broker who joins with your link and keeps their plan for a month.</span>
          </div>
        </div>
        <ReferButtons code={ref?.code} name={me?.partner?.name} big />
        <button type="button" className="wp-skip" onClick={() => navigate(pp("/"), { replace: true })}>Start using MovEazy Partners →</button>
      </div>
    </div>
  );
}

/** Copy the link, then WhatsApp it to as many brokers as they like. */
export function ReferButtons({ code, name, big = false }) {
  if (!code) return <Loading label="Making your referral link…" />;
  const link = referralLink(code);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast("Referral link copied"); } catch { toast(link); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(link); } catch { /* the message carries it anyway */ }
    window.open(`https://wa.me/?text=${encodeURIComponent(referralMessage(code, name))}`, "_blank", "noopener");
  };
  return (
    <div className={`rf-btns${big ? " big" : ""}`}>
      <button type="button" className="rf-wa" onClick={share}><WhatsAppIcon size={19} /> Refer & Earn on WhatsApp</button>
      <button type="button" className="rf-copy" onClick={copy}><Copy size={16} /> {link.replace(/^https:\/\//, "")}</button>
    </div>
  );
}

/* ── /referrals ──────────────────────────────────────────────────────────── */

const REF_STATUS = {
  signed_up: ["Signed up", "#6B7280"], pending: ["Plan taken · earning in a month", "#B45309"],
  earned: ["Earned", "#15803D"], paid: ["Paid to you", "#166534"], void: ["Cancelled", "#B91C1C"],
};

export function ReferralsPage() {
  const { me } = usePartner();
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetchMyReferrals().then(setR, (e) => setErr(friendlyError(e))); }, []);
  return (
    <>
      <TopBar title="Refer & Earn" back />
      <style>{WP_CSS}</style>
      <div className="pz-pad">
        <div className="rf-hero">
          <Gift size={28} />
          <h2>Earn {inr(REFERRAL_REWARD)} per broker</h2>
          <p>Share your link. When a broker joins with it and keeps their plan for a month, {inr(REFERRAL_REWARD)} is yours.</p>
          <ReferButtons code={r?.code} name={me?.partner?.name} />
        </div>
        {err && <div className="pz-err">{err}</div>}
        {r && (
          <>
            <div className="pz-section" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", textAlign: "center", padding: 10, marginTop: 12 }}>
              {[["On the way", r.pending], ["Earned", r.earned], ["Paid", r.paid]].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: 19, fontWeight: 800 }}>{inr(v)}</div><div className="pz-meta">{k}</div></div>
              ))}
            </div>
            <div className="pz-section" style={{ padding: 0 }}>
              <h2 style={{ padding: "14px 14px 0" }}>Brokers you referred</h2>
              {r.joined.length === 0 ? <p className="pz-meta" style={{ padding: "0 14px 14px", margin: 0 }}>Nobody yet — share your link on your broker WhatsApp groups.</p> : r.joined.map((j, i) => {
                const [label, color] = REF_STATUS[j.status] || REF_STATUS.signed_up;
                return (
                  <div key={i} className="pz-row" style={{ padding: "12px 14px", borderTop: "1px solid var(--line)" }}>
                    <span style={{ flex: 1 }}><strong style={{ display: "block" }}>{j.name}</strong><span className="pz-meta">Joined {fmtDate(j.joined_at)}</span></span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color, textAlign: "right" }}>{label}{j.amount ? <><br />{inr(j.amount)}</> : null}</span>
                  </div>
                );
              })}
            </div>
            <p className="pz-hint" style={{ textAlign: "center" }}>Earnings are paid out by the MovEazy team after the month is up.</p>
          </>
        )}
      </div>
    </>
  );
}

/* ── Home cards ──────────────────────────────────────────────────────────── */

/** The logo, redrawn in gold — for partners who've completed their profile. */
export function useGoldLogo(src) {
  const [gold, setGold] = useState("");
  useEffect(() => {
    if (!src) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const x = c.getContext("2d");
        const g = x.createLinearGradient(0, 0, c.width, c.height);
        g.addColorStop(0, "#8A6419");
        g.addColorStop(0.45, "#C9A04A");
        g.addColorStop(0.7, "#E4B659");
        g.addColorStop(1, "#A27A28");
        x.fillStyle = g;
        x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = "destination-in";
        x.drawImage(img, 0, 0);
        if (alive) setGold(c.toDataURL("image/png"));
      } catch { /* keep the regular logo */ }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return gold;
}

export function CompleteProfileCard({ onDone }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <style>{WP_CSS}</style>
      <button type="button" className="cp-card" onClick={() => setOpen(true)}>
        <span className="cp-ring" aria-hidden><BadgeCheck size={22} /></span>
        <span style={{ flex: 1, textAlign: "left" }}>
          <b>Complete your profile</b>
          <span>Add the areas you work in and your RERA ID to get your gold Premium badge.</span>
        </span>
        <span className="cp-go">Start</span>
      </button>
      {open && <CompleteProfileSheet onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  );
}

function CompleteProfileSheet({ onClose, onDone }) {
  const localities = useLocalities();
  const [areas, setAreas] = useState([]);
  const [q, setQ] = useState("");
  const [rera, setRera] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (n.length < 2 ? localities.slice(0, 0) : localities.filter((a) => a.toLowerCase().includes(n))).filter((a) => !areas.includes(a)).slice(0, 10);
  }, [q, localities, areas]);
  const popular = ["HSR Layout", "Koramangala", "Bellandur", "BTM Layout", "Sarjapur Road", "Indiranagar", "Whitefield", "Marathahalli", "Electronic City", "JP Nagar"];
  const toggle = (a) => setAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await completePartnerProfile(areas, rera);
      toast("Profile complete — you're a Gold Partner");
      await onDone?.();
      onClose();
    } catch (ex) {
      setErr(friendlyError(ex, "Could not save your profile."));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Complete your profile" onClose={onClose}>
      <form className="pz-pad" onSubmit={save}>
        <span className="pz-label"><MapPin size={14} style={{ verticalAlign: -2 }} /> Operational areas</span>
        <div className="pz-chips">
          {[...new Set([...areas, ...popular])].map((a) => (
            <Chip key={a} on={areas.includes(a)} onClick={() => toggle(a)}>{a}{areas.includes(a) && <X size={13} />}</Chip>
          ))}
        </div>
        <div className="pz-search" style={{ marginTop: 10 }}>
          <Search size={17} />
          <input className="pz-input" placeholder="Search all areas" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search areas" />
        </div>
        {matches.length > 0 && <div className="pz-chips" style={{ marginTop: 8 }}>{matches.map((a) => <Chip key={a} onClick={() => { toggle(a); setQ(""); }}>+ {a}</Chip>)}</div>}
        <div className="pz-field" style={{ marginTop: 16 }}>
          <label className="pz-label" htmlFor="cp-rera"><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> RERA ID</label>
          <input id="cp-rera" className="pz-input" value={rera} onChange={(e) => setRera(e.target.value.toUpperCase())} placeholder="PRM/KA/RERA/1251/309/AG/…" autoCapitalize="characters" />
          <span className="pz-hint">Your Karnataka RERA agent registration number.</span>
        </div>
        {err && <div className="pz-err" role="alert">{err}</div>}
        <button type="submit" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy || !areas.length || rera.trim().length < 5}>
          {busy ? "Saving…" : `Save${areas.length ? ` · ${areas.length} area${areas.length === 1 ? "" : "s"}` : ""}`}
        </button>
      </form>
    </Sheet>
  );
}

/** The gold card: shown once the profile is complete. */
export function PremiumCard({ me, status }) {
  const p = me?.partner || {};
  const areas = status?.profile?.areas || [];
  const shine = useRef(null);
  return (
    <div className="gc" ref={shine}>
      <style>{WP_CSS}</style>
      <div className="gc-top">
        <span className="gc-tag"><Crown size={13} /> Gold Partner</span>
        <span className="gc-until">Premium · till {fmtDate(status?.plan?.until)}</span>
      </div>
      <b className="gc-name">{p.name || "MovEazy Partner"}</b>
      <span className="gc-meta">{[p.agency, status?.profile?.rera_id && `RERA ${status.profile.rera_id}`].filter(Boolean).join(" · ")}</span>
      {areas.length > 0 && <span className="gc-areas"><MapPin size={12} /> {areas.slice(0, 4).join(", ")}{areas.length > 4 ? ` +${areas.length - 4}` : ""}</span>}
      <Link to={pp("/referrals")} className="gc-ref"><Gift size={14} /> Refer & Earn {inr(REFERRAL_REWARD)}</Link>
    </div>
  );
}

const WP_CSS = `
.wp { min-height: 100dvh; position: relative; overflow: hidden; color: #fff; background: radial-gradient(120% 70% at 50% 0%, #1B6B4E, #0A3A2A 50%, #05241A); }
.wp-in { position: relative; z-index: 1; max-width: 520px; margin: 0 auto; padding: 48px 20px 36px; text-align: center; }
.wp-confetti { position: absolute; inset: 0; pointer-events: none; }
.wp-confetti i { position: absolute; top: -20px; width: 9px; height: 16px; border-radius: 2px; opacity: .9; animation: wpfall linear infinite; }
@keyframes wpfall { to { top: 105%; transform: rotate(540deg); } }
.wp-badge { width: 76px; height: 76px; border-radius: 24px; margin: 0 auto 14px; display: grid; place-items: center; color: #1F1605;
  background: linear-gradient(135deg, #F7E9C6, #E4B659); box-shadow: 0 0 0 10px rgba(228,182,89,.15), 0 18px 40px rgba(228,182,89,.35); animation: wppop .6s cubic-bezier(.2,1.6,.4,1); }
@keyframes wppop { from { transform: scale(.3) rotate(-20deg); opacity: 0; } }
.wp-kicker { margin: 0; font-size: 12.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #E4B659; }
.wp h1 { margin: 8px 0 8px; font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; color: #fff; }
.wp h1 span { color: #E4B659; }
.wp-sub { margin: 0 0 22px; color: rgba(255,255,255,.75); font-size: 14.5px; }
.wp-roi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.wp-roi > div { display: grid; justify-items: center; gap: 4px; padding: 14px 8px; border-radius: 16px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); color: #E4B659; }
.wp-roi b { font-size: 19px; color: #fff; letter-spacing: -0.01em; }
.wp-roi span { font-size: 11.5px; line-height: 1.35; color: rgba(255,255,255,.72); }
.wp-small { font-size: 13px; color: rgba(255,255,255,.7); margin: 12px 0 22px; }
.wp-refer { display: flex; gap: 12px; align-items: center; text-align: left; padding: 14px; border-radius: 16px; color: #1F1605;
  background: linear-gradient(135deg, #F7E9C6, #E4B659); }
.wp-refer b { display: block; font-size: 16px; }
.wp-refer span { font-size: 13px; }
.wp-skip { margin-top: 18px; border: 0; background: none; color: #fff; font: inherit; font-weight: 800; font-size: 15px; cursor: pointer; }
.rf-btns { display: grid; gap: 8px; margin-top: 12px; }
.rf-wa { min-height: 50px; border: 0; border-radius: 14px; background: #22C55E; color: #fff; font: inherit; font-size: 15.5px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
.rf-btns.big .rf-wa { min-height: 56px; font-size: 16.5px; box-shadow: 0 12px 28px rgba(34,197,94,.35); }
.rf-copy { min-height: 42px; border-radius: 12px; border: 1px dashed rgba(138,100,25,.5); background: rgba(255,255,255,.08); color: inherit; font: inherit; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.wp .rf-copy { color: #fff; border-color: rgba(255,255,255,.35); }
.rf-hero { text-align: center; padding: 20px 16px; border-radius: 20px; color: #1F1605; background: linear-gradient(135deg, #FFFBEB, #F7E9C6 60%, #E4B659); }
.rf-hero h2 { margin: 8px 0 4px; font-size: 21px; }
.rf-hero p { margin: 0; font-size: 14px; line-height: 1.5; }
.cp-card { width: 100%; display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; cursor: pointer; font: inherit; color: var(--ink);
  border: 1.5px solid #F1DCA7; background: linear-gradient(135deg, #FFFBEB, #FFF3D6); text-align: left; margin-bottom: 12px; }
.cp-card b { display: block; font-size: 15.5px; }
.cp-card span span, .cp-card > span:nth-child(2) > span { display: block; font-size: 13px; color: #6B4E14; }
.cp-ring { width: 44px; height: 44px; border-radius: 99px; display: grid; place-items: center; flex: none; color: #8A6419; background: conic-gradient(#E4B659 0 60%, #F7E9C6 60% 100%); }
.cp-go { flex: none; font-size: 13px; font-weight: 800; color: #fff; background: #8A6419; border-radius: 99px; padding: 7px 14px; }
.gc { position: relative; overflow: hidden; display: grid; gap: 3px; padding: 16px; border-radius: 18px; margin-bottom: 12px; color: #2A1D05;
  background: linear-gradient(135deg, #F7E9C6 0%, #E4B659 45%, #C9A04A 70%, #F2CD7A 100%); box-shadow: 0 12px 28px rgba(138,100,25,.28); }
.gc::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%); transform: translateX(-100%); animation: gcshine 4s ease-in-out infinite; }
@keyframes gcshine { 60%, 100% { transform: translateX(100%); } }
.gc-top { display: flex; justify-content: space-between; align-items: center; }
.gc-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; background: rgba(42,29,5,.12); padding: 4px 9px; border-radius: 99px; }
.gc-until { font-size: 12px; font-weight: 700; opacity: .8; }
.gc-name { font-size: 20px; letter-spacing: -0.01em; margin-top: 6px; }
.gc-meta { font-size: 12.5px; font-weight: 600; opacity: .85; }
.gc-areas { display: flex; align-items: center; gap: 4px; font-size: 12.5px; opacity: .85; }
.gc-ref { position: relative; z-index: 1; justify-self: start; margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800;
  color: #fff; background: #2A1D05; border-radius: 99px; padding: 7px 12px; text-decoration: none; }
@media (prefers-reduced-motion: reduce) { .wp-confetti, .gc::after { display: none; } }
`;
