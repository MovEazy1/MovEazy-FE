/**
 * Join Premium — every plan on one screen, one tap to pay.
 *
 * Plans and prices come from the database (partner_plans, editable by the
 * super admin in /sales-funnel). "Pay" records the attempt and opens Razorpay
 * for exactly that plan (lib/partnerPlans.js → /api/partner-pay); Razorpay's
 * webhook turns the payment into premium time and the broker lands on the
 * congratulations page via /premium/return.
 */
import { useEffect, useState } from "react";
import { Check, Crown, ShieldCheck, Sparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Loading, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { useLandingSettings } from "../../lib/landingSettings";
import { friendlyError, inr } from "../../lib/partners";
import { fetchPlans, startPlanPayment } from "../../lib/partnerPlans";

const PERKS = [
  "1000+ MovEazy listings with owner contacts, updated daily",
  "The broker network and your association groups",
  "AI matching + curated lists your tenants swipe on WhatsApp",
  "Notifications the moment a tenant likes a home",
  "Keep your share of the brokerage on every MovEazy deal",
];

export default function PremiumPage() {
  const { me, status } = usePartner();
  const s = useLandingSettings();
  const [plans, setPlans] = useState(null);
  const [pick, setPick] = useState("pro_12m");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(null);
  const active = status?.plan?.active;
  const until = status?.plan?.until ? new Date(status.plan.until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  useEffect(() => {
    fetchPlans().then((p) => {
      setPlans(p);
      if (p.length && !p.some((x) => x.id === "pro_12m")) setPick(p[p.length - 1].id);
    }, () => setPlans([]));
  }, []);

  const plan = plans?.find((p) => p.id === pick);
  const pay = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await startPlanPayment(plan.id);
      if (r.mode !== "razorpay") { setManual(r); setBusy(false); return; }
      window.location.assign(r.url);
    } catch (e) {
      toast(friendlyError(e, "Could not start the payment."), "error");
      setBusy(false);
    }
  };

  const help = `${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(
    `Hi MovEazy, I'd like to join Premium on the partner app.\nName: ${me?.partner?.name || ""}\nMobile: ${me?.partner?.phone || ""}`)}`;

  return (
    <>
      <TopBar title="Join Premium" back />
      <style>{CSS}</style>
      <div className="pz-pad jp">
        <div className="jp-hero">
          <span className="jp-crown"><Crown size={26} /></span>
          <h2>{active ? "You're on Premium" : "Become a MovEazy Premium Partner"}</h2>
          <p>{active ? `Active until ${until}. Add more time below — it starts when your current plan ends.` : `Everything unlocked. You keep ${me?.property_share ?? s.propertyShare}% of the brokerage on MovEazy properties.`}</p>
        </div>

        {!plans ? <Loading label="Loading plans…" /> : plans.length === 0 ? (
          <div className="pz-section">Plans are being updated. <a href={help} target="_blank" rel="noreferrer">Message MovEazy</a></div>
        ) : (
          <div className="jp-plans" role="radiogroup" aria-label="Choose a plan">
            {plans.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className={`jp-plan${pick === p.id ? " on" : ""}`} onClick={() => setPick(p.id)}>
                {p.id === "pro_12m" && <span className="jp-tag"><Sparkles size={12} /> Best value</span>}
                <span className="jp-radio" aria-hidden>{pick === p.id && <Check size={14} />}</span>
                <span className="jp-name">{p.label}</span>
                <span className="jp-price">{inr(p.price)}</span>
                <span className="jp-per">{p.months > 1 ? `${inr(p.per_month)} / month` : "one month"}</span>
                {p.note && <span className={`jp-note${p.refund_days ? " refund" : ""}`}>{p.refund_days ? <ShieldCheck size={13} /> : null}{p.note}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="pz-section" style={{ marginTop: 14 }}>
          {PERKS.map((t) => (
            <div key={t} className="pz-row" style={{ padding: "6px 0", alignItems: "flex-start" }}>
              <Check size={18} color="var(--g)" style={{ flex: "none", marginTop: 2 }} /> <span style={{ fontSize: 14.5 }}>{t}</span>
            </div>
          ))}
        </div>

        {manual ? (
          <div className="pz-section jp-manual">
            <strong>{manual.mode === "whatsapp" ? `Pay ${inr(manual.payment.amount)} with the MovEazy team` : `Pay ${inr(manual.payment.amount)} on Razorpay`}</strong>
            <p className="pz-meta">
              {manual.mode === "whatsapp"
                ? "Message us and we'll send you the payment link. Your plan is activated as soon as it's paid."
                : "Your plan is activated within a few hours of payment. Keep the receipt; the team may ask for it."}
            </p>
            <a className={`pz-btn pz-btn--block ${manual.mode === "whatsapp" ? "pz-wa" : "pz-btn--primary"}`} href={manual.url} target="_blank" rel="noreferrer">
              {manual.mode === "whatsapp" ? <><WhatsAppIcon /> Message MovEazy</> : "Open payment page"}
            </a>
          </div>
        ) : null}
      </div>

      {plan && !manual && (
        <div className="jp-foot">
          <button type="button" className="jp-pay" onClick={pay} disabled={busy}>
            {busy ? "Opening Razorpay…" : `Pay ${inr(plan.price)} · ${plan.label}`}
          </button>
          <a className="jp-help" href={help} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> Questions? Talk to us</a>
        </div>
      )}
    </>
  );
}

const CSS = `
.jp { padding-bottom: 150px; }
.jp-hero { text-align: center; padding: 22px 16px 18px; border-radius: 20px; color: #fff;
  background: radial-gradient(120% 100% at 0% 0%, #1B6B4E, #0A3A2A 55%, #05241A); }
.jp-crown { width: 56px; height: 56px; border-radius: 18px; margin: 0 auto 10px; display: grid; place-items: center; color: #1F1605;
  background: linear-gradient(135deg, #F7E9C6, #E4B659); }
.jp-hero h2 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.01em; color: #fff; }
.jp-hero p { margin: 0; font-size: 14.5px; color: rgba(255,255,255,.8); line-height: 1.5; }
.jp-plans { display: grid; gap: 12px; margin-top: 16px; }
.jp-plan { position: relative; display: grid; grid-template-columns: 24px 1fr auto; grid-template-areas: "r n p" "r per per" "r note note";
  gap: 2px 10px; align-items: center; text-align: left; padding: 16px; border-radius: 16px; border: 2px solid var(--line); background: #fff; font: inherit; color: var(--ink); cursor: pointer; }
.jp-plan.on { border-color: #C9A04A; background: linear-gradient(135deg, #FFFBEB, #FFF3D6); box-shadow: 0 10px 24px rgba(138,100,25,.15); }
.jp-radio { grid-area: r; width: 22px; height: 22px; border-radius: 99px; border: 2px solid #D1D5DB; display: grid; place-items: center; color: #fff; }
.jp-plan.on .jp-radio { background: #8A6419; border-color: #8A6419; }
.jp-name { grid-area: n; font-size: 17px; font-weight: 800; }
.jp-price { grid-area: p; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
.jp-per { grid-area: per; font-size: 13px; color: var(--dim); }
.jp-note { grid-area: note; display: flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 12.5px; color: var(--dim); }
.jp-note.refund { color: #166534; font-weight: 700; }
.jp-tag { position: absolute; top: -10px; right: 14px; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .06em; color: #1F1605; background: #E4B659; border-radius: 99px; padding: 3px 9px; }
.jp-manual p { margin: 6px 0 12px; }
.jp-foot { position: fixed; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 25; padding: 12px 16px 8px; max-width: 520px; margin: 0 auto;
  background: linear-gradient(rgba(246,247,246,0), var(--bg) 30%); text-align: center; }
.jp-pay { width: 100%; min-height: 54px; border: 0; border-radius: 14px; cursor: pointer; font: inherit; font-size: 16.5px; font-weight: 800; color: #1F1605;
  background: linear-gradient(180deg, #F2CD7A, #E4B659); box-shadow: 0 12px 26px rgba(138,100,25,.3); }
.jp-pay:disabled { opacity: .7; }
.jp-help { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; color: var(--dim); font-weight: 600; }
`;
