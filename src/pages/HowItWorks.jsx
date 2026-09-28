/**
 * How it works — the journey from "I need a place" to keys, told as a clock
 * and a scroll: one phone per moment, the app's own screens over real
 * inventory (home/homeScreens.jsx). Few words; the screens carry it.
 *
 * "Find my home" hands over to the homepage's one search flow (/?search=1):
 * it decides between the number, the AI broker and saved matches, so this page
 * never guesses.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Briefcase, Car, FileCheck2, Handshake, Home, IndianRupee, KeyRound, MoonStar, ShieldCheck, Wallet,
} from "lucide-react";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import { LandingStyles } from "./landing/landingKit";
import { Phone, SITE_CSS, SiteFooter, useScrollScene } from "./home/homeKit";
import {
  AgentScreen, MoveInScreen, RankedScreen, SearchScreen, SwipeScreen, VisitScreen, useShowcaseMatches,
} from "./home/homeScreens";

const CLOCK = [["2 min", "Tell us once"], ["6 hrs", "Curated list"], ["Day 1", "Visit & finalise"], ["≤ 7 days", "Move in"]];

const COMPARE = [
  ["Time spent searching", "3–6 weekends", "1 day"],
  ["Brokers chased", "20–50", "1 agent"],
  ["Homes visited", "30+", "Your top 5"],
  ["Time to move in", "~1 month", "≤ 7 days"],
];

const INCLUDED = [[BadgeCheck, "Verified homes"], [FileCheck2, "Agreement checked"], [ShieldCheck, "Deposit protected"], [Wallet, "Rent on auto-pay"]];

/** The visit day we're building: one car, every shortlisted flat, the deal, the drop. */
const RIDE = [
  [Home, "Pick-up", "From your door"],
  [KeyRound, "Flat 1", ""],
  [KeyRound, "Flat 2", ""],
  [KeyRound, "Flat 3", ""],
  [Handshake, "Deal closed", "On the spot"],
  [Briefcase, "Drop-off", "Home or office"],
];

