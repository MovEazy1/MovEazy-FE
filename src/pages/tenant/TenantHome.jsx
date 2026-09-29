/**
 * The tenant home — what "/" becomes once a tenant has signed up. Mobile first.
 *
 *   1. The tenant card, gold at every stage: filled fields as details,
 *      missing ones as "add" pills worth their points, the score alongside.
 *   2. Three actions: Find my flat · List my flat (earn ₹5,000 when you vacate)
 *      · Complete / view profile. Find and List keep their existing flows —
 *      the page is handed onFind / onList by whoever mounts it.
 *   3. How MovEazy works: a side slider of the app's own screens, from "tell
 *      us once" and the AI agents hunting the web to move-in.
 *   4. The future we're building: the offline city mapped digitally, and a
 *      taste that sharpens with every flat — until we help you buy.
 */
import {
  ChevronRight, Droplets, Home, KeyRound, MapPin, Search, ShieldCheck, Sparkles, TrainFront, TrendingUp,
} from "lucide-react";
import { Phone, SITE_CSS } from "../home/homeKit";
import { AgentScreen, MoveInScreen, RankedScreen, SearchScreen, SwipeScreen, VisitScreen, useShowcaseMatches } from "../home/homeScreens";
import { profileScore, scoreLabel } from "../../lib/tenantProfile";
import { ScoreRing, TN_CSS, TenantCard } from "./tenantUi";


function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const HOW = [
  { k: "tell", n: "Tell us once", s: "Two minutes with your AI broker.", screen: () => <AgentScreen /> },
  { k: "hunt", n: "AI agents surf the web", s: "WhatsApp groups, offline brokers, every platform.", screen: (m, r) => <SearchScreen requirement={r} /> },
  { k: "list", n: "Curated in 6 hours", s: "Only homes that fit you, ranked.", screen: (m, r) => <RankedScreen matches={m} requirement={r} /> },
  { k: "swipe", n: "Swipe to shortlist", s: "Right to keep, left to skip.", screen: (m) => <SwipeScreen matches={m} /> },
  { k: "visit", n: "Visit in one tap", s: "Same-day slots, no calls.", screen: (m) => <VisitScreen listing={m[1] || m[0]} /> },
  { k: "move", n: "Move in", s: "Finalised in a day.", screen: (m) => <MoveInScreen listing={m[0]} /> },
];

