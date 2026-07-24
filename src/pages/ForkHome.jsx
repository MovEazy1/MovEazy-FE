/**
 * Fork home — the "/" landing page.
 * Hero matches the split dark/coral Figma; sections below match "Colour iteration 1"
 * (How the Magic happens → 3 Step Wonder → How It Works → Listing Advantage → Testimonials).
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import AIBroker from "../components/AIBroker";
import SiteHeader from "../components/layout/SiteHeader";
import livingRoomImg from "../assets/images/Cozy_modern_living_room.png";
import keysImg from "../assets/images/guarentee-keyhandover.jpg";
import cityImg from "../assets/images/city-bg.png";
import sofaImg from "../assets/images/services/image1-sofa.png";
import avatarA from "../assets/images/aman.png";
import avatarB from "../assets/images/yatharth.png";
import avatarC from "../assets/images/kuldeep.png";

const EASE = [0.22, 1, 0.36, 1];

function Reveal({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

/* ── Section chrome ─────────────────────────────────────────────────────────── */

function RuleHeading({ children }) {
  return (
    <div className="mz-rule-heading">
      <span className="mz-rule" />
      <span className="mz-rule-label">{children}</span>
      <span className="mz-rule" />
    </div>
  );
}

function Check({ children }) {
  return (
    <li className="mz-check">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" width="11" height="11" aria-hidden>
        <path d="M4 12l5 5L20 7" />
      </svg>
      {children}
    </li>
  );
}

/* ── How-It-Works card (text half) ──────────────────────────────────────────── */

