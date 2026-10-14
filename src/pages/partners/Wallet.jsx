/**
 * The Wallet (/referrals, the wallet icon on the home bar): what the partner
 * has earned and where it's paid, then Earn Commission — 10% of the rent on
 * every MovEazy lead the partners they add close, for life, out of MovEazy's
 * share (partner_referral_commission.sql) — and how each of those partners is
 * doing. (The one-time reward on a partner's plan is gone:
 * partner_pool_milestones.sql.)
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Crown, HandCoins, Infinity as InfinityIcon, Minus, Plus, Rocket, Users, Wallet as WalletIcon } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Loading, TopBar, WhatsAppIcon } from "./partnerUi";
import { PayoutCard, ReferButtons, WP_CSS } from "./PremiumJourney";
import { friendlyError, hasPremium, inr, pp } from "../../lib/partners";
import { PARTNER_ORIGIN, fetchMyReferrals, lifetimeEstimate, pctLabel, walletTotals } from "../../lib/partnerPlans";

/** ₹0 reads as ₹0 here, never a dash. */
const rs = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

/** A referred partner's deal, as the referrer's commission on it stands. */
const DEAL_STATUS = {
  waiting: ["Waiting for MovEazy's share", "var(--warn)"],
  due: ["Due to you", "#15803D"],
  paid: ["Paid to you", "#166534"],
  held: ["Held: go Premium", "var(--warn)"],
  lost: ["Missed", "var(--red)"],
  none: ["No commission", "var(--mute)"],
};

export default function Wallet() {
  const { me } = usePartner();
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const load = () => fetchMyReferrals().then(setR, (e) => setErr(friendlyError(e, "Couldn't open your Wallet.")));
  useEffect(() => { load(); }, []);

  const t = useMemo(() => walletTotals(r), [r]);
  if (err) return <><TopBar title="Wallet" back /><div className="pz-pad"><div className="pz-err">{err}</div></div></>;
  if (!r) return <><TopBar title="Wallet" back /><Loading label="Opening your Wallet…" /></>;

  const direct = Number(r.rates?.direct ?? 10);
  const shared = Number(r.rates?.shared ?? 6.67);
  const hasPayout = Boolean(r.payout?.upi || r.payout?.bank_last4);

  return (
    <>
      <TopBar title="Wallet" back />
      <style>{WP_CSS}{CSS}</style>
      <div className="pz-pad">
        {/* ── The wallet ── */}
        <section className="wl-card" aria-label="Your wallet">
          <span className="wl-kicker"><WalletIcon size={15} /> Your wallet</span>
          <div className="wl-big">{rs(t.available)}</div>
          <span className="wl-sub">{t.available > 0 ? (hasPayout ? "Ready to be paid out to you" : "Ready to pay out — add where to pay you below") : "Available to pay out"}</span>
          <div className="wl-grid">
            <div><b>{rs(t.onTheWay)}</b><span>On the way</span></div>
            <div><b>{rs(t.lifetime)}</b><span>Lifetime commission</span></div>
            <div><b>{rs(t.paid)}</b><span>Paid to you</span></div>
          </div>
          {t.held > 0 && (
            <Link to={pp("/premium")} className="wl-held">
              <Clock size={16} />
              <span><b>{inr(t.held)} waiting for you.</b> Go Premium{t.heldUntil ? ` by ${shortDate(t.heldUntil)}` : ""} to claim it, or it's lost.</span>
            </Link>
          )}
        </section>
        {(hasPayout || t.available > 0 || t.lifetime > 0 || Number(r.paid) > 0) && <PayoutCard payout={r.payout} onSaved={load} />}

        {/* ── Earn Commission ── */}
        <h2 className="wl-h">Earn Commission</h2>
        <section className="wl-life">
          <span className="wl-badge"><HandCoins size={15} /> Lifetime commission</span>
          <h3>Add partners. Earn <em>{pctLabel(direct)}</em> on every property they close. For life.</h3>
          <p>
            Add as many partners as you want. For every partner you add, you earn a lifetime commission of {pctLabel(direct)} on
            the property closed by that partner ({pctLabel(shared)} when the deal is shared).
          </p>
          <p>
            The {pctLabel(direct)} comes from MovEazy&apos;s share of that closure — nothing is deducted from your associated partner,
            and you make money without any hassle.
          </p>
          <div className="wl-eg">
            <span>They close a<b>₹40,000 flat</b></span>
            <span className="wl-arrow" aria-hidden>→</span>
            <span>You earn<b>{inr(Math.round(40000 * direct / 100))}</b></span>
          </div>
          <ul className="wl-points">
            <li><Rocket size={16} /><span><b>Early mover advantage.</b> Every partner you bring in now keeps earning for you, month after month.</span></li>
            <li><Users size={16} /><span><b>No limit.</b> Add as many partners as you want — the more of them close deals, the bigger your monthly income.</span></li>
            <li><InfinityIcon size={16} /><span><b>Zero effort.</b> You don't touch the deal: no calls, no visits, no follow-ups.</span></li>
          </ul>
          <Estimator rate={direct} />
          <EarnCta r={r} me={me} />
        </section>

        {/* ── How your partners are doing ── */}
        <h2 className="wl-h">Your partners{r.joined.length ? ` · ${r.joined.length}` : ""}</h2>
        {r.joined.length === 0 ? (
          <p className="pz-meta" style={{ margin: "0 0 14px" }}>Nobody yet. Share your link on your broker WhatsApp groups; every partner you bring keeps earning for you.</p>
        ) : r.joined.map((j, i) => <PartnerCard key={i} j={j} rate={direct} />)}
      </div>
    </>
  );
}