/** The city, digitised: an illustrative map with one locality opened up. */
function CityMap() {
  return (
    <div className="tn-map" aria-hidden>
      <svg viewBox="0 0 340 250" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="tnLake" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#1B6E77" /><stop offset="100%" stopColor="#0E4750" /></radialGradient>
        </defs>
        <rect width="340" height="250" fill="#062C26" />
        <g stroke="#0E4B42" strokeWidth="1">
          {Array.from({ length: 12 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 22} L340 ${i * 22 - 18}`} />)}
          {Array.from({ length: 16 }, (_, i) => <path key={`v${i}`} d={`M${i * 23} 0 L${i * 23 - 26} 250`} />)}
        </g>
        <path d="M-10 170 C60 150 110 120 170 128 S270 90 350 70" stroke="#2A6F62" strokeWidth="7" fill="none" />
        <path d="M-10 170 C60 150 110 120 170 128 S270 90 350 70" stroke="#5EEAD4" strokeWidth="1.2" strokeDasharray="4 6" fill="none" opacity=".6" />
        <path d="M120 -10 C130 60 150 110 150 250" stroke="#2A6F62" strokeWidth="5" fill="none" />
        <ellipse cx="258" cy="168" rx="46" ry="24" fill="url(#tnLake)" />
        {[[70, 70, "Koramangala"], [215, 200, "Bellandur"], [285, 50, "Whitefield"], [60, 205, "BTM"]].map(([x, y, t]) => (
          <g key={t}>
            <circle cx={x} cy={y} r="4" fill="#5EEAD4" opacity=".55" />
            <text x={x + 8} y={y + 4} fill="#8FB0A9" fontSize="10" fontFamily="Manrope, sans-serif" fontWeight="700">{t}</text>
          </g>
        ))}
        <circle cx="168" cy="96" r="30" fill="rgba(94,234,212,.12)" stroke="#5EEAD4" strokeWidth="1.5" />
        <circle cx="168" cy="96" r="5" fill="#5EEAD4" />
        <text x="146" y="138" fill="#F1F6F4" fontSize="11" fontFamily="Manrope, sans-serif" fontWeight="800">HSR Layout</text>
      </svg>
      <div className="tn-map-card">
        <div className="tn-map-card-h"><MapPin size={14} /> HSR Layout <span>Locality check</span></div>
        {[[TrainFront, "Commute", 0.82], [Droplets, "Water supply", 0.7], [ShieldCheck, "Safety", 0.88], [TrendingUp, "Rent trend", 0.55]].map(([I, t, v]) => (
          <div key={t} className="tn-map-row">
            <I size={13} /><span>{t}</span><i><em style={{ width: `${v * 100}%` }} /></i>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Every flat teaches us more — until we can help you buy. */
function TasteJourney() {
  const stops = [
    ["Your first flat", "We learn the basics", 0.2],
    ["After 5 flats", "We know your taste", 0.55],
    ["Every move", "We know you", 0.85],
    ["Your own home", "We help you buy it", 1],
  ];
  return (
    <ol className="tn-taste">
      {stops.map(([h, s, v], i) => (
        <li key={h} className={i === stops.length - 1 ? "own" : ""}>
          <span className="node">{i === stops.length - 1 ? <KeyRound size={15} /> : i + 1}</span>
          <div className="txt"><b>{h}</b><em>{s}</em></div>
          <div className="meter"><i style={{ width: `${v * 100}%` }} /></div>
        </li>
      ))}
    </ol>
  );
}

/** underNav: mounted under the site nav, which already leaves room for itself. */
export default function TenantHome({ name = "", profile = {}, onFind, onList, onProfile, underNav = false }) {
  const { score, complete } = profileScore(profile);
  const { matches, requirement } = useShowcaseMatches();
  const first = (profile.name || name || "there").split(" ")[0];

  return (
    <div className={`tn${underNav ? " tn--undernav" : ""}`}>
      <style>{SITE_CSS + TN_CSS + CSS}</style>

      <header className="tn-head">
        <div className="tn-col">
          <p className="tn-hello">{greeting()},</p>
          <h1 className="tn-name">{first}</h1>
          <div className="tn-profile">
            <TenantCard profile={profile} onEdit={onProfile} />
          </div>
        </div>
      </header>

      <section className="tn-col tn-actions">
        <button type="button" className="tn-act tn-act--find" onClick={onFind}>
          <span className="ic"><Search size={22} /></span>
          <span className="t"><b>Find my flat</b><em>AI-matched homes in 6 hours</em></span>
          <ChevronRight size={22} />
        </button>
        <div className="tn-act-row">
          <button type="button" className="tn-act tn-act--list" onClick={onList}>
            <span className="tn-badge">Earn ₹5,000</span>
            <span className="ic"><Home size={20} /></span>
            <b>List my flat</b><em>When you vacate</em>
          </button>
          <button type="button" className="tn-act tn-act--profile" onClick={onProfile}>
            <ScoreRing score={score} size={46} stroke={5} label={false} />
            <b>{complete ? "My profile" : "Complete profile"}</b>
            <em>{complete ? `${scoreLabel(score)} · ${score}` : `${Math.max(0, 90 - score)} points to Excellent`}</em>
          </button>
        </div>
      </section>

      <section className="tn-how">
        <div className="tn-col">
          <p className="tn-kicker">How MovEazy works</p>
          <h2 className="tn-h2">From “I need a place” to keys.</h2>
        </div>
        <div className="tn-slider" role="list">
          {HOW.map((st, i) => (
            <figure key={st.k} className="tn-slide" role="listitem">
              <Phone className="th-phone--slide">{st.screen(matches, requirement)}</Phone>
              <figcaption><span>{i + 1}</span><b>{st.n}</b><em>{st.s}</em></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="tn-future">
        <div className="tn-col">
          <p className="tn-kicker tn-kicker--mint">The future we’re building</p>
          <h2 className="tn-h2">Renting, <span>reimagined.</span></h2>

          <article className="tn-fut">
            <span className="tn-soon">Coming soon</span>
            <h3>Your city, mapped.</h3>
            <p>The offline city, digitised — check any locality before you step out.</p>
            <CityMap />
          </article>

          <article className="tn-fut">
            <span className="tn-soon">Our vision</span>
            <h3>We learn you, flat by flat.</h3>
            <p>Every home you like or skip sharpens our understanding — until we help you buy your first perfect home.</p>
            <TasteJourney />
          </article>
        </div>
      </section>

      <div className="tn-foot tn-col"><Sparkles size={14} /> India’s first Speed-Renting Platform</div>
    </div>
  );
}

const CSS = `
.tn--undernav .tn-head { padding-top: 18px !important; }
.tn-head { padding: 96px 0 8px; background: radial-gradient(90% 60% at 100% 0%, rgba(94,234,212,.22), transparent 60%), var(--cream); }
.tn-hello { margin: 0; font-size: 15px; color: var(--dim); font-weight: 600; }
.tn-name { font-size: 34px; font-weight: 800; letter-spacing: -.035em; margin: 2px 0 18px; }
.tn-profile { position: relative; }

.tn-actions { padding-top: 16px; display: grid; gap: 12px; }
.tn-act { font: inherit; text-align: left; cursor: pointer; border-radius: 22px; border: 1px solid var(--line); background: #fff; color: inherit; transition: transform .12s ease; }
.tn-act:active { transform: scale(.99); }
.tn-act--find { display: flex; align-items: center; gap: 14px; padding: 18px; border: 0; color: #fff;
  background: radial-gradient(120% 140% at 100% 0%, #0E4B42 0%, #04211D 70%); box-shadow: 0 18px 40px rgba(4,33,29,.25); }
.tn-act--find .ic { width: 50px; height: 50px; border-radius: 16px; display: grid; place-items: center; background: var(--mint); color: var(--ink); flex: none; }
.tn-act--find .t { flex: 1; }
.tn-act b { display: block; font-size: 18px; letter-spacing: -.02em; }
.tn-act em { display: block; font-style: normal; font-size: 13px; opacity: .72; margin-top: 2px; }
.tn-act-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tn-act--list, .tn-act--profile { position: relative; padding: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-height: 150px; }
.tn-act--list .ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: #FFF3D1; color: #8A6419; }
.tn-act--list b, .tn-act--profile b { font-size: 16.5px; margin-top: auto; }
.tn-act--list em, .tn-act--profile em { margin-top: -8px; color: var(--dim); opacity: 1; }
.tn-badge { position: absolute; top: 12px; right: 12px; font-size: 11px; font-weight: 800; color: #6B4A06; background: linear-gradient(180deg, #FCDC85, var(--gold));
  padding: 4px 8px; border-radius: 99px; box-shadow: 0 6px 14px rgba(245,196,81,.35); }

.tn-h2 { font-size: 28px; line-height: 1.08; letter-spacing: -.035em; font-weight: 800; margin: 0 0 18px; }
.tn-h2 span { color: var(--mint); }
.tn-how { padding: 44px 0 10px; }
.tn-slider { display: flex; gap: 16px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 6px max(18px, calc((100vw - 560px) / 2 + 18px)) 24px; scrollbar-width: none; }
.tn-slider::-webkit-scrollbar { display: none; }
.tn-slide { flex: none; width: 200px; margin: 0; scroll-snap-align: start; }
.th-phone--slide { --w: 200px; --h: 416px; --s: .4907; border-radius: 34px; padding: 8px; box-shadow: 0 22px 40px rgba(4,33,29,.18), inset 0 0 0 2px #2A2F2D; }
.th-phone--slide .th-scr { width: 184px; height: 400px; border-radius: 27px; }
.th-phone--slide::before { top: 13px; width: 56px; height: 15px; }
.tn-slide figcaption { margin-top: 12px; }
.tn-slide figcaption span { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 99px; background: var(--ink); color: var(--mint); font-size: 12px; font-weight: 800; }
.tn-slide figcaption b { display: block; font-size: 16px; letter-spacing: -.015em; margin-top: 8px; }
.tn-slide figcaption em { display: block; font-style: normal; font-size: 13px; color: var(--dim); margin-top: 2px; line-height: 1.4; }

.tn-future { margin-top: 30px; padding: 46px 0 40px; background: #04211D; color: #F1F6F4; border-radius: 32px 32px 0 0; }
.tn-kicker--mint { color: var(--mint); }
.tn-fut { position: relative; border-radius: 26px; padding: 20px; margin-top: 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); overflow: hidden; }
.tn-fut h3 { font-size: 21px; letter-spacing: -.02em; margin-top: 12px; }
.tn-fut > p { margin: 6px 0 16px; font-size: 14px; line-height: 1.5; color: #A9C2BC; }
.tn-soon { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--gold); background: rgba(245,196,81,.1);
  border: 1px solid rgba(245,196,81,.3); padding: 5px 10px; border-radius: 99px; }

.tn-map { position: relative; border-radius: 18px; overflow: hidden; height: 250px; }
.tn-map > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.tn-map-card { position: absolute; right: 10px; bottom: 10px; width: 176px; background: rgba(255,255,255,.96); color: #0B1A17; border-radius: 16px; padding: 12px;
  box-shadow: 0 16px 34px rgba(0,0,0,.35); }
.tn-map-card-h { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 800; margin-bottom: 8px; }
.tn-map-card-h span { margin-left: auto; font-size: 9.5px; font-weight: 800; color: var(--teal); text-transform: uppercase; letter-spacing: .06em; }
.tn-map-row { display: grid; grid-template-columns: 14px 1fr 54px; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: #3D4B47; padding: 3px 0; }
.tn-map-row i { height: 5px; border-radius: 99px; background: #E3EAE8; overflow: hidden; }
.tn-map-row em { display: block; height: 100%; background: var(--teal); border-radius: 99px; }

.tn-taste { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.tn-taste li { display: grid; grid-template-columns: 34px 1fr; grid-template-rows: auto auto; column-gap: 12px; row-gap: 8px; align-items: center;
  padding: 12px; border-radius: 16px; background: rgba(255,255,255,.04); }
.tn-taste .node { grid-row: span 2; width: 34px; height: 34px; border-radius: 99px; display: grid; place-items: center; font-weight: 800; font-size: 13px;
  border: 1.5px solid rgba(94,234,212,.45); color: var(--mint); }
.tn-taste b { display: block; font-size: 15px; }
.tn-taste em { display: block; font-style: normal; font-size: 12.5px; color: #8FB0A9; }
.tn-taste .meter { height: 6px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
.tn-taste .meter i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #0E7C68, var(--mint)); }
.tn-taste li.own { background: linear-gradient(135deg, rgba(245,196,81,.16), rgba(245,196,81,.04)); border: 1px solid rgba(245,196,81,.3); }
.tn-taste li.own .node { background: var(--gold); border-color: var(--gold); color: #04211D; }
.tn-taste li.own b { color: var(--gold); }
.tn-taste li.own .meter i { background: linear-gradient(90deg, var(--mint), var(--gold)); }
.tn-foot { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 26px 18px 110px; background: #04211D; color: #6F8F88; font-size: 12.5px; font-weight: 700; max-width: none; }

@media (min-width: 900px) {
  .tn-col { max-width: 720px; }
  .tn-head { padding-top: 120px; }
  .tn-name { font-size: 44px; }
  .tn-act-row { grid-template-columns: 1fr 1fr; }
  .tn-h2 { font-size: 38px; }
  .tn-slider { padding-left: max(18px, calc((100vw - 720px) / 2 + 18px)); }
  .tn-future { border-radius: 40px 40px 0 0; }
}
`;
