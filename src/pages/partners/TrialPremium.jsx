/**
 * Trial Premium in the partner app (lib/partnerTrial.js):
 *   TrialPopups — welcome, "extended by N days", and "ended", each once.
 *   TrialBanner — Home: "Trial Premium · N days left", a warning in the last 5.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Crown, PartyPopper, Sparkles } from "lucide-react";
import logo from "../../assets/logo/moveazy-logo-mint-dark.png";
import { pp } from "../../lib/partners";
import { TRIAL_WARN_DAYS, daysLabel, extendedMessage, trialPopup, trialSeen } from "../../lib/partnerTrial";

const CSS = `
.tp-bg { position: fixed; inset: 0; z-index: 2000; background: rgba(14,13,18,.62); display: grid; place-items: center; padding: 20px; animation: tpfade .2s ease; }
.tp-card { width: 100%; max-width: 380px; border-radius: 22px; padding: 26px 22px 20px; text-align: center; color: #fff;
  background: radial-gradient(120% 90% at 50% 0%, rgba(212,164,55,.32), transparent 62%), #0E0D12; border: 1px solid rgba(212,164,55,.45);
  box-shadow: 0 24px 60px rgba(0,0,0,.4); animation: tppop .28s cubic-bezier(.2,.9,.3,1.2); }
.tp-card img { height: 22px; width: auto; display: block; margin: 0 auto 16px; }
.tp-ic { width: 60px; height: 60px; border-radius: 18px; display: grid; place-items: center; margin: 0 auto 14px; color: #1F1605; background: var(--goldg); }
.tp-card h3 { margin: 0 0 8px; font-size: 21px; letter-spacing: -0.01em; }
.tp-card p { margin: 0 0 6px; font-size: 14.5px; line-height: 1.5; color: #E7E3EE; }
.tp-card small { display: block; font-size: 12.5px; color: #A7A3B3; margin-top: 8px; }
.tp-acts { display: grid; gap: 8px; margin-top: 18px; }
.tp-acts .pz-btn--ghost { background: transparent; color: #D9D6E0; border: 1px solid rgba(255,255,255,.18); }
@keyframes tpfade { from { opacity: 0; } }
@keyframes tppop { from { opacity: 0; transform: scale(.92); } }
@media (prefers-reduced-motion: reduce) { .tp-bg, .tp-card { animation: none; } }
.tp-chip { display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin-bottom: 12px; border-radius: 14px; text-decoration: none;
  color: #fff; background: #0E0D12; border: 1px solid rgba(212,164,55,.4); font-size: 13.5px; }
.tp-chip b { color: var(--gold); }
.tp-chip span { margin-left: auto; font-size: 12.5px; color: var(--gold); font-weight: 700; }
.tp-warn { padding: 14px; margin-bottom: 12px; border-radius: 16px; background: linear-gradient(135deg, #FFF8E6, #FDEBC8); border: 1px solid #E9C877; }
.tp-warn b { display: block; font-size: 15px; color: #5C3F05; }
.tp-warn p { margin: 4px 0 10px; font-size: 13px; color: #7A5A12; }
`;

/** Shown over the app once the fresh status is in. */
export function TrialPopups({ trial, onSeen }) {
  const navigate = useNavigate();
  const [gone, setGone] = useState("");
  const pop = trialPopup(trial);
  const key = pop ? `${pop.kind}:${pop.days ?? ""}` : "";
  if (!pop || gone === key) return null;

  const close = async (then) => {
    setGone(key);
    try { await trialSeen(pop.kind); } catch { /* shown again next time, that's all */ }
    onSeen?.();
    if (then) navigate(then);
  };

  const body = pop.kind === "ended" ? (
    <>
      <span className="tp-ic"><Crown size={28} /></span>
      <h3>Your Trial Premium has ended</h3>
      <p>Take Premium to keep 1000+ verified listings with owner contacts, AI matching, curated lists and groups — plus unlimited MovEazy leads.</p>
      <div className="tp-acts">
        <button type="button" className="pz-btn pz-btn--gold pz-btn--block" onClick={() => close(pp("/premium"))}><Crown size={17} /> Take Premium</button>
        <button type="button" className="pz-btn pz-btn--ghost pz-btn--block" onClick={() => close()}>Later</button>
      </div>
    </>
  ) : pop.kind === "welcome" ? (
    <>
      <span className="tp-ic"><Sparkles size={28} /></span>
      <h3>Welcome to Trial Premium</h3>
      <p>Your {daysLabel(pop.days)} of Trial Premium are on. Enjoy every Premium feature, free.</p>
      <small>Unlimited MovEazy leads come with paid Premium.</small>
      <div className="tp-acts">
        <button type="button" className="pz-btn pz-btn--gold pz-btn--block" onClick={() => close()}>Let’s go</button>
      </div>
    </>
  ) : (
    <>
      <span className="tp-ic"><PartyPopper size={28} /></span>
      <h3>Congratulations!</h3>
      <p>{extendedMessage(pop.days)}</p>
      <small>{daysLabel(pop.left)} of Trial Premium left.</small>
      <div className="tp-acts">
        <button type="button" className="pz-btn pz-btn--gold pz-btn--block" onClick={() => close()}>Thank you</button>
      </div>
    </>
  );

  return (
    <div className="tp-bg" role="presentation">
      <style>{CSS}</style>
      <div className="tp-card" role="dialog" aria-modal="true" aria-label="Trial Premium">
        <img src={logo} alt="MovEazy" />
        {body}
      </div>
    </div>
  );
}

/** Home: a Premium payment sent by UPI, waiting for the MovEazy team to confirm it. */
export function PaymentCheckBanner({ payment }) {
  if (payment?.status !== "payment_check") return null;
  return (
    <div className="tp-warn" style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <style>{CSS}</style>
      <Clock size={20} color="#8A6419" style={{ flex: "none" }} />
      <span><b>Payment received — we’re checking it</b>
        <p style={{ margin: "2px 0 0" }}>Premium starts as soon as it’s confirmed, usually within a few hours. You’ll get a notification.</p></span>
    </div>
  );
}

/** Home: how long the trial has left; in its last days, a nudge to take Premium. */
export function TrialBanner({ trial }) {
  if (!trial?.active) return null;
  const n = trial.days_left;
  if (n <= TRIAL_WARN_DAYS) {
    return (
      <div className="tp-warn">
        <style>{CSS}</style>
        <b>Your Trial Premium ends in {daysLabel(n)}</b>
        <p>Take Premium to keep everything you use now. Your remaining trial days are added on at the end, so you lose nothing by joining early.</p>
        <Link to={pp("/premium")} className="pz-btn pz-btn--gold pz-btn--sm"><Crown size={15} /> Take Premium</Link>
      </div>
    );
  }
  return (
    <Link to={pp("/premium")} className="tp-chip">
      <style>{CSS}</style>
      <Crown size={16} color="var(--gold)" /> <b>Trial Premium</b> · {daysLabel(n)} left
      <span>Go Premium →</span>
    </Link>
  );
}