/**
 * Under the estimator: Premium and trial partners get only their invite
 * buttons; anyone else is pointed to Premium, with the fine print on why.
 */
export function EarnCta({ r, me }) {
  if (r.premium || hasPremium(me)) return r.can_refer ? <ReferButtons code={r.code} name={me?.partner?.name} big /> : null;
  return (
    <>
      <Link to={pp("/premium")} className="wl-upgrade"><Crown size={18} /> {r.can_refer ? "Renew Premium to keep earning" : "Go Premium to start earning"}</Link>
      <p className="wl-fine">
        You and your partner both need Premium (Trial counts) when the deal happens. Your commission is due once MovEazy receives its share.
      </p>
    </>
  );
}

/** "Bring 10 partners, each closing 1 deal a month at ₹30,000": what that pays the referrer. */
function Estimator({ rate }) {
  const [n, setN] = useState(10);
  const [deals, setDeals] = useState(1);
  const [rent, setRent] = useState(30000);
  const e = lifetimeEstimate(n, deals, rent, rate);
  const step = (v, set, d, min, max) => set(Math.min(max, Math.max(min, v + d)));
  return (
    <div className="wl-est">
      <div className="wl-est-row">
        <span>Partners you bring</span>
        <span className="wl-step">
          <button type="button" aria-label="Fewer partners" onClick={() => step(n, setN, n > 10 ? -5 : -1, 1, 200)}><Minus size={15} /></button>
          <b>{n}</b>
          <button type="button" aria-label="More partners" onClick={() => step(n, setN, n >= 10 ? 5 : 1, 1, 200)}><Plus size={15} /></button>
        </span>
      </div>
      <div className="wl-est-row">
        <span>Deals each closes a month</span>
        <span className="wl-step">
          <button type="button" aria-label="Fewer deals" onClick={() => step(deals, setDeals, -1, 1, 10)}><Minus size={15} /></button>
          <b>{deals}</b>
          <button type="button" aria-label="More deals" onClick={() => step(deals, setDeals, 1, 1, 10)}><Plus size={15} /></button>
        </span>
      </div>
      <div className="wl-est-row">
        <span>Average rent</span>
        <span className="wl-rents">
          {[20000, 30000, 50000].map((v) => (
            <button key={v} type="button" className={rent === v ? "on" : ""} onClick={() => setRent(v)}>{inr(v).replace(",000", "k")}</button>
          ))}
        </span>
      </div>
      <div className="wl-est-out">
        <span>You'd earn</span>
        <b>{inr(e.monthly)}<small>/month</small></b>
        <span className="wl-est-year">{inr(e.yearly)} a year, every year</span>
      </div>
      <span className="wl-est-note">An illustration of direct deals at your rate, not a promise.</span>
    </div>
  );
}

