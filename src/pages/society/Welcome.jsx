/**
 * Screens 1 and 2: the splash (three slides) and login. Login takes the
 * mobile number, then Google — there's no SMS sender, so Google verifies the
 * person and the number is saved to the account when they come back.
 */
import { useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { normalizeIndianMobile, formatForDisplay } from "../../lib/mobile";
import { BuildingArt, SocietyLogo } from "./societyUi";
import { markSplashSeen, rememberSocietyPhone, splashSeen } from "./societySignup";

const SLIDES = [
  { title: ["Add Flats.", "Earn Together."], body: "Help us maintain accurate society information and earn up to 70% of brokerage." },
  { title: ["A flat in", "under a minute."], body: "Block, flat number, rent and the owner's number. MovEazy finds the tenant." },
  { title: ["Paid to your", "UPI."], body: "When MovEazy closes a rental in your society, your share goes straight to your UPI ID." },
];

function Splash({ onStart }) {
  const [i, setI] = useState(0);
  const x0 = useRef(null);
  const s = SLIDES[i];
  return (
    <div className="wl wl--splash">
      <style>{CSS}</style>
      <div className="wl-top"><SocietyLogo size={40} /></div>
      <div className="wl-art"
        onTouchStart={(e) => { x0.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (x0.current ?? 0);
          if (dx < -40) setI((v) => Math.min(SLIDES.length - 1, v + 1));
          if (dx > 40) setI((v) => Math.max(0, v - 1));
        }}>
        <BuildingArt className="wl-svg" />
        <div className="wl-copy" key={i}>
          <h1>{s.title[0]}<br />{s.title[1]}</h1>
          <p>{s.body}</p>
        </div>
      </div>
      <div className="wl-dots" role="tablist" aria-label="Slides">
        {SLIDES.map((_, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`Slide ${k + 1}`} className={k === i ? "on" : ""} onClick={() => setI(k)} />
        ))}
      </div>
      <div className="wl-cta">
        <button type="button" className="sx-btn" onClick={onStart}>Get Started</button>
      </div>
    </div>
  );
}

function Login() {
  const { loginWithGoogle } = useAuth();
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async (e) => {
    e.preventDefault();
    if (!normalizeIndianMobile(phone)) { setErr("Enter a valid 10-digit mobile number."); return; }
    setBusy(true);
    setErr("");
    rememberSocietyPhone(phone);
    const r = await loginWithGoogle();
    if (!r?.success) { setErr(r?.error || "Couldn't open Google sign-in. Try again."); setBusy(false); }
  };

  return (
    <form className="wl wl--login" onSubmit={go} noValidate>
      <style>{CSS}</style>
      <div className="wl-top wl-top--login"><SocietyLogo size={40} /></div>
      <h1 className="wl-h">Enter your mobile number</h1>
      <p className="wl-p">We&apos;ll confirm it&apos;s you with your Google account.</p>
      <label className={`wl-phone${err ? " bad" : ""}`}>
        <span className="wl-flag" aria-hidden><i /><i /><i /></span>
        <span className="wl-cc">+91</span>
        <input inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" aria-label="Mobile number" autoFocus
          value={formatForDisplay(phone)}
          onChange={(e) => { let d = e.target.value.replace(/\D/g, ""); if (d.length > 10 && d.startsWith("91")) d = d.slice(2); setPhone(d.slice(0, 10)); setErr(""); }} />
      </label>
      {err && <p className="sx-err" role="alert" style={{ marginTop: 8 }}>{err}</p>}
      <button type="submit" className="sx-btn wl-send" disabled={busy}>
        {busy ? "Opening Google…" : (
          <><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden><path fill="#fff" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /></svg>
            Continue with Google</>
        )}
      </button>
      <p className="wl-fine">By continuing, you agree to our<br />
        <a href="https://www.moveazy.co.in/terms" target="_blank" rel="noreferrer">Terms</a> &amp; <a href="https://www.moveazy.co.in/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>
    </form>
  );
}

export default function Welcome() {
  const [step, setStep] = useState(splashSeen() ? "login" : "splash");
  if (step === "splash") return <Splash onStart={() => { markSplashSeen(); setStep("login"); }} />;
  return <Login />;
}

const CSS = `
.wl { max-width: 520px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; padding: 0 22px calc(22px + env(safe-area-inset-bottom)); }
.wl--splash { background: linear-gradient(180deg, #F4F7F2 0%, #F7F4EC 60%); }
.wl-top { display: flex; justify-content: center; padding-top: 56px; }
.wl-top--login { padding-top: 84px; padding-bottom: 36px; }
.wl-art { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; touch-action: pan-y; }
.wl-svg { width: 100%; max-width: 420px; margin-top: 18px; -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent); mask-image: linear-gradient(180deg, #000 70%, transparent); }
.wl-copy { text-align: center; margin-top: -8px; animation: wlin .35s ease-out; }
@keyframes wlin { from { opacity: 0; transform: translateY(8px); } }
.wl-copy h1 { font-size: 32px; line-height: 1.12; letter-spacing: -0.02em; margin: 0; color: #0B2A20; }
.wl-copy p { color: #45524D; font-size: 16px; line-height: 1.5; margin: 12px auto 0; max-width: 300px; }
.wl-dots { display: flex; justify-content: center; gap: 8px; margin: 26px 0 22px; }
.wl-dots button { width: 8px; height: 8px; border-radius: 99px; border: 0; background: #D5D9D2; padding: 0; cursor: pointer; }
.wl-dots button.on { width: 22px; background: var(--em); }
.wl-h { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
.wl-p { color: #5E6B66; margin: 6px 0 22px; }
.wl-phone { display: flex; align-items: center; gap: 12px; background: #fff; border: 1.5px solid #E2DDD0; border-radius: 14px; padding: 0 16px; min-height: 60px; }
.wl-phone.bad { border-color: #E5484D; }
.wl-phone:focus-within { border-color: var(--em); box-shadow: 0 0 0 3px rgba(10,107,78,.12); }
.wl-flag { width: 26px; height: 18px; border-radius: 3px; overflow: hidden; display: grid; grid-template-rows: repeat(3, 1fr); flex: none; box-shadow: 0 0 0 1px rgba(0,0,0,.06); }
.wl-flag i:nth-child(1) { background: #FF9933; } .wl-flag i:nth-child(2) { background: #fff; } .wl-flag i:nth-child(3) { background: #138808; }
.wl-cc { font-weight: 700; font-size: 17px; }
.wl-phone input { flex: 1; min-width: 0; border: 0; outline: 0; font: inherit; font-size: 18px; font-weight: 600; background: transparent; padding: 16px 0; letter-spacing: .02em; }
.wl-send { margin-top: 18px; }
.wl-fine { margin-top: auto; text-align: center; color: #8A928E; font-size: 13.5px; line-height: 1.6; padding-top: 40px; }
.wl-fine a { color: #5E6B66; }
`;