function ComingSoon() {
  return (
    <section className="hw-soon">
      <div className="th-wrap">
        <span className="hw-soon-pill">Coming soon</span>
        <h2 className="th-h2">Renting, <span>chauffeured.</span></h2>

        <div className="hw-ride">
          <div className="hw-ride-head">
            <span className="ic"><Car size={26} /></span>
            <div><b>Visit day, in one car.</b><em>We pick you up, show you every flat, close the deal, and drop you home or at the office.</em></div>
          </div>
          <div className="hw-route" aria-hidden>
            <div className="hw-road"><span className="hw-car"><Car size={22} /></span></div>
            <ol>
              {RIDE.map(([I, t, sub], i) => (
                <li key={t} className={i === 0 || i === RIDE.length - 1 ? "end" : i === 4 ? "deal" : ""}>
                  <span className="pin"><I size={18} /></span>
                  <b>{t}</b>{sub && <em>{sub}</em>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="hw-soon-grid">
          <div className="hw-soon-card">
            <span className="ic"><MoonStar size={24} /></span>
            <b>Late-night visits</b>
            <em>On weekdays, after work — no half-days off.</em>
            <div className="hw-night" aria-hidden><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
          </div>
          <div className="hw-soon-card hw-soon-card--gold">
            <span className="ic"><IndianRupee size={24} /></span>
            <b><span className="big">₹0</span> security deposit</b>
            <em>Move in without locking up months of rent.</em>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The journey: vertical scroll drives a horizontal track of moments. */
function Journey({ stages }) {
  const ref = useRef(null);
  const track = useRef(null);
  const [active, setActive] = useState(0);
  useScrollScene(ref, (p) => {
    const t = track.current;
    if (t) {
      const max = Math.max(0, t.scrollWidth - t.parentElement.clientWidth);
      t.style.transform = `translate3d(${-p * max}px, 0, 0)`;
    }
    setActive((a) => { const n = Math.min(stages.length - 1, Math.round(p * (stages.length - 1))); return n === a ? a : n; });
  });
  return (
    <section ref={ref} className="hw-journey" style={{ height: `${stages.length * 60 + 60}vh` }}>
      <div className="th-sticky hw-journey-in">
        <div className="th-wrap hw-journey-head">
          <div><p className="th-kicker">The journey</p><h2 className="th-h2">One scroll. <span>One move.</span></h2></div>
          <div className="hw-dots" aria-hidden>{stages.map((s, i) => <span key={s.k} className={i <= active ? "on" : ""} />)}</div>
        </div>
        <div className="hw-rail">
          <div ref={track} className="hw-track">
            {stages.map((s, i) => (
              <article key={s.k} className={`hw-stage${i === active ? " on" : ""}`}>
                {s.screen ? <Phone className="th-phone--stage">{s.screen}</Phone> : (
                  <div className="hw-keys"><KeyRound size={64} strokeWidth={1.6} /></div>
                )}
                <div className="hw-stage-txt">
                  <span className="hw-time">{s.time}</span>
                  <b>{s.title}</b>
                  <em>{s.sub}</em>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HowItWorks() {
  const navigate = useNavigate();
  const find = () => navigate("/?search=1");
  const { user, loading } = useAuth();
  const { openLogin } = useLoginModal();
  const list = () => { if (loading) return; user ? navigate("/list-my-flat") : openLogin(() => navigate("/list-my-flat")); };
  const { matches, requirement } = useShowcaseMatches();

  const stages = [
    { k: "tell", time: "Minute 0", title: "Tell us once.", sub: "Area, budget, commute, move-in date.", screen: <AgentScreen /> },
    { k: "hunt", time: "Minute 2", title: "Our AI agents hunt.", sub: "WhatsApp groups, offline brokers, every platform.", screen: <SearchScreen requirement={requirement} /> },
    { k: "list", time: "Hour 6", title: "Your curated list.", sub: "Only homes that fit — ranked.", screen: <RankedScreen matches={matches} requirement={requirement} /> },
    { k: "swipe", time: "Hour 6", title: "Swipe to shortlist.", sub: "Right to keep, left to skip.", screen: <SwipeScreen matches={matches} /> },
    { k: "visit", time: "Day 1", title: "Visit in one tap.", sub: "Same-day slots. No calls.", screen: <VisitScreen listing={matches[1] || matches[0]} /> },
    { k: "done", time: "Day 1", title: "Finalised.", sub: "Agreement checked. Deposit protected.", screen: <MoveInScreen listing={matches[0]} /> },
    { k: "keys", time: "Within 7 days", title: "Welcome home.", sub: "Keys in hand." },
  ];

  return (
    <div className="lp lp--tenant th">
      <LandingStyles />
      <style>{SITE_CSS + CSS}</style>
      <MovEazyNav active="how" transparentAtTop onFindFlat={find} />

      <header className="hw-hero">
        <div className="th-wrap">
          <span className="hw-pill">How it works</span>
          <h1 className="hw-h1">From “I need a place”<br /><span>to keys in hand.</span></h1>
          <ol className="hw-clock">
            {CLOCK.map(([t, l], i) => (
              <li key={t} style={{ animationDelay: `${0.15 + i * 0.18}s` }}><b>{t}</b><span>{l}</span></li>
            ))}
          </ol>
          <button type="button" className="th-btn th-btn--mint" onClick={find}>Find my home <ArrowRight size={18} /></button>
        </div>
      </header>

      <Journey stages={stages} />

      <section className="hw-compare">
        <div className="th-wrap">
          <h2 className="th-h2">Same city.<br /><span>A different search.</span></h2>
          <div className="hw-table" role="table">
            <div className="hw-row hw-row--head" role="row"><span /><span>The old way</span><span>MovEazy</span></div>
            {COMPARE.map(([k, old, now]) => (
              <div key={k} className="hw-row" role="row"><span>{k}</span><s>{old}</s><b>{now}</b></div>
            ))}
          </div>
        </div>
      </section>

      <section className="hw-incl">
        <div className="th-wrap">
          <p className="th-kicker">Every move includes</p>
          <div className="hw-incl-grid">
            {INCLUDED.map(([I, t]) => <div key={t}><span className="ic"><I size={24} /></span><b>{t}</b></div>)}
          </div>
        </div>
      </section>

      <ComingSoon />

      <section className="hw-final">
        <div className="th-wrap">
          <h2>Ready when<br /><span>you are.</span></h2>
          <button type="button" className="th-btn th-btn--mint th-btn--lg" onClick={find}>Find my home <ArrowRight size={20} /></button>
        </div>
      </section>

      <SiteFooter onFind={find} onList={list} />
    </div>
  );
}

const CSS = `
.hw-hero { color: #F1F6F4; text-align: center; background: radial-gradient(90% 90% at 50% 0%, #0B463D 0%, #052723 50%, #04211D 100%); padding: 150px 0 110px; }
.hw-pill { display: inline-block; font-size: 13px; font-weight: 700; color: #5EEAD4; padding: 8px 14px; border-radius: 999px; background: rgba(94,234,212,.08); border: 1px solid rgba(94,234,212,.3); }
.hw-h1 { font-size: clamp(44px, 7vw, 96px); line-height: .98; letter-spacing: -.045em; font-weight: 800; margin: 24px 0 56px; color: #F1F6F4; }
.hw-h1 span { color: #5EEAD4; }
.hw-clock { list-style: none; margin: 0 auto 56px; padding: 0; max-width: 900px; display: grid; grid-template-columns: repeat(4, 1fr); position: relative; }
.hw-clock::before { content: ""; position: absolute; left: 12.5%; right: 12.5%; top: 11px; height: 2px; background: linear-gradient(90deg, #5EEAD4, #F5C451);
  transform-origin: 0 50%; animation: hwLine 1.2s .1s cubic-bezier(.16,1,.3,1) both; }
@keyframes hwLine { from { transform: scaleX(0); } }
.hw-clock li { position: relative; padding-top: 38px; opacity: 0; animation: hwPop .7s cubic-bezier(.16,1,.3,1) both; }
.hw-clock li::before { content: ""; position: absolute; top: 2px; left: 50%; width: 20px; height: 20px; margin-left: -10px; border-radius: 99px; background: #04211D;
  border: 2px solid #5EEAD4; box-shadow: 0 0 0 6px rgba(94,234,212,.12); }
.hw-clock li:last-child::before { border-color: #F5C451; box-shadow: 0 0 0 6px rgba(245,196,81,.14); }
.hw-clock b { display: block; font-size: clamp(24px, 3vw, 38px); letter-spacing: -.03em; }
.hw-clock li:last-child b { color: #F5C451; }
.hw-clock span { font-size: 14.5px; color: #A9C2BC; font-weight: 600; }
@keyframes hwPop { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

.hw-journey { background: var(--cream); }
.hw-journey-in { display: flex; flex-direction: column; justify-content: center; padding-top: 84px; padding-bottom: 20px; }
.hw-journey-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; width: 100%; }
.hw-journey-head .th-h2 { margin-bottom: 22px; font-size: clamp(34px, 4vw, 52px); }
.hw-journey-head .th-kicker { margin-bottom: 10px; }
.hw-dots { display: flex; gap: 6px; padding-bottom: 32px; }
.hw-dots span { width: 26px; height: 4px; border-radius: 99px; background: #D6DDDA; transition: background .3s; }
.hw-dots span.on { background: #0E7C68; }
.hw-rail { overflow: hidden; width: 100%; }
.hw-track { display: flex; gap: 36px; padding: 0 max(24px, calc((100vw - 1200px) / 2 + 24px)); will-change: transform; width: max-content; }
.hw-stage { flex: none; width: 230px; display: flex; flex-direction: column; gap: 14px; opacity: .45; transform: scale(.94); transition: opacity .4s, transform .5s cubic-bezier(.16,1,.3,1); }
.hw-stage.on { opacity: 1; transform: none; }
.th-phone--stage { --w: 230px; --h: 478px; --s: .5707; border-radius: 38px; padding: 8px; }
.th-phone--stage .th-scr { width: 214px; height: 462px; border-radius: 30px; }
.th-phone--stage::before { top: 14px; width: 66px; height: 18px; }
.hw-keys { width: 230px; height: 478px; border-radius: 40px; display: grid; place-items: center; color: #04211D;
  background: radial-gradient(circle at 50% 40%, #FFF3D1, #F5C451 70%); box-shadow: 0 40px 80px rgba(245,196,81,.35); }
.hw-time { display: inline-block; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #0E7C68; background: #E4F6F1; padding: 5px 10px; border-radius: 99px; }
.hw-stage:last-child .hw-time { background: #FFF3D1; color: #8A6419; }
.hw-stage-txt b { display: block; font-size: 20px; letter-spacing: -.02em; color: #04211D; margin-top: 8px; }
.hw-stage-txt em { display: block; font-style: normal; font-size: 14.5px; color: var(--dim); margin-top: 3px; }

.hw-compare { background: #fff; padding: 120px 0; }
.hw-table { max-width: 860px; }
.hw-row { display: grid; grid-template-columns: 1.3fr 1fr 1fr; align-items: baseline; gap: 16px; padding: 22px 0; border-bottom: 1px solid #E8EDEB; }
.hw-row > span:first-child { font-size: 16px; font-weight: 700; color: var(--dim); }
.hw-row s { font-size: clamp(22px, 2.6vw, 34px); font-weight: 800; color: #B5C2BE; letter-spacing: -.02em; }
.hw-row b { font-size: clamp(22px, 2.6vw, 34px); font-weight: 800; color: #0E7C68; letter-spacing: -.02em; }
.hw-row--head { padding: 0 0 14px; }
.hw-row--head span { font-size: 12.5px !important; font-weight: 800 !important; letter-spacing: .14em; text-transform: uppercase; color: #9DAAA6 !important; }
.hw-row--head span:last-child { color: #0E7C68 !important; }

.hw-incl { background: var(--cream); padding: 90px 0; }
.hw-incl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.hw-incl-grid > div { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 26px 22px; }
.hw-incl-grid .ic { width: 50px; height: 50px; border-radius: 15px; display: grid; place-items: center; background: #E4F6F1; color: #0E7C68; }
.hw-incl-grid b { display: block; margin-top: 18px; font-size: 19px; letter-spacing: -.02em; color: #04211D; }

.hw-soon { background: #04211D; color: #F1F6F4; padding: 120px 0; overflow: hidden;
  background-image: radial-gradient(70% 60% at 85% 0%, rgba(245,196,81,.12), transparent 60%), radial-gradient(60% 60% at 0% 100%, rgba(94,234,212,.1), transparent 60%); }
.hw-soon .th-h2 { color: #F1F6F4; margin-top: 18px; }
.hw-soon .th-h2 span { color: #F5C451; }
.hw-soon-pill { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  color: #F5C451; padding: 8px 14px; border-radius: 999px; background: rgba(245,196,81,.1); border: 1px solid rgba(245,196,81,.35); }
.hw-soon-pill::before { content: ""; width: 7px; height: 7px; border-radius: 99px; background: #F5C451; animation: thLive2 1.6s ease-out infinite; }
@keyframes thLive2 { 0% { box-shadow: 0 0 0 0 rgba(245,196,81,.6); } 100% { box-shadow: 0 0 0 9px rgba(245,196,81,0); } }
.hw-ride { border-radius: 28px; padding: 34px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); }
.hw-ride-head { display: flex; gap: 16px; align-items: flex-start; max-width: 720px; }
.hw-ride-head .ic, .hw-soon-card .ic { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; flex: none; background: rgba(94,234,212,.12); color: #5EEAD4; }
.hw-ride-head b, .hw-soon-card b { display: block; font-size: clamp(22px, 2.3vw, 28px); letter-spacing: -.025em; }
.hw-ride-head em, .hw-soon-card em { display: block; font-style: normal; font-size: 15.5px; line-height: 1.5; color: #A9C2BC; margin-top: 4px; }
.hw-route { position: relative; margin-top: 44px; }
.hw-road { position: absolute; left: calc(100% / 12); right: calc(100% / 12); top: 21px; height: 2px;
  background: repeating-linear-gradient(90deg, rgba(94,234,212,.55) 0 10px, transparent 10px 20px); }
.hw-car { position: absolute; z-index: 3; top: -17px; left: 0; width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center;
  background: #F5C451; color: #04211D; box-shadow: 0 10px 24px rgba(245,196,81,.4); animation: hwDrive 9s cubic-bezier(.45,0,.55,1) infinite; }
@keyframes hwDrive { 0% { left: 0; } 12%, 16% { left: 20%; } 28%, 32% { left: 40%; } 44%, 48% { left: 60%; } 62%, 70% { left: 80%; } 88%, 100% { left: calc(100% - 36px); } }
.hw-route ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, 1fr); position: relative; }
.hw-route li { text-align: center; }
.hw-route .pin { width: 44px; height: 44px; border-radius: 99px; margin: 0 auto 12px; display: grid; place-items: center; background: #062C26;
  border: 1.5px solid rgba(94,234,212,.5); color: #5EEAD4; position: relative; z-index: 1; }
.hw-route li.end .pin { background: #5EEAD4; color: #04211D; border-color: #5EEAD4; }
.hw-route li.deal .pin { background: #F5C451; color: #04211D; border-color: #F5C451; box-shadow: 0 0 0 8px rgba(245,196,81,.14); }
.hw-route b { display: block; font-size: 15px; letter-spacing: -.01em; }
.hw-route em { display: block; font-style: normal; font-size: 12.5px; color: #8FB0A9; margin-top: 2px; }
.hw-soon-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
.hw-soon-card { border-radius: 28px; padding: 30px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); display: flex; flex-direction: column; gap: 14px; }
.hw-soon-card b { margin-top: 4px; }
.hw-soon-card--gold { background: linear-gradient(145deg, rgba(245,196,81,.16), rgba(245,196,81,.04)); border-color: rgba(245,196,81,.3); }
.hw-soon-card--gold .ic { background: rgba(245,196,81,.16); color: #F5C451; }
.hw-soon-card .big { font-size: clamp(44px, 5vw, 64px); color: #F5C451; letter-spacing: -.04em; margin-right: 6px; }
.hw-night { display: flex; gap: 8px; margin-top: auto; }
.hw-night span { flex: 1; text-align: center; font-size: 12.5px; font-weight: 700; padding: 10px 0; border-radius: 12px; color: #CFE1DC;
  background: linear-gradient(180deg, #0B3B34, #062C26); border: 1px solid rgba(94,234,212,.18); position: relative; }
.hw-night span::after { content: "★"; display: block; font-size: 10px; color: #F5C451; margin-top: 2px; }

.hw-final { background: radial-gradient(80% 70% at 50% 10%, rgba(94,234,212,.16), transparent 60%), #04211D; color: #F1F6F4; text-align: center; padding: 130px 0; }
.hw-final h2 { font-size: clamp(46px, 8vw, 110px); line-height: .95; letter-spacing: -.045em; font-weight: 800; margin: 0 0 40px; color: #F1F6F4; }
.hw-final h2 span { color: #5EEAD4; }

@media (max-width: 900px) {
  .hw-hero { padding: 120px 0 80px; }
  .hw-clock { grid-template-columns: 1fr 1fr; row-gap: 30px; }
  .hw-clock::before { display: none; }
  .hw-journey-head .th-h2 { font-size: 30px; margin-bottom: 14px; }
  .hw-journey-in { padding-top: 72px; padding-bottom: 84px; }
  .th-phone--stage { --w: 200px; --h: 416px; --s: .4907; } .th-phone--stage .th-scr { width: 184px; height: 400px; }
  .hw-keys { width: 200px; height: 416px; } .hw-stage { width: 200px; gap: 10px; }
  .hw-stage-txt b { font-size: 18px; } .hw-stage-txt em { font-size: 13.5px; }
  .hw-dots { display: none; }
  .hw-track { gap: 22px; padding: 0 24px; }
  .hw-compare { padding: 80px 0; }
  .hw-row { grid-template-columns: 1fr 1fr; }
  .hw-row > span:first-child { grid-column: 1 / -1; font-size: 14px; }
  .hw-row--head > span:first-child { display: none; }
  .hw-incl-grid { grid-template-columns: 1fr 1fr; }
  .hw-soon { padding: 80px 0; }
  .hw-ride { padding: 24px 20px; }
  .hw-route { margin-top: 30px; }
  .hw-road { left: 21px; right: auto; top: 22px; bottom: 22px; width: 2px; height: auto;
    background: repeating-linear-gradient(180deg, rgba(94,234,212,.55) 0 10px, transparent 10px 20px); }
  .hw-car { display: none; }
  .hw-route ol { grid-template-columns: 1fr; gap: 16px; }
  .hw-route li { text-align: left; display: grid; grid-template-columns: 44px 1fr; column-gap: 14px; align-items: center; }
  .hw-route .pin { margin: 0; grid-row: span 2; }
  .hw-route em { margin-top: 0; }
  .hw-soon-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) { .th-btn { width: 100%; } .hw-incl-grid b { font-size: 16px; } }
@media (max-height: 760px) { .th-phone--stage { --w: 200px; --h: 416px; --s: .4907; } .th-phone--stage .th-scr { width: 184px; height: 400px; } .hw-keys { width: 200px; height: 416px; } .hw-stage { width: 200px; } }
@media (prefers-reduced-motion: reduce) { .hw-clock li, .hw-clock::before, .hw-car, .hw-soon-pill::before { animation: none; opacity: 1; } }
`;