/** One partner they brought in: plan, leads in hand, deals closed and what each earned the referrer. */
function PartnerCard({ j, rate }) {
  const [open, setOpen] = useState(false);
  const deals = j.deals ?? [];
  const earned = deals.filter((d) => ["due", "paid"].includes(d.status)).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const plan = j.premium_until ? ["Premium", `till ${shortDate(j.premium_until)}`, "on"]
    : j.trial_until ? ["Trial", `till ${shortDate(j.trial_until)}`, "on"]
      : ["Free", "no commission until they go Premium", "off"];
  const first = String(j.name || "").trim().split(/\s+/)[0];
  const nudge = `Hi ${first}, go Premium on MovEazy Partners: MovEazy leads, every broker's inventory and AI matching for your clients. ${PARTNER_ORIGIN}/premium`;
  const phone = String(j.phone || "").replace(/\D/g, "").slice(-10);
  return (
    <div className="pz-section wl-p">
      <div className="pz-row" style={{ alignItems: "flex-start" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block" }}>{j.name}</strong>
          <span className="pz-meta">Joined {fmtDate(j.joined_at)}</span>
        </span>
        <span className={`wl-plan ${plan[2]}`}>{plan[0]}<small>{plan[1]}</small></span>
      </div>
      <div className="wl-stats">
        <div><b>{j.working ?? 0}</b><span>Leads in hand</span></div>
        <div><b>{deals.length}</b><span>Deals closed</span></div>
        <div><b>{rs(earned)}</b><span>You earned</span></div>
      </div>
      {plan[2] === "off" && phone.length === 10 && (
        <a className="wl-nudge" href={`https://wa.me/91${phone}?text=${encodeURIComponent(nudge)}`} target="_blank" rel="noreferrer">
          <WhatsAppIcon size={16} /> Nudge {first || "them"} to Premium
        </a>
      )}
      {(j.working ?? 0) > 0 && plan[2] === "on" && (
        <p className="wl-pot">Every lead {first || "they"} closes earns you about {pctLabel(rate)} of its rent.</p>
      )}
      {deals.length > 0 && (
        <>
          <button type="button" className="wl-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide deals" : `See ${deals.length === 1 ? "the deal" : `all ${deals.length} deals`}`}
          </button>
          {open && deals.map((d, i) => {
            const [label, color] = DEAL_STATUS[d.status] || DEAL_STATUS.none;
            return (
              <div key={i} className="wl-deal">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{inr(d.rent)} rent</b>
                  <span className="pz-meta"> · {d.deal_type === "direct" ? "direct" : "shared"} · {shortDate(d.closed_at)}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  {Number(d.amount) > 0 && <b style={{ display: "block" }}>{inr(d.amount)}</b>}
                  <span style={{ color, fontSize: 12, fontWeight: 700 }}>
                    {label}{d.status === "held" && d.hold_until ? ` by ${shortDate(d.hold_until)}` : ""}
                  </span>
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const CSS = `
.wl-card { position: relative; overflow: hidden; border-radius: 20px; padding: 18px 16px 16px; margin-bottom: 12px; color: #fff;
  background: radial-gradient(120% 90% at 100% 0%, #3A2E12, #16141C 55%, #0E0D12); border: 1px solid #2A2733; }
.wl-card::after { content: ""; position: absolute; right: -40px; top: -40px; width: 160px; height: 160px; border-radius: 50%;
  background: radial-gradient(circle, rgba(240,207,124,.28), transparent 70%); pointer-events: none; }
.wl-kicker { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #F0CF7C; }
.wl-big { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; margin: 6px 0 0; }
.wl-sub { display: block; font-size: 13px; color: rgba(255,255,255,.66); }
.wl-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.wl-grid > div { padding: 10px 8px; border-radius: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); display: grid; gap: 2px; }
.wl-grid b { font-size: 15.5px; }
.wl-grid span { font-size: 11px; color: rgba(255,255,255,.62); line-height: 1.3; }
.wl-held { position: relative; z-index: 1; display: flex; gap: 8px; align-items: flex-start; margin-top: 12px; padding: 10px 12px; border-radius: 12px;
  background: #FEF3C7; color: #5C3F05; font-size: 13px; line-height: 1.4; text-decoration: none; }
.wl-held svg { flex: none; margin-top: 1px; }
.wl-h { font-size: 17px; margin: 20px 0 10px; }
.wl-life { border-radius: 20px; padding: 18px 16px; color: #1F1605; background: linear-gradient(160deg, #FFFBEB, #F7E9C6 55%, #EBC66E);
  border: 1px solid #E4B659; box-shadow: 0 14px 34px rgba(212,164,55,.22); }
.wl-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; background: #1F1605; color: #F0CF7C;
  font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.wl-life h3 { margin: 12px 0 6px; font-size: 22px; line-height: 1.22; letter-spacing: -0.01em; }
.wl-life h3 em { font-style: normal; color: #8A6419; }
.wl-life > p { margin: 0; font-size: 14px; line-height: 1.5; }
.wl-eg { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin: 14px 0 4px; padding: 12px; border-radius: 14px;
  background: rgba(255,255,255,.65); font-size: 12.5px; text-align: center; }
.wl-eg b { display: block; font-size: 17px; margin-top: 1px; }
.wl-eg > span:last-child b { color: #8A6419; }
.wl-arrow { font-weight: 800; color: #8A6419; }
.wl-points { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 9px; }
.wl-points li { display: flex; gap: 9px; align-items: flex-start; font-size: 13.5px; line-height: 1.45; }
.wl-points svg { flex: none; margin-top: 2px; color: #8A6419; }
.wl-est { margin: 4px 0 2px; padding: 12px; border-radius: 14px; background: #1F1605; color: #fff; }
.wl-est-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 5px 0; font-size: 13.5px; }
.wl-step { display: inline-flex; align-items: center; gap: 10px; }
.wl-step b { min-width: 26px; text-align: center; font-size: 16px; }
.wl-step button, .wl-rents button { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.08); color: #fff; font: inherit; cursor: pointer; }
.wl-step button { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; }
.wl-rents { display: inline-flex; gap: 5px; }
.wl-rents button { height: 30px; padding: 0 9px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
.wl-rents button.on { background: #F0CF7C; border-color: #F0CF7C; color: #1F1605; }
.wl-est-out { display: grid; justify-items: center; gap: 2px; margin-top: 8px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.14); }
.wl-est-out > span:first-child { font-size: 12px; color: rgba(255,255,255,.7); }
.wl-est-out b { font-size: 28px; color: #F0CF7C; letter-spacing: -0.02em; }
.wl-est-out small { font-size: 14px; color: rgba(255,255,255,.75); font-weight: 600; }
.wl-est-year { font-size: 13px; font-weight: 700; }
.wl-est-note { display: block; text-align: center; margin-top: 6px; font-size: 11px; color: rgba(255,255,255,.5); }
.wl-upgrade { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; margin-top: 12px; border-radius: 14px;
  background: #1F1605; color: #F0CF7C; font-size: 15.5px; font-weight: 800; text-decoration: none; }
.wl-fine { margin: 10px 0 0 !important; font-size: 12px !important; color: #5C3F05; }
.wl-once { display: flex; gap: 10px; align-items: flex-start; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: var(--card);
  border: 1px solid var(--line); font-size: 14px; line-height: 1.45; }
.wl-once > svg { flex: none; color: #8A6419; margin-top: 1px; }
.wl-rates { display: block; margin-top: 2px; font-size: 12.5px; color: var(--dim); }
.wl-plan { display: grid; justify-items: end; font-size: 12.5px; font-weight: 800; padding: 4px 10px; border-radius: 10px; text-align: right; }
.wl-plan small { font-size: 10.5px; font-weight: 600; opacity: .8; }
.wl-plan.on { background: #F6E7BF; color: #7A5A12; }
.wl-plan.off { background: var(--bg); color: var(--dim); max-width: 150px; }
.wl-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
.wl-stats > div { display: grid; gap: 1px; padding: 8px; border-radius: 10px; background: var(--bg); }
.wl-stats b { font-size: 15px; }
.wl-stats span { font-size: 11px; color: var(--dim); }
.wl-nudge { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; margin-top: 10px; border-radius: 11px;
  background: #22C55E; color: #fff; font-size: 13.5px; font-weight: 800; text-decoration: none; }
.wl-pot { margin: 8px 0 0; font-size: 12.5px; color: var(--dim); }
.wl-toggle { margin-top: 8px; border: 0; background: none; padding: 4px 0; color: var(--g); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.wl-deal { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
.wl-once-line { display: flex; gap: 6px; align-items: center; margin-top: 10px; padding-top: 9px; border-top: 1px dashed var(--line); font-size: 12.5px; color: var(--dim); }
`;
