/**
 * moveazy.co.in/find — where "Find my home" lands (after the number): five ways
 * to find a flat.
 *
 *   1  Build my curated flat list — FREE (the AI chat → top matches, as before)
 *   2  Society map — coming soon, Notify me
 *   3  Steal Deals of the Week — this week's dates
 *   4  Deal of the Day — one per flat type, ends at midnight
 *   5  Bangalore Flat Renting Guide — coming soon, Notify me
 *
 * "Notify me" notes the interest on their CRM record (lead_types.sql); only
 * browsing keeps a lead Probable.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BellRing, BookOpen, Check, Flame, ListChecks, Map as MapIcon, Timer } from "lucide-react";
import { FindShell, useFindGate } from "./findKit";
import { DAY_KINDS, fetchDealsFeed, untilMidnightIst, weekLabel } from "../../lib/deals";
import { addLeadInterest } from "../../lib/leadIntake";

const SOON_KEY = "mz-notify-me";
const readSoon = () => { try { return JSON.parse(localStorage.getItem(SOON_KEY) || "[]"); } catch { return []; } };

function SoonCard({ id, icon: Icon, title, text }) {
  const [asked, setAsked] = useState(() => readSoon().includes(id));
  const [busy, setBusy] = useState(false);
  const notify = async () => {
    setBusy(true);
    await addLeadInterest(id);
    try { localStorage.setItem(SOON_KEY, JSON.stringify([...new Set([...readSoon(), id])])); } catch { /* not remembered */ }
    setAsked(true);
    setBusy(false);
  };
  return (
    <div className="fh-card fh-card--soon">
      <div className="fh-card-head"><span className="fh-ic fh-ic--soon"><Icon size={22} /></span><span className="fh-soon">Coming soon</span></div>
      <h2>{title}</h2>
      <p>{text}</p>
      {asked ? (
        <span className="fh-asked"><Check size={17} /> We&apos;ll tell you on WhatsApp when it&apos;s live</span>
      ) : (
        <button type="button" className="fh-cta fh-cta--soft" onClick={notify} disabled={busy}>
          <BellRing size={17} /> {busy ? "Saving…" : "Notify me"}
        </button>
      )}
    </div>
  );
}

export default function FindHub() {
  const navigate = useNavigate();
  const { allowed, gate } = useFindGate();
  const [feed, setFeed] = useState(null);
  const [left, setLeft] = useState(() => untilMidnightIst());
  useEffect(() => { fetchDealsFeed().then(setFeed, () => setFeed({ steal: [], day: [] })); }, []);
  useEffect(() => { const t = setInterval(() => setLeft(untilMidnightIst()), 30000); return () => clearInterval(t); }, []);

  const steal = feed?.steal ?? [];
  const live = steal.filter((d) => !d.rented).length;
  const dayKinds = DAY_KINDS.filter((k) => (feed?.day ?? []).some((d) => d.kind === k.id));
  const week = feed?.weekStart ? weekLabel(feed.weekStart, feed.weekEnd) : "";

  return (
    <FindShell kicker="Find my home" title="How would you like to find your flat?" sub="Pick a way to start. Every flat is checked by MovEazy, and visits are free.">
      {gate}
      {allowed && (
        <div className="fh-grid">
          <button type="button" className="fh-card fh-card--hero" onClick={() => navigate("/?curate=1")}>
            <span className="fh-free">FREE</span>
            <div className="fh-card-head"><span className="fh-ic fh-ic--hero"><ListChecks size={26} /></span></div>
            <h2>Build my curated flat list</h2>
            <p>Tell us what you need — we hand-pick your best matches.</p>
            <span className="fh-cta fh-cta--mint">Start — it&apos;s free <ArrowRight size={18} /></span>
          </button>

          <SoonCard id="society_map" icon={MapIcon} title="Society map"
            text="Every gated society around HSR and Sarjapur Road on one map — amenities, rents and real photos, side by side." />

          <button type="button" className="fh-card" onClick={() => navigate("/find/steal-deals")}>
            <div className="fh-card-head"><span className="fh-ic"><Flame size={22} /></span>{week && <span className="fh-tag">{week}</span>}</div>
            <h2>Steal Deals of the Week</h2>
            <p>{feed === null ? "Loading this week's picks…" : steal.length
              ? `${live} hand-picked flat${live === 1 ? "" : "s"} priced below what's around them.`
              : "This week's best-value flats drop soon."}</p>
            <span className="fh-cta">See the deals <ArrowRight size={17} /></span>
          </button>

          <button type="button" className="fh-card" onClick={() => navigate("/find/deal-of-the-day")}>
            <div className="fh-card-head"><span className="fh-ic"><Timer size={22} /></span><span className="fh-tag">Ends in {left}</span></div>
            <h2>Deal of the Day</h2>
            <p>{feed === null ? "Loading today's deals…" : dayKinds.length
              ? `Today's pick for ${dayKinds.map((k) => k.label).join(", ")}.`
              : "One standout flat for each type — every day."}</p>
            <span className="fh-cta">See today&apos;s deals <ArrowRight size={17} /></span>
          </button>

          <SoonCard id="renting_guide" icon={BookOpen} title="Bangalore Flat Renting Guide"
            text="Traffic choke points, what your budget gets you in each area, and everything a newcomer should know before renting in Bengaluru." />
        </div>
      )}
      <style>{HUB_CSS}</style>
    </FindShell>
  );
}

