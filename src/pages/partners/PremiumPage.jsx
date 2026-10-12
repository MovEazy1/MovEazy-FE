/**
 * Join Premium — every plan on one screen, priced per month, the 5-month plan
 * picked and marked "Most popular".
 *
 * Plans and prices come from the database (partner_plans). "Pay" opens
 * MovEazy's UPI QR — the same as the lead pack's — and asks for the UTR; the
 * payment then waits for the CRM (Brokers → MovEazy partners), and approving
 * it starts Premium (partner_premium_upi.sql). Razorpay replaces the QR once
 * it's live.
 */
import { useEffect, useState } from "react";
import { Check, Clock, Crown, ShieldCheck, Sparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Loading, Sheet, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import UpiPay from "./UpiPay";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { useLandingSettings } from "../../lib/landingSettings";
import { friendlyError, inr } from "../../lib/partners";
import { cleanUtr } from "../../lib/partnerLeads";
import { POPULAR_PLAN, fetchPlans, planPriceLines, startPlanUpi, submitPlanUtr } from "../../lib/partnerPlans";

const PERKS = [
  "1000+ MovEazy listings with owner contacts, updated daily",
  "The broker network and your association groups",
  "AI matching + curated lists your tenants swipe on WhatsApp",
  "Notifications the moment a tenant likes a home",
  "Keep your share of the brokerage on every MovEazy deal",
];

export default function PremiumPage() {
  const { me, status, reloadStatus } = usePartner();
  const s = useLandingSettings();
  const [plans, setPlans] = useState(null);
  const [pick, setPick] = useState(POPULAR_PLAN);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(null); // { id, amount, label, months, upi_id }
  const [utr, setUtr] = useState("");
  const checking = status?.payment?.status === "payment_check";
  const active = status?.plan?.active;
  const trial = status?.trial;
  const until = status?.plan?.until ? new Date(status.plan.until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  useEffect(() => {
    fetchPlans().then((p) => {
      setPlans(p);
      if (p.length && !p.some((x) => x.id === POPULAR_PLAN)) setPick(p[Math.floor(p.length / 2)].id);
    }, () => setPlans([]));
  }, []);

  const plan = plans?.find((p) => p.id === pick);
  const pay = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      setUtr("");
      setPaying(await startPlanUpi(plan.id));
    } catch (e) {
      toast(friendlyError(e, "Could not start the payment."), "error");
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    try {
      await submitPlanUtr(paying.id, cleanUtr(utr));
      setPaying(null);
      toast("Payment received — we're checking it. Premium starts as soon as it's confirmed.");
      reloadStatus?.();
    } catch (e) {
      toast(friendlyError(e, "Could not send that."), "error");
    } finally {
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
          <h2>{active ? "You're on Premium" : trial?.active ? `You're on Trial Premium · ${trial.days_left} day${trial.days_left === 1 ? "" : "s"} left` : "Become a MovEazy Premium Partner"}</h2>
          <p>{active ? `Active until ${until}. Add more time below — it starts when your current plan ends.`
            : trial?.active ? "Take Premium now and keep everything after the trial — plus unlimited MovEazy leads. Your remaining trial days are added on at the end."
              : `Everything unlocked. You keep ${me?.property_share ?? s.propertyShare}% of the brokerage on MovEazy properties.`}</p>
        </div>

        {!plans ? <Loading label="Loading plans…" /> : plans.length === 0 ? (
          <div className="pz-section">Plans are being updated. <a href={help} target="_blank" rel="noreferrer">Message MovEazy</a></div>
        ) : (
          <div className="jp-plans" role="radiogroup" aria-label="Choose a plan">
            {plans.map((p) => {
              const lines = planPriceLines(p);
              const popular = p.id === POPULAR_PLAN;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={pick === p.id}
                  className={`jp-plan${pick === p.id ? " on" : ""}${popular ? " popular" : ""}`} onClick={() => setPick(p.id)}>
                  {popular && <span className="jp-ribbon"><Sparkles size={12} /> Most popular</span>}
                  {p.id === "pro_12m" && <span className="jp-tag">Best value</span>}
                  <span className="jp-radio" aria-hidden>{pick === p.id && <Check size={14} />}</span>
                  <span className="jp-name">{p.label}</span>
                  <span className="jp-price">{lines.perMonth}</span>
                  <span className="jp-per">{lines.total}</span>
                  {p.note && <span className={`jp-note${p.refund_days ? " refund" : ""}`}>{p.refund_days ? <ShieldCheck size={13} /> : null}{p.note}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="pz-section" style={{ marginTop: 14 }}>
          {PERKS.map((t) => (
            <div key={t} className="pz-row" style={{ padding: "6px 0", alignItems: "flex-start" }}>
              <Check size={18} color="var(--g)" style={{ flex: "none", marginTop: 2 }} /> <span style={{ fontSize: 14.5 }}>{t}</span>
            </div>
          ))}
        </div>

      </div>

      {plan && (
        <div className="jp-foot">
          {checking ? (
            <div className="jp-checking"><Clock size={17} /> Payment received · we’re checking it (usually within a few hours)</div>
          ) : (
            <button type="button" className="jp-pay" onClick={pay} disabled={busy}>
              {busy && !paying ? "Opening payment…" : `Pay ${inr(plan.price)} · ${plan.label}`}
            </button>
          )}
          <a className="jp-help" href={help} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> Questions? Talk to us</a>
        </div>
      )}

      {paying && (
        <Sheet title={`${paying.label} · ${inr(paying.amount)}`} onClose={() => setPaying(null)}>
          <div className="pz-pad">
            <UpiPay upi={paying.upi_id} amount={paying.amount} note={`MovEazy Premium ${paying.label}`} utr={utr} setUtr={setUtr}
              busy={busy} onSubmit={submit} payingFor={`the ${paying.label} Premium plan (${inr(paying.amount)})`}
              who={{ name: me?.partner?.name, phone: me?.partner?.phone }}>
              <p className="pz-hint" style={{ margin: "0 0 12px" }}>
                Premium starts as soon as the MovEazy team confirms the payment — usually within a few hours.
                {trial?.active ? " Your remaining trial days are added on at the end." : ""}
              </p>
            </UpiPay>
          </div>
        </Sheet>
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
.jp-plan.popular { border-color: #C9A04A; }
.jp-ribbon { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #fff; white-space: nowrap;
  background: linear-gradient(90deg, #8A6419, #C9A04A); border-radius: 99px; padding: 4px 11px; box-shadow: 0 4px 10px rgba(138,100,25,.3); }
.jp-tag { position: absolute; top: -9px; right: 14px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
  color: #5C3F05; background: #F6E7BF; border-radius: 99px; padding: 2px 8px; }
.jp-checking { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 54px; border-radius: 14px; padding: 0 14px;
  font-weight: 700; font-size: 14px; color: #5C3F05; background: #FFF3D6; border: 1px solid #E9C877; }
.jp-foot { position: fixed; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 25; padding: 12px 16px 8px; max-width: 520px; margin: 0 auto;
  background: linear-gradient(rgba(246,247,246,0), var(--bg) 30%); text-align: center; }
.jp-pay { width: 100%; min-height: 54px; border: 0; border-radius: 14px; cursor: pointer; font: inherit; font-size: 16.5px; font-weight: 800; color: #1F1605;
  background: linear-gradient(180deg, #F2CD7A, #E4B659); box-shadow: 0 12px 26px rgba(138,100,25,.3); }
.jp-pay:disabled { opacity: .7; }
.jp-help { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; color: var(--dim); font-weight: 600; }
`;
