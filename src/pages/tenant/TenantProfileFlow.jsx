/**
 * Create / complete the tenant profile — one screen at a time, sliding in,
 * mobile first, the score moving as the tenant answers. Name and mobile come
 * from sign-up; asked here: LinkedIn, current company, past company, college
 * and graduation year, in Bangalore since, and married / single. Everything
 * in: Excellent (90); everything in as a family: Outstanding (100). See
 * lib/tenantProfile.js.
 *
 * LinkedIn: the tenant pastes their profile link. "Continue with LinkedIn"
 * (shown only when onLinkedIn is given — Sign in with LinkedIn isn't set up
 * yet) can only ever fill name, email and photo — LinkedIn does not hand work
 * history or education to apps outside its partner program — so the
 * questions after it stay.
 */
import { useMemo, useState } from "react";
import { ArrowRight, Baby, BadgeCheck, Check, ChevronLeft, GraduationCap, Heart, Sparkles, User, X } from "lucide-react";
import {
  FIRST_JOB, PROFILE_STEPS, STATUS, isFilled, missingSteps, normalizeLinkedIn, profileScore, scoreLabel, stepPoints,
} from "../../lib/tenantProfile";
import { ScoreRing, TN_CSS, TenantCard } from "./tenantUi";

const COMPANIES = ["Google", "Microsoft", "Amazon", "Flipkart", "Swiggy", "Infosys", "Accenture", "Razorpay"];
const COLLEGES = ["IIT", "NIT", "BITS Pilani", "IIIT", "VIT", "Manipal", "Christ University", "RVCE", "PES University"];
const STATUS_ICON = { single: User, married: Heart, family: Baby };

const THIS_YEAR = new Date().getFullYear();
const GRAD_MIN = 1990;
const GRAD_MAX = THIS_YEAR + 4;

function yearChips() {
  const y = THIS_YEAR;
  return [String(y), String(y - 1), String(y - 2), String(y - 3), String(y - 4), `Before ${y - 4}`];
}

const COPY = {
  linkedin: { q: "Add your LinkedIn", sub: "The quickest way for an owner to trust who’s asking." },
  currentCompany: { q: "Where do you work now?", sub: "Owners trust tenants they can place." },
  pastCompany: { q: "And before that?", sub: "Your last company — or tell us it’s your first job." },
  education: { q: "Where did you study?", sub: "Your college, and the year you graduated." },
  inBangaloreSince: { q: "In Bangalore since?", sub: "How long you’ve called the city home." },
  maritalStatus: { q: "Married or single?", sub: "Helps us match homes and owners that fit." },
};

/** LinkedIn's "in" mark; lucide ships no brand icons. */
const LinkedInMark = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
);