const HUB_CSS = `
.fh-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.fh-card { position: relative; text-align: left; font: inherit; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 26px;
  padding: 24px 24px 22px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; box-shadow: 0 10px 30px rgba(4,33,29,.06);
  transition: transform .15s ease, box-shadow .2s ease; overflow: hidden; }
.fh-card:hover { transform: translateY(-2px); box-shadow: 0 18px 40px rgba(4,33,29,.1); }
.fh-card h2 { margin: 6px 0 0; font-size: clamp(21px, 2vw, 26px); letter-spacing: -.02em; line-height: 1.15; font-weight: 800; }
.fh-card p { margin: 0; color: var(--dim); font-size: 15.5px; line-height: 1.5; }
.fh-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.fh-ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: #E4F6F1; color: #0E7C68; flex: none; }
.fh-tag { font-size: 13px; font-weight: 800; color: #0E5E50; background: #E4F6F1; padding: 6px 12px; border-radius: 999px; white-space: nowrap; }
.fh-cta { margin-top: auto; padding-top: 8px; display: inline-flex; align-items: center; gap: 8px; font-weight: 800; color: #0E7C68; font-size: 15.5px; }

.fh-card--hero { grid-column: 1 / -1; color: #F1F6F4; border: 0; padding: 32px 30px 28px;
  background: radial-gradient(80% 120% at 85% 10%, #0E5E50 0%, #063A33 45%, #04211D 100%); box-shadow: 0 22px 50px rgba(4,33,29,.28); }
.fh-card--hero h2 { font-size: clamp(26px, 3.2vw, 38px); color: #fff; }
.fh-card--hero p { color: #BFD6D0; font-size: 17px; max-width: 520px; }
.fh-ic--hero { background: rgba(94,234,212,.14); color: #5EEAD4; width: 54px; height: 54px; border-radius: 16px; }
.fh-free { position: absolute; top: 22px; right: -42px; transform: rotate(35deg); background: #FACC15; color: #1A1500; font-weight: 900; font-size: 15px;
  letter-spacing: .14em; padding: 8px 56px; box-shadow: 0 6px 16px rgba(0,0,0,.25); }
.fh-cta--mint { align-self: flex-start; background: #5EEAD4; color: #04211D; border-radius: 999px; padding: 14px 24px; margin-top: 10px; font-size: 16.5px;
  box-shadow: 0 14px 34px rgba(94,234,212,.3); }

.fh-card--soon { cursor: default; background: #FBFAF6; }
.fh-card--soon:hover { transform: none; box-shadow: 0 10px 30px rgba(4,33,29,.06); }
.fh-ic--soon { background: #F1ECE2; color: #8A6A2A; }
.fh-soon { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #8A6A2A; background: #F6EBD3; padding: 6px 11px; border-radius: 999px; }
.fh-cta--soft { align-self: flex-start; border: 1.5px solid #04211D; background: #fff; color: #04211D; border-radius: 999px; padding: 11px 18px; cursor: pointer; font: inherit; font-weight: 800; }
.fh-cta--soft:disabled { opacity: .6; }
.fh-asked { margin-top: auto; padding-top: 8px; display: inline-flex; align-items: center; gap: 7px; font-weight: 800; color: #0E7C68; font-size: 14.5px; }

@media (max-width: 760px) {
  .fh-grid { grid-template-columns: 1fr; }
  .fh-card--hero { padding: 26px 22px 24px; }
}
`;