function HowCardText({ num, title, tagline, body, checks, statBig, statSmall }) {
  return (
    <div className="mz-how-text">
      <div className="mz-how-titlerow">
        <span className="mz-num-badge">{num}</span>
        <h3 className="mz-how-title">{title}</h3>
      </div>
      <p className="mz-how-tagline">{tagline}</p>
      <p className="mz-how-body">{body}</p>
      <ul className="mz-checklist">
        {checks.map((c) => <Check key={c}>{c}</Check>)}
      </ul>
      <div className="mz-how-statwrap">
        <div className="mz-how-statline" />
        <div className="mz-how-stat">
          <span className="mz-stat-big">{statBig}</span>
          <span className="mz-stat-small">{statSmall}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Match row (card 2 visual) ──────────────────────────────────────────────── */

function MatchRow({ img, pct, title, meta, price }) {
  return (
    <div className="mz-match-row">
      <div className="mz-match-thumb" style={{ backgroundImage: `url(${img})` }}>
        <span className="mz-match-pct">{pct} Match</span>
      </div>
      <div className="mz-match-mid">
        <div className="mz-match-title">{title}</div>
        <div className="mz-match-meta">{meta}</div>
        <div className="mz-match-actions">
          <button type="button" className="mz-btn-dark">View details</button>
          <button type="button" className="mz-btn-line">Enquire</button>
        </div>
      </div>
      <div className="mz-match-price">{price}<span>/mo</span></div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function ForkHome() {
  const { user } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [showChatbot, setShowChatbot] = useState(false);
  const [showChoice, setShowChoice] = useState(false);

  // "Show me flats" — gate on sign-in first, then show the map-vs-agent choice.
  const startFlatSearch = () => {
    if (user) {
      setShowChoice(true);
    } else {
      openLogin(() => setShowChoice(true));
    }
  };

  const chooseMap = () => {
    setShowChoice(false);
    navigate("/map");
  };

  const chooseAgent = () => {
    setShowChoice(false);
    setShowChatbot(true);
  };

  // Header "Get My Free Agent" — gate on sign-in, then jump straight to the chat (skip the map-vs-agent choice).
  const startAgentDirectly = () => {
    if (user) {
      setShowChatbot(true);
    } else {
      openLogin(() => setShowChatbot(true));
    }
  };

  return (
    <div style={{ background: "#F2F1EC", color: "#1A2421", fontFamily: "Inter, sans-serif", minHeight: "100dvh" }}>

      {/* ── Figma design system (scoped to this page) ── */}
      <style>{`

        .fx-hero { position: relative; width: 100%; height: 82vh; min-height: 560px; max-height: 780px; overflow: hidden; background: #2e2b28; }
        .fx-side { position: absolute; inset: 0; display: flex; align-items: center; }
        .fx-side-dark { background: #2e2b28; clip-path: polygon(0 0, 43% 0, 35% 100%, 0 100%); justify-content: flex-start; }
        .fx-side-coral { background: #f26a5b; clip-path: polygon(65% 0, 100% 0, 100% 100%, 57% 100%); justify-content: flex-end; }
        .fx-band { position: absolute; inset: 0; display: flex; clip-path: polygon(43% 0, 65% 0, 57% 100%, 35% 100%); }
        .fx-band-img { flex: 1; background-size: cover; background-position: center; }
        .fx-inner { max-width: 44%; padding: 40px clamp(24px, 6vw, 92px) 0; }
        .fx-side-coral .fx-inner { max-width: 42%; padding-left: clamp(48px, 10vw, 150px); }
        .fx-eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 18px; }
        .fx-h1 { font-family: 'Playfair Display', Georgia, serif; font-weight: 600; font-size: clamp(38px, 5.2vw, 68px); line-height: 1.04; letter-spacing: -0.015em; margin: 0 0 20px; }
        .fx-sub { font-size: 15px; line-height: 1.5; margin: 0 0 30px; max-width: 320px; }
        .fx-cta { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #1c1a17; border: none; border-radius: 999px; padding: 15px 30px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; box-shadow: 0 8px 24px rgba(0,0,0,0.14); transition: transform 0.15s ease; }
        .fx-cta:hover { transform: translateY(-2px); }
        .fx-textlink { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; color: #3a1f1a; font-size: 14.5px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; background: none; border: none; cursor: pointer; font-family: inherit; }

        .fx-dark-eyebrow { color: rgba(255,255,255,0.5); }
        .fx-dark-h1 { color: #ffffff; }
        .fx-dark-sub { color: rgba(255,255,255,0.72); }
        .fx-coral-eyebrow { color: rgba(58,31,26,0.62); }
        .fx-coral-h1 { color: #2a1512; }
        .fx-coral-sub { color: rgba(42,21,18,0.78); }

        /* ── Colour-iteration sections ── */
        .mz-wrap { max-width: 1180px; margin: 0 auto; padding: 0 24px; }

        .mz-magic-h { font-size: clamp(24px, 3vw, 34px); font-weight: 700; letter-spacing: 0.06em; margin: 0 0 10px; color: #141210; }
        .mz-magic-h em { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-weight: 700; letter-spacing: 0.01em; }
        .mz-magic-sub { font-family: Georgia, serif; font-size: 14px; letter-spacing: 0.12em; color: #3d3a34; margin: 0; }

        .mz-rule-heading { display: flex; align-items: center; gap: 18px; margin: 0 0 44px; }
        .mz-rule { height: 1px; flex: 1; background: #cfccc2; }
        .mz-rule-label { font-size: 15px; font-weight: 600; letter-spacing: 0.22em; color: #57534b; white-space: nowrap; }

        .mz-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(20px, 4vw, 56px); }
        .mz-step-card { position: relative; border-radius: 18px; overflow: hidden; aspect-ratio: 3/4.1; max-width: 300px; margin: 0 auto; width: 100%; box-shadow: 0 16px 34px rgba(20,18,16,0.22); background-size: cover; background-position: center; }
        .mz-step-card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.55) 100%); }
        .mz-step-num { position: absolute; top: 18px; right: 22px; z-index: 2; color: #fff; font-family: 'Playfair Display', Georgia, serif; font-size: 20px; letter-spacing: 0.28em; }
        .mz-step-title { position: absolute; left: 20px; bottom: 18px; z-index: 2; color: #fff; font-family: 'Playfair Display', Georgia, serif; font-size: 21px; line-height: 1.45; letter-spacing: 0.14em; font-weight: 600; }

        .mz-how-card { display: grid; grid-template-columns: 1fr 1.05fr; border-radius: 28px; overflow: hidden; background: #B04A42; box-shadow: 0 22px 44px rgba(120,32,26,0.25); margin-bottom: 44px; }
        .mz-how-text { padding: clamp(26px, 3.4vw, 44px); background: linear-gradient(155deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 34%, rgba(255,255,255,0) 62%); color: #fff; display: flex; flex-direction: column; }
        .mz-how-visual { background: #A63E37; padding: clamp(22px, 3vw, 40px); display: flex; align-items: center; justify-content: center; }
        .mz-how-titlerow { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .mz-num-badge { width: 26px; height: 26px; border-radius: 50%; background: #CB2B24; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
        .mz-how-title { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(24px, 2.4vw, 30px); font-weight: 700; margin: 0; letter-spacing: 0.01em; }
        .mz-how-tagline { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-weight: 600; font-size: 14px; margin: 0 0 12px; color: rgba(255,255,255,0.95); }
        .mz-how-body { font-size: 13.5px; line-height: 1.6; color: rgba(255,255,255,0.92); margin: 0 0 18px; max-width: 400px; }
        .mz-checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .mz-check { display: flex; align-items: center; gap: 9px; font-size: 12.5px; color: rgba(255,255,255,0.9); }
        .mz-check svg { color: rgba(255,255,255,0.75); flex-shrink: 0; }
        .mz-how-statwrap { margin-top: auto; padding-top: 26px; }
        .mz-how-statline { width: min(230px, 70%); height: 1px; background: rgba(255,255,255,0.55); margin-bottom: 14px; }
        .mz-stat-big { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; margin-right: 8px; }
        .mz-stat-small { font-size: 12px; color: rgba(255,255,255,0.8); }

        /* visual 1 — AI assistant chat */
        .mz-chat-wrap { display: flex; gap: 16px; align-items: flex-start; justify-content: center; flex-wrap: wrap; }
        .mz-chat { width: min(300px, 100%); background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 14px 30px rgba(0,0,0,0.25); }
        .mz-chat-head { background: #111; color: #fff; padding: 12px 14px; display: flex; align-items: center; gap: 9px; }
        .mz-chat-avatar { width: 26px; height: 26px; border-radius: 50%; background: #CB2B24; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        .mz-chat-name { font-size: 12.5px; font-weight: 700; }
        .mz-chat-status { font-size: 10px; color: #9be29b; }
        .mz-chat-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .mz-bubble { max-width: 85%; padding: 9px 12px; border-radius: 12px; font-size: 11.5px; line-height: 1.45; }
        .mz-bubble-bot { background: #f2f1ec; color: #24211d; border-top-left-radius: 4px; align-self: flex-start; }
        .mz-bubble-user { background: #1c1a17; color: #fff; border-top-right-radius: 4px; align-self: flex-end; }
        .mz-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .mz-pill { border: 1px solid #e3b1ac; color: #b03a32; border-radius: 999px; padding: 3px 10px; font-size: 10.5px; font-weight: 600; }
        .mz-gathered { width: min(200px, 100%); background: #141210; color: #fff; border-radius: 14px; padding: 14px; box-shadow: 0 14px 30px rgba(0,0,0,0.3); }
        .mz-gathered-title { font-size: 11px; font-weight: 700; text-align: center; margin-bottom: 10px; line-height: 1.4; }
        .mz-gathered-row { display: flex; justify-content: space-between; font-size: 10.5px; padding: 5px 0; border-bottom: 1px dashed rgba(255,255,255,0.16); }
        .mz-gathered-row span:first-child { color: rgba(255,255,255,0.6); }
        .mz-gathered-row span:last-child { color: #ff8478; font-weight: 600; }
        .mz-gathered-btn { margin-top: 12px; width: 100%; background: #fff; color: #141210; border: none; border-radius: 999px; padding: 7px 0; font-size: 10.5px; font-weight: 700; }

        /* visual 2 — matches */
        .mz-matches { width: 100%; display: flex; flex-direction: column; gap: 12px; }
        .mz-match-label { font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 700; color: #fff; margin: 2px 0 6px; }
        .mz-match-row { background: #fff; border-radius: 10px; display: flex; align-items: stretch; overflow: hidden; box-shadow: 0 10px 22px rgba(0,0,0,0.18); }
        .mz-match-thumb { width: 86px; flex-shrink: 0; background-size: cover; background-position: center; position: relative; }
        .mz-match-pct { position: absolute; top: 6px; left: 6px; background: #CB2B24; color: #fff; font-size: 8.5px; font-weight: 700; border-radius: 999px; padding: 2px 7px; }
        .mz-match-mid { flex: 1; padding: 9px 12px; min-width: 0; }
        .mz-match-title { font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 700; color: #17140f; }
        .mz-match-meta { font-size: 9.5px; color: #8a857c; margin: 2px 0 8px; }
        .mz-match-actions { display: flex; gap: 6px; }
        .mz-btn-dark { background: #1c1a17; color: #fff; border: none; border-radius: 999px; font-size: 9px; font-weight: 600; padding: 4px 11px; }
        .mz-btn-line { background: #fff; color: #1c1a17; border: 1px solid #d8d5cc; border-radius: 999px; font-size: 9px; font-weight: 600; padding: 4px 11px; }
        .mz-match-price { padding: 10px 12px 0 0; font-family: 'Playfair Display', Georgia, serif; font-size: 14.5px; font-weight: 700; color: #17140f; white-space: nowrap; }
        .mz-match-price span { font-size: 10px; color: #8a857c; font-family: Inter, sans-serif; font-weight: 500; }

        /* visual 3 — schedule */
        .mz-sched { width: min(420px, 100%); }
        .mz-sched-panel { background: #F6E3DF; border-radius: 14px; padding: 14px; }
        .mz-sched-head { display: flex; justify-content: space-between; align-items: center; background: #efd6d1; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; font-weight: 700; color: #4a2320; }
        .mz-sched-head span:last-child { font-weight: 600; color: #8c5750; }
        .mz-visit { background: #141210; border-radius: 10px; padding: 10px 12px; display: flex; gap: 11px; align-items: center; margin-bottom: 9px; }
        .mz-visit-date { width: 34px; height: 34px; border-radius: 8px; background: #CB2B24; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 8.5px; font-weight: 700; line-height: 1.15; flex-shrink: 0; }
        .mz-visit-date b { font-size: 13px; }
        .mz-visit-info { min-width: 0; }
        .mz-visit-title { color: #fff; font-size: 11.5px; font-weight: 700; }
        .mz-visit-sub { color: rgba(255,255,255,0.65); font-size: 10px; margin: 1px 0 2px; }
        .mz-visit-link { color: #ff8478; font-size: 9.5px; font-weight: 700; }
        .mz-sched-note { margin-top: 11px; background: #fff; border-radius: 999px; padding: 7px 13px; font-size: 10px; color: #57534b; display: flex; align-items: center; gap: 6px; }

        /* visual 4 — move-in */
        .mz-movein { width: min(400px, 100%); display: flex; flex-direction: column; gap: 12px; }
        .mz-allset { background: #141210; color: #fff; border-radius: 14px; padding: 16px; }
        .mz-allset-title { font-size: 14px; font-weight: 700; margin: 6px 0 3px; }
        .mz-allset-sub { font-size: 10.5px; color: rgba(255,255,255,0.6); }
        .mz-checkcard { background: #fff; border-radius: 14px; padding: 14px 16px; }
        .mz-checkcard-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; color: #8a857c; margin-bottom: 9px; }
        .mz-checkcard-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #24211d; padding: 5px 0; }
        .mz-checkcard-row svg { color: #2D6A4F; flex-shrink: 0; }
        .mz-verified-pill { background: #fff; border: 1px solid #d8d5cc; border-radius: 999px; padding: 8px 14px; font-size: 10.5px; font-weight: 600; color: #57534b; display: inline-flex; align-items: center; gap: 7px; align-self: flex-start; }

        /* Listing advantage */
        .mz-adv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        .mz-adv-card { border-radius: 20px; color: #fff; padding: clamp(24px, 2.6vw, 36px); min-height: 190px; display: flex; flex-direction: column; box-shadow: 0 16px 34px rgba(90,22,17,0.22); }
        .mz-adv-title { font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; margin: 0 0 10px; }
        .mz-adv-body { font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.88); margin: 0; max-width: 420px; }

        /* Testimonials */
        .mz-testi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
        .mz-testi-card { background: #F8ECE9; border-radius: 18px; padding: 24px; box-shadow: 0 12px 26px rgba(20,18,16,0.08); }
        .mz-testi-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .mz-testi-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #e0d7d2; }
        .mz-testi-name { font-family: 'Playfair Display', Georgia, serif; font-size: 15.5px; font-weight: 700; color: #17140f; }
        .mz-testi-stars { color: #CB2B24; font-size: 12px; letter-spacing: 2px; }
        .mz-testi-quote { font-size: 13px; line-height: 1.65; color: #4a443d; margin: 0; }

        /* Footer */
        .mz-footer { background: #141210; color: #fff; margin-top: 96px; }
        .mz-footer-inner { max-width: 1180px; margin: 0 auto; padding: 56px 24px 30px; }
        .mz-footer-top { display: flex; justify-content: space-between; gap: 40px; flex-wrap: wrap; padding-bottom: 36px; border-bottom: 1px solid rgba(255,255,255,0.12); }
        .mz-footer-brand { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; }
        .mz-footer-tag { font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 8px; max-width: 300px; line-height: 1.6; }
        .mz-footer-cols { display: flex; gap: clamp(28px, 5vw, 72px); flex-wrap: wrap; }
        .mz-footer-col-h { font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; color: rgba(255,255,255,0.45); margin-bottom: 12px; }
        .mz-footer-link { display: block; font-size: 13.5px; color: rgba(255,255,255,0.85); text-decoration: none; margin-bottom: 9px; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; text-align: left; }
        .mz-footer-link:hover { color: #fff; }
        .mz-footer-cta { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 30px 0 0; }
        .mz-footer-cta-h { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(20px, 2.4vw, 27px); font-weight: 700; margin: 0; }
        .mz-footer-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        .mz-footer-btn-solid { background: #fff; color: #141210; border: none; border-radius: 999px; padding: 13px 26px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .mz-footer-btn-line { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.4); border-radius: 999px; padding: 13px 26px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .mz-footer-base { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-top: 40px; font-size: 11.5px; color: rgba(255,255,255,0.4); }

        /* ── "Show me flats" choice popup ── */
        .mz-choice-card { position: relative; width: 100%; max-width: 640px; background: #FFFEFB; border-radius: 24px; padding: clamp(28px, 4vw, 44px); box-shadow: 0 24px 70px rgba(0,0,0,0.3); }
        .mz-choice-close { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid #e4dfd6; background: #fff; color: #8a857c; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; }
        .mz-choice-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #b03a32; margin-bottom: 10px; }
        .mz-choice-title { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(22px, 3vw, 28px); font-weight: 700; color: #17140f; margin: 0 0 8px; }
        .mz-choice-sub { font-size: 13.5px; color: #6b6459; margin: 0 0 26px; }
        .mz-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .mz-choice-opt { position: relative; text-align: left; border-radius: 18px; padding: 22px 20px; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; gap: 10px; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mz-choice-opt:hover { transform: translateY(-3px); }
        .mz-choice-opt-plain { background: #fff; border: 1.5px solid #e4dfd6; color: #17140f; }
        .mz-choice-opt-plain:hover { border-color: #cfc8ba; }
        .mz-choice-opt-hero { background: linear-gradient(155deg, #f26a5b 0%, #cb2b24 100%); border: 1.5px solid transparent; color: #fff; box-shadow: 0 14px 32px rgba(203,43,36,0.35); transform: scale(1.03); }
        .mz-choice-opt-hero:hover { transform: scale(1.03) translateY(-3px); }
        .mz-choice-badge { position: absolute; top: -11px; right: 16px; background: #17140f; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px; border-radius: 999px; box-shadow: 0 4px 10px rgba(0,0,0,0.25); }
        .mz-choice-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .mz-choice-opt-plain .mz-choice-icon { background: #f3f0ea; color: #b03a32; }
        .mz-choice-opt-hero .mz-choice-icon { background: rgba(255,255,255,0.2); color: #fff; }
        .mz-choice-opt-title { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; font-weight: 700; }
        .mz-choice-opt-body { font-size: 12.5px; line-height: 1.55; }
        .mz-choice-opt-plain .mz-choice-opt-body { color: #6b6459; }
        .mz-choice-opt-hero .mz-choice-opt-body { color: rgba(255,255,255,0.9); }
        .mz-choice-opt-cta { margin-top: 4px; font-size: 12.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
        .mz-choice-opt-plain .mz-choice-opt-cta { color: #b03a32; }
        .mz-choice-opt-hero .mz-choice-opt-cta { color: #fff; }

        @media (max-width: 640px) {
          .mz-choice-grid { grid-template-columns: 1fr; }
          .mz-choice-opt-hero { transform: none; }
          .mz-choice-opt-hero:hover { transform: translateY(-3px); }
        }

        @media (max-width: 900px) {
          .fx-hero { display: flex; flex-direction: column; height: auto; min-height: 0; max-height: none; }
          .fx-side, .fx-band { position: relative; inset: auto; clip-path: none !important; width: 100%; }
          .fx-side-dark { padding: 32px 22px 44px; }
          .fx-side-coral { padding: 44px 22px 52px; }
          .fx-band { height: 200px; order: 0; }
          .fx-inner, .fx-side-coral .fx-inner { max-width: 100%; padding: 0; margin-left: 0; }
          .fx-sub { max-width: none; }

          .mz-steps { grid-template-columns: 1fr; gap: 22px; }
          .mz-how-card { grid-template-columns: 1fr; }
          .mz-adv-grid { grid-template-columns: 1fr; }
          .mz-testi-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <SiteHeader active="home" onGetAgent={startAgentDirectly} />

      {/* ── Split hero (Figma) ── */}
      <section className="fx-hero">
        {/* Left — seeker */}
        <div className="fx-side fx-side-dark">
          <div className="fx-inner">
            <div className="fx-eyebrow fx-dark-eyebrow">Looking for a flat?</div>
            <h1 className="fx-h1 fx-dark-h1">Find Your<br />Next Home</h1>
            <p className="fx-sub fx-dark-sub">From someone who actually lived there.</p>
            <button type="button" className="fx-cta" onClick={startFlatSearch}>
              Show me flats
            </button>
          </div>
        </div>

        {/* Center — image band */}
        <div className="fx-band" aria-hidden>
          <div className="fx-band-img" style={{ backgroundImage: `url(${livingRoomImg})` }} />
          <div className="fx-band-img" style={{ backgroundImage: `url(${keysImg})`, backgroundColor: "#f26a5b" }} />
        </div>

        {/* Right — vacating */}
        <div className="fx-side fx-side-coral">
          <div className="fx-inner" style={{ marginLeft: "auto" }}>
            <div className="fx-eyebrow fx-coral-eyebrow">Passing your flat?</div>
            <h1 className="fx-h1 fx-coral-h1">Find Your<br />next Occupant</h1>
            <p className="fx-sub fx-coral-sub">From someone who actually lived there.</p>
            <button
              type="button"
              className="fx-cta"
              onClick={() => (user ? navigate("/profile") : openLogin(() => navigate("/profile")))}
            >
              List my Flat
            </button>
            <div>
              <a href="#how" className="fx-textlink">
                Get paid to pass it on <ArrowIcon />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── How the Magic happens ── */}
      <section className="mz-wrap" style={{ paddingTop: 72 }}>
        <Reveal>
          <h2 className="mz-magic-h">How the <em>Magic</em> happens</h2>
          <p className="mz-magic-sub">MovEazy understands you first, before finding your dream home</p>
        </Reveal>
      </section>

      {/* ── The 3 Step Wonder ── */}
      <section className="mz-wrap" style={{ paddingTop: 64 }}>
        <Reveal><RuleHeading>The 3 Step Wonder</RuleHeading></Reveal>
        <Reveal delay={0.08}>
          <div className="mz-steps">
            <div className="mz-step-card" style={{ backgroundImage: `url(${livingRoomImg})` }}>
              <span className="mz-step-num">01</span>
              <div className="mz-step-title">AI<br />Understands<br />You</div>
            </div>
            <div className="mz-step-card" style={{ backgroundImage: `url(${cityImg})` }}>
              <span className="mz-step-num">02</span>
              <div className="mz-step-title">Shortlist<br />Smart<br />Matches</div>
            </div>
            <div className="mz-step-card" style={{ backgroundImage: `url(${keysImg})` }}>
              <span className="mz-step-num">03</span>
              <div className="mz-step-title">Schedule<br />Smart<br />Visits</div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="mz-wrap" style={{ paddingTop: 88, scrollMarginTop: 90 }}>
        <Reveal><RuleHeading>How It Works</RuleHeading></Reveal>

        {/* 1 — Create your profile */}
        <Reveal>
          <div className="mz-how-card">
            <HowCardText
              num="1"
              title="Create your profile"
              tagline="Tell us who you are — not just what you want."
              body="Fill a 2-minute brief. Our AI goes deeper than filters: commute patterns, sunlight preferences, dealbreakers, and who you're moving in with."
              checks={[
                "AI learns from your answers in real time",
                "Lifestyle preferences, not just bedroom count",
                "Dealbreaker toggles so nothing slips through",
                "Updates anytime — your profile grows with you",
              ]}
              statBig="1 min"
              statSmall="to complete"
            />
            <div className="mz-how-visual">
              <div className="mz-chat-wrap">
                <div className="mz-chat">
                  <div className="mz-chat-head">
                    <span className="mz-chat-avatar">🏠</span>
                    <div>
                      <div className="mz-chat-name">AI Assistant</div>
                      <div className="mz-chat-status">Online · Ready to help</div>
                    </div>
                  </div>
                  <div className="mz-chat-body">
                    <div className="mz-bubble mz-bubble-bot">How furnished should it be when you walk in?</div>
                    <div className="mz-pills">
                      <span className="mz-pill">Unfurnished</span>
                      <span className="mz-pill">Semi-furnished</span>
                      <span className="mz-pill">Fully furnished</span>
                    </div>
                    <div className="mz-bubble mz-bubble-user">Fully furnished</div>
                    <div className="mz-bubble mz-bubble-bot">Who's this home for, and is a pet joining you?</div>
                    <div className="mz-bubble mz-bubble-user">Bachelor(s)</div>
                    <div className="mz-bubble mz-bubble-bot">What's your upper limit on rent?</div>
                    <div className="mz-bubble mz-bubble-user">₹40,000</div>
                  </div>
                </div>
                <div className="mz-gathered">
                  <div className="mz-gathered-title">This is What I Gathered From Your Inputs!</div>
                  <div className="mz-gathered-row"><span>Area</span><span>HSR Layout</span></div>
                  <div className="mz-gathered-row"><span>Home Size</span><span>2 BHK</span></div>
                  <div className="mz-gathered-row"><span>Furnishing</span><span>Fully Furnished</span></div>
                  <div className="mz-gathered-row"><span>Who's moving in?</span><span>Bachelors</span></div>
                  <div className="mz-gathered-row"><span>Budget</span><span>₹40,000</span></div>
                  <div className="mz-gathered-row"><span>Move-in</span><span>30 June 2026</span></div>
                  <button type="button" className="mz-gathered-btn">View Matched Listings →</button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 2 — Get AI Recommendations */}
        <Reveal>
          <div className="mz-how-card">
            <HowCardText
              num="2"
              title="Get AI Recommendations"
              tagline="Around 6 homes we'd stake our reputation on"
              body="Our AI scores every listing on the several parameters set stringently by our users. We stay true and loyal to the criteria."
              checks={[
                "HomeScore breakdown for every property",
                "No irrelevant listings, ever",
                "Photos, rent split, and honest observations",
                "Refreshed as new properties go live",
              ]}
              statBig="3 min"
              statSmall="to complete"
            />
            <div className="mz-how-visual">
              <div className="mz-matches">
                <div className="mz-match-label">High Matches</div>
                <MatchRow img={livingRoomImg} pct="97%" title="Sunny 2BHK, 9th floor" meta="HSR Layout, 6th Block, Bengaluru" price="₹28,000" />
                <div className="mz-match-label">Mid Matches</div>
                <MatchRow img={sofaImg} pct="82%" title="2BHK in gated society" meta="HSR Layout, 7th Block, Bengaluru" price="₹66,000" />
                <div className="mz-match-label">Low Matches</div>
                <MatchRow img={keysImg} pct="71%" title="Cosy 1BHK, west-facing" meta="Indiranagar, 4th Cross, Bengaluru" price="₹19,000" />
              </div>
            </div>
          </div>
        </Reveal>

        {/* 3 — Schedule Smart Visits */}
        <Reveal>
          <div className="mz-how-card">
            <HowCardText
              num="3"
              title="Schedule Smart Visits"
              tagline="See your top picks in four hours"
              body="We coordinate with agents and build a smart route so you visit all your shortlisted homes back-to-back. No back-and-forth, no wasted weekends."
              checks={[
                "Visit as per your date and time of convenience",
                "Visit notes captured automatically",
                "Reschedule in seconds if plans change",
              ]}
              statBig="1 trip"
              statSmall="all visits"
            />
            <div className="mz-how-visual">
              <div className="mz-sched">
                <div className="mz-sched-panel">
                  <div className="mz-sched-head">
                    <span>Saturday, July 5</span>
                    <span>3 visits · 2.5 hrs total</span>
                  </div>
                  <div className="mz-visit">
                    <div className="mz-visit-date">JUL<b>5</b></div>
                    <div className="mz-visit-info">
                      <div className="mz-visit-title">Viewing Today</div>
                      <div className="mz-visit-sub">Bannerghatta flat at 3:00 PM</div>
                      <div className="mz-visit-link">Add to calendar ›</div>
                    </div>
                  </div>
                  <div className="mz-visit">
                    <div className="mz-visit-date">JUL<b>5</b></div>
                    <div className="mz-visit-info">
                      <div className="mz-visit-title">Viewing Today</div>
                      <div className="mz-visit-sub">Grand Villa, Whitefield at 3:00 PM</div>
                      <div className="mz-visit-link">Add to calendar ›</div>
                    </div>
                  </div>
                  <div className="mz-visit" style={{ marginBottom: 0 }}>
                    <div className="mz-visit-date">JUL<b>6</b></div>
                    <div className="mz-visit-info">
                      <div className="mz-visit-title">Viewing Tomorrow</div>
                      <div className="mz-visit-sub">3 BHK, JP Nagar at 3:00 PM</div>
                      <div className="mz-visit-link">Add to calendar ›</div>
                    </div>
                  </div>
                </div>
                <div className="mz-sched-note">📍 Smart route optimised : see all 3 in one afternoon</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* 4 — Move in happy */}
        <Reveal>
          <div className="mz-how-card" style={{ marginBottom: 0 }}>
            <HowCardText
              num="4"
              title="Move in happy"
              tagline="Tenant to tenant agreement and trust. Safe and no drama."
              body="The process ends with the trust between two verified tenants, where there is no mal intentions involved; just honest reviews and tips to make your story in your new home!"
              checks={[
                "Verified Tenants",
                "Verified listings through broker/tenant",
                "Seamless move in",
                "Calculated decision",
              ]}
              statBig="0"
              statSmall="Confusion"
            />
            <div className="mz-how-visual">
              <div className="mz-movein">
                <div className="mz-allset">
                  <div style={{ fontSize: 16 }}>🎉</div>
                  <div className="mz-allset-title">You're all set!</div>
                  <div className="mz-allset-sub">Move-in date: 15 July 2026</div>
                </div>
                <div className="mz-checkcard">
                  <div className="mz-checkcard-label">HANDOVER CHECKLIST</div>
                  {[
                    "Everything is as shown on platform",
                    "Previous tenant verified",
                    "Keys handed over",
                    "Move-in checklist shared",
                  ].map((row) => (
                    <div key={row} className="mz-checkcard-row">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" width="12" height="12"><path d="M4 12l5 5L20 7" /></svg>
                      {row}
                    </div>
                  ))}
                </div>
                <div className="mz-verified-pill">🛡️ Verified tenant-to-tenant handover</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── The Listing Advantage ── */}
      <section className="mz-wrap" style={{ paddingTop: 88 }}>
        <Reveal><RuleHeading>The Listing Advantage</RuleHeading></Reveal>
        <Reveal delay={0.06}>
          <div className="mz-adv-grid">
            <div className="mz-adv-card" style={{ background: "#8E2F28" }}>
              <h3 className="mz-adv-title">You list your flat</h3>
              <p className="mz-adv-body">Post your home in minutes with photos, rent split, and honest notes — your Trust Passport verification carries straight over.</p>
            </div>
            <div className="mz-adv-card" style={{ background: "#C0473F" }}>
              <h3 className="mz-adv-title">We find your match</h3>
              <p className="mz-adv-body">Our AI matches your flat to verified seekers whose preferences actually fit — no broker spam, no strangers at the door.</p>
            </div>
            <div className="mz-adv-card" style={{ background: "#A93E37" }}>
              <h3 className="mz-adv-title">Instant Credits</h3>
              <p className="mz-adv-body">Get rewarded for passing your flat forward. Earn credits the moment your verified handover completes.</p>
            </div>
            <div className="mz-adv-card" style={{ background: "#701F1A" }}>
              <h3 className="mz-adv-title">We share your profile</h3>
              <p className="mz-adv-body">Your verified tenant profile travels with you — landlords and societies see your history upfront, so approvals move faster.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Testimonials ── */}
      <section className="mz-wrap" style={{ paddingTop: 88 }}>
        <Reveal><RuleHeading>Hear Testimonials</RuleHeading></Reveal>
        <Reveal delay={0.06}>
          <div className="mz-testi-grid">
            <div className="mz-testi-card">
              <div className="mz-testi-head">
                <img className="mz-testi-avatar" src={avatarA} alt="" />
                <div>
                  <div className="mz-testi-name">Aditi R.</div>
                  <div className="mz-testi-stars">★★★★★</div>
                </div>
              </div>
              <p className="mz-testi-quote">
                Found my 2BHK in HSR in a single afternoon. The AI shortlist was scarily accurate — every home matched what I actually asked for.
              </p>
            </div>
            <div className="mz-testi-card">
              <div className="mz-testi-head">
                <img className="mz-testi-avatar" src={avatarB} alt="" />
                <div>
                  <div className="mz-testi-name">Karthik S.</div>
                  <div className="mz-testi-stars">★★★★★</div>
                </div>
              </div>
              <p className="mz-testi-quote">
                Passed my flat to a verified tenant in a week — no broker, no relisting. The handover checklist made move-out completely painless.
              </p>
            </div>
            <div className="mz-testi-card">
              <div className="mz-testi-head">
                <img className="mz-testi-avatar" src={avatarC} alt="" />
                <div>
                  <div className="mz-testi-name">Sneha M.</div>
                  <div className="mz-testi-stars">★★★★☆</div>
                </div>
              </div>
              <p className="mz-testi-quote">
                The smart visit route saved my weekend — saw all three shortlisted homes back-to-back and signed the same evening.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer id="footer" className="mz-footer" style={{ scrollMarginTop: 90 }}>
        <div className="mz-footer-inner">
          <div className="mz-footer-top">
            <div>
              <div className="mz-footer-brand">Mov<span style={{ color: "#ef5a45" }}>Eazy</span></div>
              <p className="mz-footer-tag">
                Bangalore rentals, verified both ways — so nobody has to guess who they're renting from, or to.
              </p>
            </div>
            <div className="mz-footer-cols">
              <div>
                <div className="mz-footer-col-h">PRODUCT</div>
                <a href="#how" className="mz-footer-link">How it works</a>
                <button type="button" className="mz-footer-link" onClick={startFlatSearch}>Find a flat</button>
                <button type="button" className="mz-footer-link" onClick={() => (user ? navigate("/profile") : openLogin(() => navigate("/profile")))}>List my flat</button>
              </div>
              <div>
                <div className="mz-footer-col-h">ACCOUNT</div>
                {user ? (
                  <Link to="/profile" className="mz-footer-link">My profile</Link>
                ) : (
                  <button type="button" className="mz-footer-link" onClick={() => openLogin()}>Sign in</button>
                )}
                <button type="button" className="mz-footer-link" onClick={() => (user ? navigate("/profile") : openLogin(() => navigate("/profile")))}>Dashboard</button>
              </div>
              <div>
                <div className="mz-footer-col-h">COMPANY</div>
                <a href="#footer" className="mz-footer-link">About us</a>
                <a href="mailto:hello@moveeazy.in" className="mz-footer-link">Contact</a>
              </div>
            </div>
          </div>

          <div className="mz-footer-cta">
            <h3 className="mz-footer-cta-h">Ready to find or pass your home?</h3>
            <div className="mz-footer-btns">
              <button type="button" className="mz-footer-btn-solid" onClick={startFlatSearch}>Show me flats</button>
              <button type="button" className="mz-footer-btn-line" onClick={() => (user ? navigate("/profile") : openLogin(() => navigate("/profile")))}>List my Flat</button>
            </div>
          </div>

          <div className="mz-footer-base">
            <span>© 2026 MovEazy · Bengaluru</span>
            <span>Verified both ways.</span>
          </div>
        </div>
      </footer>

      {/* ── "How do you want to search?" choice popup ── */}
      <AnimatePresence>
        {showChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowChoice(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(20, 20, 16, 0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 18 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="mz-choice-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="mz-choice-close" onClick={() => setShowChoice(false)} aria-label="Close">×</button>
              <div className="mz-choice-eyebrow">Find your next home</div>
              <h2 className="mz-choice-title">How do you want to search?</h2>
              <p className="mz-choice-sub">Pick whichever fits how you like to look for a place.</p>

              <div className="mz-choice-grid">
                <button type="button" className="mz-choice-opt mz-choice-opt-plain" onClick={chooseMap}>
                  <span className="mz-choice-icon"><MapPinIcon /></span>
                  <span className="mz-choice-opt-title">Explore map-based listings</span>
                  <span className="mz-choice-opt-body">Browse verified flats on a live map and filter by area yourself.</span>
                  <span className="mz-choice-opt-cta">Open map <ArrowIcon /></span>
                </button>

                <button type="button" className="mz-choice-opt mz-choice-opt-hero" onClick={chooseAgent}>
                  <span className="mz-choice-badge">Recommended</span>
                  <span className="mz-choice-icon"><SparkleIcon /></span>
                  <span className="mz-choice-opt-title">Get my free online agent</span>
                  <span className="mz-choice-opt-body">Answer a few quick questions and let our AI match you to the best verified homes — free.</span>
                  <span className="mz-choice-opt-cta">Start free <ArrowIcon /></span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Broker consultant ── */}
      <AIBroker open={showChatbot} onClose={() => setShowChatbot(false)} />
    </div>
  );
}
