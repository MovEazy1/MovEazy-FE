/**
 * Pieces the tenant home and the tenant profile flow share: the score ring,
 * the tenant card, and the styles (scoped under .tn, tenant brand — teal,
 * mint, Manrope — mobile first).
 */
import { BadgeCheck, Briefcase, CalendarDays, GraduationCap, Heart, History, Link2, Star } from "lucide-react";
import { isFilled, pastCompanyLabel, pointsOf, profileScore, scoreLabel, statusLabel } from "../../lib/tenantProfile";
import logoOnLight from "../../assets/logo/moveazy-logo-mint-light.png";

export const TN = { ink: "#04211D", deep: "#02140E", teal: "#0E7C68", mint: "#5EEAD4", wash: "#E4F6F1", gold: "#F5C451", cream: "#F4F2ED" };

/**
 * A ring that fills to the score; the number and label sit inside.
 * One colour whatever the score — 90 and 100 look the same, only the number
 * and the word change — and from 90 a small star sits on it: the profile is
 * done. tone: "light" (white ground), "dark", or "gold" (the tenant card).
 */
export function ScoreRing({ score, size = 76, stroke = 7, tone = "light", label = true }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [track, fill] = tone === "gold" ? ["rgba(4,33,29,.14)", TN.ink] : tone === "dark" ? ["rgba(255,255,255,.12)", TN.mint] : ["#E3EAE8", TN.teal];
  const star = Math.max(16, Math.round(size * 0.34));
  return (
    <div className={`tn-ring tn-ring--${tone}`} style={{ width: size, height: size }} aria-label={`Profile score ${score} of 100${score >= 90 ? `, ${scoreLabel(score)}` : ""}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fill} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)", transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
      </svg>
      <div className="tn-ring-in">
        <b style={{ fontSize: size * 0.3 }}>{score}</b>
        {label && size >= 60 && <span style={score >= 90 ? { fontSize: size < 72 ? 7 : 7.5, letterSpacing: ".01em" } : undefined}>{score >= 90 ? scoreLabel(score) : "of 100"}</span>}
      </div>
      {score >= 90 && (
        <span className="tn-star" aria-hidden style={{ width: star, height: star }}>
          <Star size={Math.round(star * 0.6)} fill="currentColor" strokeWidth={0} />
        </span>
      )}
    </div>
  );
}

const yy = (y) => (/^\d{4}$/.test(String(y)) ? `’${String(y).slice(2)}` : "");

/** What the card shows for each part of the profile, and what an empty part is worth. */
const CARD_ROWS = [
  { id: "currentCompany", icon: Briefcase, keys: ["currentCompany"], text: (p) => p.currentCompany, add: "Current company" },
  { id: "pastCompany", icon: History, keys: ["pastCompany"], text: (p) => `Before: ${pastCompanyLabel(p.pastCompany)}`, add: "Past company" },
  { id: "education", icon: GraduationCap, keys: ["college", "graduationYear"], text: (p) => `${p.college} ${yy(p.graduationYear)}`.trim(), add: "College & year" },
  { id: "inBangaloreSince", icon: CalendarDays, keys: ["inBangaloreSince"], text: (p) => (/^\d{4}$/.test(p.inBangaloreSince) ? `Since ${p.inBangaloreSince}` : p.inBangaloreSince), add: "In Bangalore since" },
  { id: "maritalStatus", icon: Heart, keys: ["maritalStatus"], text: (p) => statusLabel(p.maritalStatus), add: "Married / single" },
  { id: "linkedin", icon: Link2, keys: ["linkedin"], text: () => "LinkedIn", add: "LinkedIn" },
];

/** Fixed positions, so the glitter doesn't jump between renders. */
const SPARKLES = [[8, 18, 0], [22, 70, 1.1], [38, 30, 2.3], [55, 82, .6], [68, 14, 1.7], [82, 58, 2.8], [92, 26, .3], [47, 55, 3.4], [15, 88, 2]];
const Glitter = () => (
  <span className="tn-glitter" aria-hidden>{SPARKLES.map(([x, y, d], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />)}</span>
);

/**
 * The tenant card — always gold, always on top, at every stage of the
 * profile. Below 90 it's the full card: filled parts as details, missing ones
 * as "add" pills worth their points. From 90 (Excellent / Outstanding) the
 * job is done, so it folds into a small card with a star on the score.
 * onEdit opens the profile flow.
 */
export function TenantCard({ profile, onEdit }) {
  const { score, complete } = profileScore(profile);

  if (score >= 90) {
    const line = [profile.currentCompany, `${profile.college || ""} ${yy(profile.graduationYear)}`.trim(), statusLabel(profile.maritalStatus)].filter(Boolean);
    return (
      <div className="tn-card small">
        <Glitter />
        <div className="tn-sm">
          <div className="tn-sm-main">
            <div className="tn-sm-top">
              <img src={logoOnLight} alt="MovEazy" className="tn-card-logo" height="18" />
              <span className="tn-card-tag"><BadgeCheck size={12} /> {scoreLabel(score)} tenant</span>
            </div>
            <div className="tn-card-name">{profile.name || "Your name"}</div>
            <div className="tn-sm-line">{line.join(" · ")}</div>
          </div>
          <div className="tn-sm-side">
            <ScoreRing score={score} size={64} stroke={6} tone="gold" />
            {onEdit && <button type="button" className="tn-sm-edit" onClick={onEdit}>Edit</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tn-card">
      <Glitter />
      <div className="tn-card-top">
        <img src={logoOnLight} alt="MovEazy" className="tn-card-logo" height="22" />
        <span className="tn-card-tag"><BadgeCheck size={13} /> MovEazy tenant</span>
      </div>
      <div className="tn-card-mid">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tn-card-name">{profile.name || "Your name"}</div>
          {!complete && <p className="tn-card-why">A good profile increases your chance of getting the flat you want.</p>}
        </div>
        <ScoreRing score={score} size={78} tone="gold" />
      </div>
      <div className="tn-card-rows">
        {CARD_ROWS.map((row) => {
          const I = row.icon;
          const done = row.keys.every((k) => isFilled(profile, k));
          const worth = row.keys.filter((k) => !isFilled(profile, k)).reduce((n, k) => n + pointsOf(k), 0);
          return done
            ? <span key={row.id} className="row" title={row.text(profile)}><I size={13} /> <span className="v">{row.text(profile)}</span></span>
            : <button key={row.id} type="button" className="add" onClick={onEdit}><I size={13} /> {row.add}<em>+{worth}</em></button>;
        })}
      </div>
      {onEdit && (
        <button type="button" className={`tn-card-cta${complete ? " done" : ""}`} onClick={onEdit}>
          {complete ? "Edit profile" : score > 20 ? "Continue your profile" : "Complete your profile"}
        </button>
      )}
    </div>
  );
}

export const TN_CSS = `
.tn { --ink:#04211D; --deep:#02140E; --teal:#0E7C68; --mint:#5EEAD4; --wash:#E4F6F1; --gold:#F5C451; --cream:#F4F2ED; --line:#E4E1D8; --dim:#5C6B67;
  font-family: 'Manrope', Inter, system-ui, sans-serif; color: #0B1A17; background: var(--cream); min-height: 100vh; overflow-x: clip; -webkit-font-smoothing: antialiased; }
.tn *, .tn *::before, .tn *::after { box-sizing: border-box; }
.tn h1, .tn h2, .tn h3 { color: inherit; margin: 0; }
.tn-col { max-width: 560px; margin: 0 auto; padding: 0 18px; }
.tn-kicker { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: var(--teal); margin: 0 0 10px; }

/* score ring */
.tn-ring { position: relative; flex: none; }
.tn-ring svg { display: block; }
.tn-ring-in { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; text-align: center; line-height: 1; }
.tn-ring-in b { font-weight: 800; letter-spacing: -.03em; }
.tn-ring-in span { font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; opacity: .75; margin-top: 3px; }
/* the accomplishment star, from 90 */
.tn-star { position: absolute; top: -3px; right: -4px; border-radius: 99px; display: grid; place-items: center; color: #7A5200;
  background: radial-gradient(circle at 35% 30%, #FFF6D6, #F5C451 55%, #D9A437); box-shadow: 0 0 0 2px #fff, 0 4px 10px rgba(185,140,30,.45);
  animation: tnStarPop .6s cubic-bezier(.34,1.56,.64,1), tnStarGlow 2.4s ease-in-out .6s infinite; }
.tn-ring--gold .tn-star { color: #F5C451; background: radial-gradient(circle at 35% 30%, #0E4B42, #04211D 70%); box-shadow: 0 0 0 2px #F9DD8E, 0 4px 10px rgba(4,33,29,.35); }
.tn-ring--dark .tn-star { box-shadow: 0 0 0 2px #04211D, 0 4px 10px rgba(0,0,0,.4); }
@keyframes tnStarPop { from { transform: scale(0) rotate(-40deg); } to { transform: scale(1) rotate(0); } }
@keyframes tnStarGlow { 0%, 100% { filter: drop-shadow(0 0 0 rgba(245,196,81,0)); } 50% { filter: drop-shadow(0 0 6px rgba(245,196,81,.9)); } }

/* tenant card — gold, glittering */
.tn-card { position: relative; border-radius: 24px; padding: 18px 18px 16px; color: #1F1605; overflow: hidden; isolation: isolate;
  background: linear-gradient(135deg, #FFF1C2 0%, #F7D57A 28%, #E9B949 52%, #F9DD8E 74%, #D9A437 100%);
  box-shadow: 0 24px 50px rgba(185,140,30,.35), inset 0 0 0 1px rgba(255,255,255,.55), inset 0 -18px 40px rgba(160,110,10,.18); }
.tn-card::before { content: ""; position: absolute; inset: -40% -60%; z-index: -1; pointer-events: none;
  background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.75) 48%, rgba(255,255,255,.15) 54%, transparent 62%);
  animation: tnSheen 4.8s cubic-bezier(.45,0,.55,1) infinite; }
@keyframes tnSheen { 0% { transform: translateX(-45%); } 55%, 100% { transform: translateX(45%); } }
.tn-card::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .5; mix-blend-mode: soft-light;
  background-image: radial-gradient(rgba(255,255,255,.9) .6px, transparent 1px), radial-gradient(rgba(120,80,0,.5) .6px, transparent 1px);
  background-size: 7px 7px, 11px 11px; background-position: 0 0, 3px 5px; }
.tn-glitter { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.tn-glitter i { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; opacity: 0;
  background: radial-gradient(circle, #fff 0 18%, transparent 20%), conic-gradient(from 0deg, transparent 0 10%, #fff 12%, transparent 14% 35%, #fff 37%, transparent 39% 60%, #fff 62%, transparent 64% 85%, #fff 87%, transparent 89%);
  border-radius: 99px; filter: drop-shadow(0 0 3px rgba(255,255,255,.9)); animation: tnTwinkle 3.6s ease-in-out infinite; }
@keyframes tnTwinkle { 0%, 100% { opacity: 0; transform: scale(.3) rotate(0deg); } 12% { opacity: 1; transform: scale(1) rotate(45deg); } 24% { opacity: 0; transform: scale(.4) rotate(90deg); } }
.tn-card > *:not(.tn-glitter) { position: relative; z-index: 1; }
.tn-card-top { display: flex; justify-content: space-between; align-items: center; }
.tn .tn-card-logo { height: 22px; width: auto; }
.tn-card-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; color: #F5C451; background: #04211D; padding: 5px 9px; border-radius: 99px; white-space: nowrap; }
.tn-card-mid { display: flex; gap: 14px; align-items: center; margin-top: 14px; }
.tn-card-name { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: #04211D; }
.tn-card-why { margin: 4px 0 0; font-size: 13px; line-height: 1.4; color: #5A430E; }
.tn-card-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 14px; }
.tn-card-rows .row svg, .tn-card-rows .add svg { flex: none; }
.tn-card-rows .row .v { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.tn-card-rows .row { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #3A2A06; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.4); }
.tn-card-rows .add { display: flex; align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 700; color: #5A430E; cursor: pointer; text-align: left;
  padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.18); border: 1.5px dashed rgba(90,67,14,.45); min-width: 0; }
.tn-card-rows .add em { margin-left: auto; font-style: normal; font-size: 11.5px; font-weight: 800; color: #04211D; }
.tn-card-cta { width: 100%; margin-top: 14px; min-height: 48px; border: 0; border-radius: 14px; font: inherit; font-size: 15px; font-weight: 800; cursor: pointer;
  background: #04211D; color: #F5C451; box-shadow: 0 10px 22px rgba(4,33,29,.25); }
.tn-card-cta.done { background: rgba(255,255,255,.45); color: #04211D; box-shadow: none; border: 1px solid rgba(90,67,14,.25); min-height: 42px; }
.tn-ring--gold .tn-ring-in { color: #04211D; }

/* the small card, from 90 */
.tn-card.small { padding: 14px 14px 14px 16px; border-radius: 20px; }
.tn-sm { display: flex; gap: 12px; align-items: center; }
.tn-sm-main { flex: 1; min-width: 0; }
.tn-sm-top { display: flex; align-items: center; gap: 8px; }
.tn-card.small .tn-card-logo { height: 18px; }
.tn-card.small .tn-card-tag { font-size: 10.5px; padding: 4px 8px; }
.tn-card.small .tn-card-name { font-size: 19px; margin-top: 8px; }
.tn-sm-line { font-size: 12.5px; font-weight: 700; color: #5A430E; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tn-sm-side { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.tn-sm-edit { font: inherit; font-size: 12px; font-weight: 800; color: #04211D; background: rgba(255,255,255,.45); border: 1px solid rgba(90,67,14,.25);
  border-radius: 99px; padding: 4px 12px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .tn-card::before, .tn-glitter i, .tn-star { animation: none; } }

/* buttons */
.tn-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 16px; font: inherit; font-weight: 800; font-size: 16px;
  min-height: 54px; padding: 0 22px; cursor: pointer; text-decoration: none; transition: transform .12s ease, opacity .2s; }
.tn-btn:active { transform: translateY(1px); }
.tn-btn:disabled { opacity: .4; cursor: default; }
.tn-btn--ink { background: var(--ink); color: #fff; }
.tn-btn--mint { background: var(--mint); color: var(--ink); }
.tn-btn--ghost { background: transparent; color: var(--ink); border: 1.5px solid var(--line); }
.tn-btn--block { width: 100%; }
`;
