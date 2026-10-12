/**
 * Screen 10 — Earnings: my total, pending and paid, recent activity; and the
 * full history (the ledger): each deal's reference, date, brokerage basis,
 * the society's pool, my share and its status and UPI reference.
 * Only the signed-in member's own money is shown.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, FileText, Info, Wallet } from "lucide-react";
import { dayLabel, fetchSocietyEarnings, rupees, societyError, sp } from "../../lib/society";
import { Empty, Loading, Sheet, TopBar } from "./societyUi";

function useEarnings() {
  const [e, setE] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { fetchSocietyEarnings().then(setE, (x) => setErr(societyError(x))); }, []);
  return { e, err };
}

const STATUS = {
  pending: ["Pending", "ea-st--pending"], paid: ["Paid", "ea-st--paid"], cancelled: ["Cancelled", "ea-st--off"], adjustment: ["Adjusted", "ea-st--off"],
};

function Row({ x, detailed }) {
  const [label, cls] = STATUS[x.status] ?? STATUS.pending;
  return (
    <div className="ea-row">
      <span className="ea-ic"><FileText size={20} /></span>
      <span className="ea-main">
        <b>{x.flat} {x.bhk ? `(${String(x.bhk).replace(/\s+/g, "")})` : ""}</b>
        <em>{x.kind === "adjustment" ? "Deal cancelled — adjusted" : x.deal_status === "cancelled" ? "Deal cancelled" : "Rental Closed"}</em>
        {detailed && (
          <small>
            Deal {x.deal_ref} · brokerage {rupees(x.brokerage)} · society pool {Math.round(x.pool_pct)}% = {rupees(x.pool_amount)} · your share {Math.round(x.share_pct * 100) / 100}%
            {x.utr ? <><br />UPI ref {x.utr}{x.paid_at ? ` · ${dayLabel(x.paid_at)}` : ""}</> : null}
          </small>
        )}
      </span>
      <span className="ea-amt">
        <b className={x.amount < 0 ? "neg" : ""}>{x.amount < 0 ? "−" : "+ "}{rupees(Math.abs(x.amount))}</b>
        <em>{dayLabel(x.closed_on)}</em>
        {detailed && <i className={`ea-st ${cls}`}>{label}</i>}
      </span>
    </div>
  );
}

export default function Earnings() {
  const { e, err } = useEarnings();
  const [info, setInfo] = useState(false);
  return (
    <div className="sx-page ea">
      <style>{CSS}</style>
      <TopBar title="Earnings" back={sp("/")} />
      {err && <p className="sx-err">{err}</p>}
      {!e && !err ? <Loading /> : e && (
        <>
          <section className="ea-hero">
            <span>Total Earnings</span>
            <b>{rupees(e.total)} <button type="button" onClick={() => setInfo(true)} aria-label="How earnings work"><Info size={20} /></button></b>
            <Link to={sp("/earnings/history")}>View History <ChevronRight size={16} /></Link>
            <span className="ea-wallet"><Wallet size={40} /></span>
          </section>
          <div className="ea-two">
            <div className="ea-pend"><span><Clock size={18} /></span><b>{rupees(e.pending)}</b><em>Pending Payout</em></div>
            <div className="ea-paid"><span><CheckCircle2 size={18} /></span><b>{rupees(e.paid)}</b><em>Paid</em></div>
          </div>
          {!e.upi_id && (
            <Link to={sp("/upi")} className="sx-banner sx-banner--amber" style={{ textDecoration: "none" }}>
              <AlertTriangle size={18} /><span><b>Add your UPI ID to get paid.</b> Your earnings wait until you do.</span>
            </Link>
          )}
          <div className="sx-section-head">
            <h2>Recent Activity</h2>
            {e.entries.length > 0 && <Link to={sp("/earnings/history")} className="sx-link">View all</Link>}
          </div>
          {e.entries.length === 0 ? (
            <Empty title="No earnings yet">When MovEazy rents out a flat from your society, your share shows up here.</Empty>
          ) : <div className="sx-card ea-list">{e.entries.slice(0, 5).map((x) => <Row key={x.id} x={x} />)}</div>}
        </>
      )}
      {info && (
        <Sheet title="How you earn" onClose={() => setInfo(false)}>
          <p style={{ lineHeight: 1.55 }}>When MovEazy rents out a flat in your society, the brokerage is one month&apos;s rent.
            Your society gets {Math.round(e?.pool_pct ?? 70)}% of it, shared between the members as your manager has set (equally unless they change it).</p>
          <p style={{ lineHeight: 1.55 }}>MovEazy pays your share to your UPI ID and marks it paid with the UPI reference.</p>
          <button type="button" className="sx-btn" onClick={() => setInfo(false)}>Got it</button>
        </Sheet>
      )}
    </div>
  );
}

export function EarningsHistory() {
  const { e, err } = useEarnings();
  return (
    <div className="sx-page ea">
      <style>{CSS}</style>
      <TopBar title="Earnings history" back={sp("/earnings")} />
      {err && <p className="sx-err">{err}</p>}
      {!e && !err ? <Loading /> : e && (e.entries.length === 0
        ? <Empty title="No earnings yet">Your share of every rental MovEazy closes in your society will be listed here.</Empty>
        : <div className="sx-card ea-list">{e.entries.map((x) => <Row key={x.id} x={x} detailed />)}</div>)}
    </div>
  );
}

const CSS = `
.ea-hero { position: relative; overflow: hidden; margin-top: 10px; border-radius: 20px; padding: 20px; color: #fff; display: flex; flex-direction: column; gap: 4px;
  background: radial-gradient(130% 120% at 0% 0%, #13805D, #0A5E44 50%, #063B2D); box-shadow: 0 12px 28px rgba(6,59,45,.25); }
.ea-hero > span:first-child { color: #CFEADF; font-size: 15px; }
.ea-hero b { display: flex; align-items: center; gap: 8px; font-size: 34px; letter-spacing: -0.02em; }
.ea-hero b button { border: 0; background: none; color: #CFEADF; padding: 0; display: grid; cursor: pointer; }
.ea-hero a { color: #fff; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 2px; margin-top: 6px; width: max-content; }
.ea-wallet { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); width: 76px; height: 76px; border-radius: 18px; background: rgba(255,255,255,.1);
  display: grid; place-items: center; color: #D9F2E7; }
.ea-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
.ea-two > div { border-radius: 16px; padding: 14px; display: grid; grid-template-columns: auto 1fr; column-gap: 10px; align-items: center; }
.ea-two span { grid-row: span 2; width: 36px; height: 36px; border-radius: 99px; display: grid; place-items: center; background: #fff; }
.ea-two b { font-size: 19px; }
.ea-two em { font-style: normal; font-size: 13px; color: var(--dim); }
.ea-pend { background: #FFF4E2; } .ea-pend span { color: #C77700; }
.ea-paid { background: #E8F5EE; } .ea-paid span { color: var(--em); }
.ea-list { padding: 4px 0; }
.ea-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-bottom: 1px solid #F0ECE2; }
.ea-row:last-child { border-bottom: 0; }
.ea-ic { width: 44px; height: 44px; border-radius: 99px; background: var(--mint); color: var(--em); display: grid; place-items: center; flex: none; }
.ea-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ea-main b { font-size: 16px; }
.ea-main em { font-style: normal; color: var(--dim); font-size: 14px; }
.ea-main small { color: #7C8782; font-size: 12.5px; line-height: 1.5; margin-top: 4px; }
.ea-amt { display: flex; flex-direction: column; align-items: flex-end; text-align: right; flex: none; }
.ea-amt b { color: var(--em); font-size: 16px; }
.ea-amt b.neg { color: #B42318; }
.ea-amt em { font-style: normal; color: #8A928E; font-size: 12.5px; }
.ea-st { font-style: normal; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 99px; margin-top: 4px; }
.ea-st--pending { background: #FFF4E2; color: #9A5B00; } .ea-st--paid { background: var(--mint); color: var(--mintink); } .ea-st--off { background: #EEECE6; color: #6B6B6B; }
`;