export default function TenantProfileFlow({ initial = {}, onSave, onClose, onFind, onLinkedIn }) {
  const [profile, setProfile] = useState(initial);
  const [i, setI] = useState(() => {
    const miss = missingSteps(initial);
    return miss.length ? PROFILE_STEPS.findIndex((s) => s.id === miss[0].id) : 0;
  });
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(false);
  const { score, complete } = profileScore(profile);
  const step = PROFILE_STEPS[i];
  const val = (k) => profile[k] ?? "";
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const years = useMemo(() => yearChips(), []);
  const go = (n) => { setDir(n > i ? 1 : -1); setI(n); };

  const next = () => {
    const tidy = { ...profile };
    if (tidy.linkedin) tidy.linkedin = normalizeLinkedIn(tidy.linkedin) || tidy.linkedin;
    setProfile(tidy);
    onSave?.(tidy);
    if (i < PROFILE_STEPS.length - 1) go(i + 1);
    else setDone(true);
  };

  if (done) {
    return (
      <div className="tn tn-flow">
        <style>{TN_CSS + CSS}</style>
        <div className="tn-col tn-done">
          <span className="tn-done-burst"><Sparkles size={30} /></span>
          <p className="tn-kicker" style={{ textAlign: "center" }}>{complete ? "Profile complete" : "Profile saved"}</p>
          <h1>Your profile is <span>{scoreLabel(score)}</span></h1>
          <p className="tn-done-sub">
            {score >= 100 ? "The strongest profile on MovEazy." : complete ? "Every field in. Owners will see a tenant they can trust." : "Finish the rest any time — every field adds points."}
          </p>
          <TenantCard profile={profile} />
          <div className="tn-done-actions">
            <button type="button" className="tn-btn tn-btn--ink tn-btn--block" onClick={onFind}>Find my flat <ArrowRight size={18} /></button>
            <button type="button" className="tn-btn tn-btn--ghost tn-btn--block" onClick={onClose}>Back to home</button>
          </div>
        </div>
      </div>
    );
  }

  const stepDone = step.fields.every((k) => isFilled(profile, k));
  const li = val("linkedin");
  const liValid = normalizeLinkedIn(li) !== "";
  const grad = val("graduationYear");

  return (
    <div className="tn tn-flow">
      <style>{TN_CSS + CSS}</style>
      <div className="tn-col tn-flow-in">
        <div className="tn-flow-top">
          <button type="button" className="tn-icon" aria-label="Back" onClick={() => (i ? go(i - 1) : onClose?.())}><ChevronLeft size={22} /></button>
          <span>Tenant profile</span>
          <button type="button" className="tn-icon" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="tn-steps">{PROFILE_STEPS.map((s, n) => <span key={s.id} className={n < i ? "done" : n === i ? "on" : ""} />)}</div>

        <div className="tn-scorebar">
          <ScoreRing score={score} size={64} stroke={6} label={false} />
          <div style={{ flex: 1 }}>
            <b>Profile score · {scoreLabel(score)}</b>
            <em>{complete ? "Every field in." : score >= 70 ? "Almost there." : "A good profile gets you flats faster."}</em>
          </div>
          <span className={`tn-pts${stepDone ? " got" : ""}`}>+{stepPoints(step)}</span>
        </div>

        <div key={step.id} className={`tn-slidein ${dir > 0 ? "fwd" : "back"}`}>
          <h1 className="tn-q">{COPY[step.id].q}</h1>
          <p className="tn-q-sub">{COPY[step.id].sub}</p>

          {step.id === "linkedin" && (
            <>
              {onLinkedIn && (
                <>
                  <button type="button" className="tn-li-btn" onClick={onLinkedIn}><LinkedInMark /> Continue with LinkedIn</button>
                  <p className="tn-li-note">Fills your name and photo. Your job history stays yours to add.</p>
                  <div className="tn-or"><span>or paste your profile link</span></div>
                </>
              )}
              <div className="tn-input-wrap">
                <input className="tn-input" inputMode="url" autoCapitalize="none" placeholder="linkedin.com/in/your-name" value={li}
                  onChange={(e) => set("linkedin", e.target.value)} />
                {liValid && <span className="tn-input-ok"><Check size={16} strokeWidth={3} /></span>}
              </div>
              {li && !liValid && <p className="tn-hint">That doesn’t look like a profile link — it should have /in/ in it.</p>}
            </>
          )}

          {step.id === "currentCompany" && (
            <>
              <input className="tn-input" placeholder="Company name" value={val("currentCompany")} onChange={(e) => set("currentCompany", e.target.value)} />
              <div className="tn-chips">{COMPANIES.map((c) => <button key={c} type="button" className={val("currentCompany") === c ? "on" : ""} onClick={() => set("currentCompany", c)}>{c}</button>)}</div>
            </>
          )}

          {step.id === "pastCompany" && (
            <>
              <input className="tn-input" placeholder="Previous company" value={val("pastCompany") === FIRST_JOB ? "" : val("pastCompany")} disabled={val("pastCompany") === FIRST_JOB}
                onChange={(e) => set("pastCompany", e.target.value)} />
              <button type="button" className={`tn-toggle${val("pastCompany") === FIRST_JOB ? " on" : ""}`}
                onClick={() => set("pastCompany", val("pastCompany") === FIRST_JOB ? "" : FIRST_JOB)}>
                <span className="box">{val("pastCompany") === FIRST_JOB && <BadgeCheck size={16} />}</span> This is my first job
              </button>
            </>
          )}

          {step.id === "education" && (
            <>
              <input className="tn-input" placeholder="College name" value={val("college")} onChange={(e) => set("college", e.target.value)} />
              <div className="tn-chips">{COLLEGES.map((c) => <button key={c} type="button" className={val("college") === c ? "on" : ""} onClick={() => set("college", c)}>{c}</button>)}</div>
              <div className={`tn-grad${grad ? " set" : ""}`}>
                <div className="tn-grad-top">
                  <span className="ic"><GraduationCap size={20} /></span>
                  <span>Graduation year</span>
                  <b>{grad ? `Class of ${grad}` : "Slide to set"}</b>
                </div>
                <input type="range" className="tn-range" min={GRAD_MIN} max={GRAD_MAX} step={1} aria-label="Graduation year"
                  value={grad || THIS_YEAR - 3} style={{ "--p": `${(((grad || THIS_YEAR - 3) - GRAD_MIN) / (GRAD_MAX - GRAD_MIN)) * 100}%` }}
                  onChange={(e) => set("graduationYear", e.target.value)} />
                <div className="tn-grad-scale"><span>{GRAD_MIN}</span><span>{THIS_YEAR}</span><span>{GRAD_MAX}</span></div>
              </div>
            </>
          )}

          {step.id === "inBangaloreSince" && (
            <div className="tn-years">
              {years.map((y) => <button key={y} type="button" className={val("inBangaloreSince") === y ? "on" : ""} onClick={() => set("inBangaloreSince", y)}>{y}</button>)}
              <button type="button" className={`wide${val("inBangaloreSince") === "Moving soon" ? " on" : ""}`} onClick={() => set("inBangaloreSince", "Moving soon")}>Moving to Bangalore soon</button>
            </div>
          )}

          {step.id === "maritalStatus" && (
            <>
              <div className="tn-status">
                {STATUS.map((s) => {
                  const I = STATUS_ICON[s.value];
                  return (
                    <button key={s.value} type="button" className={val("maritalStatus") === s.value ? "on" : ""} onClick={() => set("maritalStatus", s.value)}>
                      <span className="ic"><I size={20} /></span><b>{s.label}</b><em>{s.sub}</em>
                    </button>
                  );
                })}
              </div>
              <p className="tn-note"><Sparkles size={14} /> All fields in: <b>Excellent (90)</b>. As a family: <b>Outstanding (100)</b>.</p>
            </>
          )}
        </div>

        <div className="tn-flow-foot">
          <button type="button" className="tn-skip" onClick={() => (i < PROFILE_STEPS.length - 1 ? go(i + 1) : setDone(true))}>Skip for now</button>
          <button type="button" className="tn-btn tn-btn--ink" disabled={!stepDone} onClick={next}>
            {i < PROFILE_STEPS.length - 1 ? "Continue" : "Finish"} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.tn-flow { background: #fff; }
.tn-flow-in { min-height: 100vh; display: flex; flex-direction: column; padding-top: 18px; padding-bottom: 24px; }
.tn-flow-top { display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 15px; }
.tn-icon { width: 40px; height: 40px; border-radius: 99px; border: 0; background: #F1F4F3; color: var(--ink); display: grid; place-items: center; cursor: pointer; }
.tn-steps { display: flex; gap: 6px; margin: 16px 0 18px; }
.tn-steps span { flex: 1; height: 4px; border-radius: 99px; background: #E3EAE8; transition: background .3s; }
.tn-steps span.done { background: var(--teal); }
.tn-steps span.on { background: linear-gradient(90deg, var(--teal) 50%, #E3EAE8 50%); }
.tn-scorebar { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 18px; background: var(--wash); }
.tn-scorebar b { display: block; font-size: 14.5px; }
.tn-scorebar em { display: block; font-style: normal; font-size: 12.5px; color: var(--dim); margin-top: 2px; }
.tn-pts { font-size: 13px; font-weight: 800; padding: 6px 10px; border-radius: 99px; background: #fff; color: #9DAAA6; transition: all .3s; }
.tn-pts.got { background: var(--teal); color: #fff; transform: scale(1.06); }
.tn-slidein { animation: tnIn .42s cubic-bezier(.16,1,.3,1) both; }
.tn-slidein.back { animation-name: tnInBack; }
@keyframes tnIn { from { opacity: 0; transform: translateX(36px); } to { opacity: 1; transform: none; } }
@keyframes tnInBack { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: none; } }
.tn-q { font-size: 30px; line-height: 1.1; letter-spacing: -.035em; font-weight: 800; margin: 30px 0 6px !important; }
.tn-q-sub { margin: 0 0 20px; font-size: 15px; color: var(--dim); }
.tn-input-wrap { position: relative; }
.tn-input { width: 100%; border: 1.5px solid #DCE3E1; border-radius: 16px; padding: 16px; font: inherit; font-size: 17px; font-weight: 600; color: var(--ink); outline: none; }
.tn-input:focus { border-color: var(--ink); box-shadow: 0 0 0 4px var(--wash); }
.tn-input:disabled { background: #F4F7F6; }
.tn-input-ok { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); width: 26px; height: 26px; border-radius: 99px; background: var(--teal); color: #fff; display: grid; place-items: center; }
.tn-hint { margin: 8px 2px 0; font-size: 13px; color: #B45309; }
.tn-li-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 54px; border: 0; border-radius: 16px; cursor: pointer;
  font: inherit; font-size: 16px; font-weight: 800; color: #fff; background: #0A66C2; box-shadow: 0 10px 24px rgba(10,102,194,.28); }
.tn-li-note { margin: 8px 2px 0; font-size: 12.5px; color: var(--dim); text-align: center; }
.tn-or { display: flex; align-items: center; gap: 10px; margin: 20px 0 14px; font-size: 12.5px; font-weight: 700; color: #9DAAA6; }
.tn-or::before, .tn-or::after { content: ""; flex: 1; height: 1px; background: #E3EAE8; }
.tn-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.tn-chips button, .tn-years button { font: inherit; font-size: 14px; font-weight: 700; padding: 10px 14px; border-radius: 99px; border: 1.5px solid #E2E8F0; background: #fff; color: var(--ink); cursor: pointer; }
.tn-chips button.on, .tn-years button.on { border-color: var(--ink); background: var(--wash); }
.tn-grad { margin-top: 20px; padding: 16px; border-radius: 18px; border: 1.5px solid #E2E8F0; }
.tn-grad.set { border-color: var(--ink); background: var(--wash); }
.tn-grad-top { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: var(--dim); }
.tn-grad-top .ic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: #F1F4F3; color: var(--teal); }
.tn-grad.set .tn-grad-top .ic { background: var(--ink); color: var(--mint); }
.tn-grad-top b { margin-left: auto; font-size: 18px; color: var(--ink); letter-spacing: -.01em; }
.tn-grad:not(.set) .tn-grad-top b { font-size: 14px; color: #9DAAA6; }
.tn-range { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 99px; margin: 18px 0 8px; outline: none; cursor: pointer;
  background: linear-gradient(90deg, var(--teal) var(--p), #E3EAE8 var(--p)); }
.tn-grad:not(.set) .tn-range { background: #E3EAE8; }
.tn-range::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; border-radius: 99px; background: #fff; border: 3px solid var(--ink); box-shadow: 0 4px 12px rgba(4,33,29,.25); }
.tn-range::-moz-range-thumb { width: 24px; height: 24px; border-radius: 99px; background: #fff; border: 3px solid var(--ink); box-shadow: 0 4px 12px rgba(4,33,29,.25); }
.tn-grad-scale { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; color: #9DAAA6; }
.tn-toggle { margin-top: 14px; display: flex; align-items: center; gap: 10px; font: inherit; font-size: 15px; font-weight: 700; color: var(--ink); background: none; border: 0; cursor: pointer; padding: 4px 0; }
.tn-toggle .box { width: 24px; height: 24px; border-radius: 8px; border: 1.5px solid #CFDAD7; display: grid; place-items: center; color: #fff; }
.tn-toggle.on .box { background: var(--teal); border-color: var(--teal); }
.tn-years { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.tn-years button { border-radius: 16px; padding: 16px 0; font-size: 16px; }
.tn-years button.wide { grid-column: 1 / -1; }
.tn-status { display: grid; gap: 10px; }
.tn-status button { display: grid; grid-template-columns: 44px 1fr; grid-template-rows: auto auto; column-gap: 12px; align-items: center; text-align: left; font: inherit;
  padding: 14px; border-radius: 18px; border: 1.5px solid #E2E8F0; background: #fff; color: var(--ink); cursor: pointer; }
.tn-status .ic { grid-row: span 2; width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: #F1F4F3; color: var(--teal); }
.tn-status b { font-size: 16px; }
.tn-status em { font-style: normal; font-size: 13px; color: var(--dim); }
.tn-status button.on { border-color: var(--ink); background: var(--wash); }
.tn-status button.on .ic { background: var(--ink); color: var(--mint); }
.tn-note { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; color: var(--dim); margin: 14px 0 0; }
.tn-note b { color: var(--ink); }
.tn-flow-foot { margin-top: auto; padding-top: 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tn-skip { font: inherit; font-size: 14.5px; font-weight: 700; color: var(--dim); background: none; border: 0; cursor: pointer; }
.tn-flow-foot .tn-btn { flex: 0 0 auto; min-width: 150px; }

.tn-done { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding-top: 30px; padding-bottom: 30px; text-align: center; }
.tn-done-burst { width: 72px; height: 72px; margin: 0 auto 14px; border-radius: 99px; display: grid; place-items: center; background: var(--wash); color: var(--teal);
  box-shadow: 0 0 0 10px rgba(94,234,212,.12); }
.tn-done h1 { font-size: 32px; letter-spacing: -.035em; line-height: 1.1; }
.tn-done h1 span { color: var(--teal); }
.tn-done-sub { margin: 8px auto 22px; font-size: 15px; color: var(--dim); max-width: 340px; }
.tn-done .tn-card { text-align: left; }
.tn-done-actions { display: grid; gap: 10px; margin-top: 22px; }
@media (prefers-reduced-motion: reduce) { .tn-slidein { animation: none; } }
`;
