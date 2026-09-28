/**
 * About MovEazy — the story as a journey, not an essay: where the founders
 * came from, the question that wouldn't leave them alone, what they believe,
 * and where it's going. Every fact is the one the page has always carried,
 * drawn from the founders' own profiles; the portraits are their own photos,
 * resized for the web (founder-*.jpg, from yatharthdesk.png and aman.png).
 *
 * "Find my home" hands over to the homepage's one search flow (/?search=1).
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Home, Users } from "lucide-react";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import { LandingStyles } from "./landing/landingKit";
import { HighlightScene, SITE_CSS, SiteFooter, useScrollScene } from "./home/homeKit";
import yatharthImg from "../assets/images/founder-yatharth.jpg";
import amanImg from "../assets/images/founder-aman.jpg";
import logoOnDark from "../assets/logo/moveazy-logo-mint-dark.png";

const CHAPTERS = [
  ["IIT Kanpur", "Two roommates.", "They built Zero Carbon together before they built anything else."],
  ["The safe path", "Big careers.", "BCG, Schlumberger, Masai. Everest Carbon, Kreo."],
  ["The pattern", "Weeks lost, every move.", "Every friend who moved cities lost weekends, deposits and patience to house hunting."],
  ["The question", "Why is finding a home in 2026 still this broken?", ""],
  ["Today", "MovEazy.", "India’s first Speed-Renting Platform. Bengaluru first."],
];

const FOUNDERS = [
  { img: yatharthImg, pos: "50% 22%", name: "Yatharth Singh", path: ["IIT Kanpur ’24", "BCG", "Schlumberger", "Founder’s Office, Masai"],
    line: "Invest where it compounds. Don’t wait for the perfect moment." },
  { img: amanImg, pos: "50% 30%", name: "Aman Singh Solanki", path: ["IIT Kanpur ’24", "Zero Carbon", "Everest Carbon", "Growth, Kreo"],
    line: "Technology should reduce effort — not just digitise a broken process." },
];

const BELIEFS = [
  "Brokers aren’t the problem. They’re part of the answer.",
  "AI should empower people — not replace them.",
  "We want to eliminate bad house hunting.",
  "Only problems worth solving.",
];

/** The origin, one chapter at a time; the line fills and each stop lights as you pass it. */
function Origin() {
  const ref = useRef(null);
  const [at, setAt] = useState(-1);
  useScrollScene(ref, (p) => setAt((a) => { const n = Math.floor(p * CHAPTERS.length * 1.02) - 0; return n === a ? a : n; }));
  return (
    <section ref={ref} className="ab-origin" style={{ height: `${CHAPTERS.length * 55 + 80}vh` }}>
      <div className="th-sticky ab-origin-in">
        <div className="th-wrap ab-origin-grid">
          <div>
            <p className="th-kicker">The story</p>
            <h2 className="th-h2">How it <span>started.</span></h2>
          </div>
          <ol className="ab-chapters" style={{ "--fill": `${Math.max(0, Math.min(1, (at + 0.5) / (CHAPTERS.length - 0.5))) * 100}%` }}>
            {CHAPTERS.map(([k, h, d], i) => (
              <li key={k} className={`${i <= at ? "on" : ""}${i === 3 ? " q" : ""}${i === CHAPTERS.length - 1 ? " last" : ""}`}>
                <span className="ab-node" />
                <em>{k}</em>
                {i === CHAPTERS.length - 1 ? <b><img src={logoOnDark} alt="MovEazy" /></b> : <b>{h}</b>}
                {d && <p>{d}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default function About() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { openLogin } = useLoginModal();
  const find = () => navigate("/?search=1");
  const list = () => { if (loading) return; user ? navigate("/list-my-flat") : openLogin(() => navigate("/list-my-flat")); };

  return (
    <div className="lp lp--tenant th">
      <LandingStyles />
      <style>{SITE_CSS + CSS}</style>
      <MovEazyNav active="about" transparentAtTop onFindFlat={find} />

      <header className="ab-hero">
        <div className="th-wrap ab-hero-grid">
          <div>
            <span className="ab-pill">About MovEazy</span>
            <h1 className="ab-h1">We’re fixing<br />how <span>India rents.</span></h1>
            <p className="ab-lead">Two IIT Kanpur roommates. One stubborn question.</p>
          </div>
          <div className="ab-portraits" aria-hidden>
            {FOUNDERS.map((f, i) => (
              <figure key={f.name} className={`ab-portrait ab-portrait--${i}`}>
                <img src={f.img} alt="" style={{ objectPosition: f.pos }} />
                <figcaption>{f.name.split(" ")[0]}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </header>

      <Origin />

      <section className="ab-founders">
        <div className="th-wrap">
          <p className="th-kicker">The founders</p>
          <div className="ab-founder-grid">
            {FOUNDERS.map((f) => (
              <article key={f.name} className="ab-founder">
                <div className="ab-founder-img"><img src={f.img} alt={`${f.name}, co-founder of MovEazy`} loading="lazy" style={{ objectPosition: f.pos }} /></div>
                <div className="ab-founder-body">
                  <span className="ab-role">Co-founder</span>
                  <h3>{f.name}</h3>
                  <div className="ab-path">{[...f.path, "MovEazy"].map((p, i, a) => <span key={p} className={i === a.length - 1 ? "now" : ""}>{p}</span>)}</div>
                  <p>“{f.line}”</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <HighlightScene kicker="What we believe" lines={BELIEFS} tall={260} />

      <section className="ab-vision">
        <div className="th-wrap">
          <p className="th-kicker">Where we’re going</p>
          <h2 className="th-h2">Not another listing site.<br /><span>The intelligence layer for India’s rentals.</span></h2>
          <div className="ab-doors">
            <a href="#" onClick={(e) => { e.preventDefault(); find(); }}><span className="ic"><Home size={22} /></span><em>Renters</em><b>Find a home</b><ArrowRight size={20} /></a>
            <a href="https://owners.moveazy.co.in/"><span className="ic"><Building2 size={22} /></span><em>Owners</em><b>MovEazy for owners</b><ArrowRight size={20} /></a>
            <a href="https://partners.moveazy.co.in/"><span className="ic"><Users size={22} /></span><em>Brokers</em><b>MovEazy Partners</b><ArrowRight size={20} /></a>
          </div>
          <p className="ab-honest">We’re building toward it — one city, one move at a time.</p>
        </div>
      </section>

      <SiteFooter onFind={find} onList={list} />
    </div>
  );
}

const CSS = `
.ab-hero { color: #F1F6F4; background: radial-gradient(90% 90% at 80% 10%, #0B463D 0%, #052723 50%, #04211D 100%); padding: 140px 0 110px; overflow: hidden; }
.ab-hero-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 40px; align-items: center; }
.ab-pill { display: inline-block; font-size: 13px; font-weight: 700; color: #5EEAD4; padding: 8px 14px; border-radius: 999px; background: rgba(94,234,212,.08); border: 1px solid rgba(94,234,212,.3); }
.ab-h1 { font-size: clamp(44px, 6.2vw, 84px); line-height: .98; letter-spacing: -.045em; font-weight: 800; margin: 24px 0 22px; color: #F1F6F4; }
.ab-h1 span { color: #5EEAD4; }
.ab-lead { font-size: clamp(18px, 1.8vw, 22px); color: #A9C2BC; margin: 0; }
.ab-portraits { position: relative; height: 470px; }
.ab-portrait { position: absolute; margin: 0; width: 250px; background: #EFEAE1; padding: 10px 10px 0; border-radius: 6px; box-shadow: 0 40px 80px rgba(0,0,0,.45); }
.th .ab-portrait img { display: block; width: 100%; height: 290px; object-fit: cover; border-radius: 3px; }
.ab-portrait figcaption { font-family: 'Caveat', cursive; font-size: 24px; color: #1b1a17; padding: 8px 4px 12px; }
.ab-portrait--0 { left: 4%; top: 30px; transform: rotate(-5deg); }
.ab-portrait--1 { right: 2%; top: 110px; transform: rotate(6deg); }

.ab-origin { background: #04211D; color: #F1F6F4; }
.ab-origin .th-h2 { color: #F1F6F4; }
.ab-origin .th-h2 span { color: #5EEAD4; }
.ab-origin .th-kicker { color: #5EEAD4; }
.ab-origin-in { display: flex; align-items: center; background: radial-gradient(80% 90% at 20% 50%, #0A3A33, #04211D 70%); }
.ab-origin-grid { display: grid; grid-template-columns: .8fr 1.2fr; gap: 40px; align-items: center; width: 100%; }
.ab-chapters { list-style: none; margin: 0; padding: 0 0 0 38px; position: relative; display: grid; gap: 26px; }
.ab-chapters::before, .ab-chapters::after { content: ""; position: absolute; left: 9px; top: 8px; width: 2px; border-radius: 99px; }
.ab-chapters::before { bottom: 8px; background: rgba(255,255,255,.1); }
.ab-chapters::after { height: var(--fill); max-height: calc(100% - 16px); background: linear-gradient(#5EEAD4, #F5C451); transition: height .4s ease; }
.ab-chapters li { position: relative; opacity: .28; transform: translateX(10px); transition: opacity .5s ease, transform .6s cubic-bezier(.16,1,.3,1); }
.ab-chapters li.on { opacity: 1; transform: none; }
.ab-node { position: absolute; left: -38px; top: 4px; width: 20px; height: 20px; border-radius: 99px; background: #04211D; border: 2px solid rgba(255,255,255,.25); transition: all .4s; z-index: 1; }
.ab-chapters li.on .ab-node { border-color: #5EEAD4; box-shadow: 0 0 0 6px rgba(94,234,212,.14); }
.ab-chapters li.last.on .ab-node { border-color: #F5C451; box-shadow: 0 0 0 6px rgba(245,196,81,.16); }
.ab-chapters em { display: block; font-style: normal; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #5EEAD4; }
.ab-chapters b { display: block; font-size: clamp(22px, 2.4vw, 32px); letter-spacing: -.025em; margin-top: 4px; line-height: 1.15; }
.ab-chapters li.q b { font-style: italic; font-size: clamp(24px, 2.8vw, 38px); color: #F5C451; }
.th .ab-chapters b img { height: clamp(30px, 3vw, 42px); width: auto; display: block; }
.ab-chapters p { margin: 6px 0 0; font-size: 15.5px; line-height: 1.5; color: #A9C2BC; max-width: 520px; }

.ab-founders { background: var(--cream); padding: 120px 0; }
.ab-founder-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.ab-founder { background: #fff; border: 1px solid var(--line); border-radius: 28px; overflow: hidden; display: grid; grid-template-columns: 200px 1fr; }
.ab-founder-img { background: #DCE3E1; }
.th .ab-founder-img img { width: 100%; height: 100%; min-height: 280px; object-fit: cover; display: block; }
.ab-founder-body { padding: 28px 26px; display: flex; flex-direction: column; }
.ab-role { font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #0E7C68; }
.ab-founder h3 { font-size: 26px; letter-spacing: -.025em; margin: 6px 0 16px; color: #04211D; }
.ab-path { display: flex; flex-wrap: wrap; gap: 6px; }
.ab-path span { font-size: 12.5px; font-weight: 700; padding: 6px 10px; border-radius: 99px; background: #F1F4F3; color: #3D4B47; }
.ab-path span.now { background: #04211D; color: #5EEAD4; }
.ab-founder p { margin: auto 0 0; padding-top: 18px; font-size: 15.5px; line-height: 1.5; color: var(--dim); font-style: italic; }

.ab-vision { background: #04211D; color: #F1F6F4; padding: 120px 0; }
.ab-vision .th-h2 { color: #F1F6F4; }
.ab-vision .th-h2 span { color: #F5C451; }
.ab-vision .th-kicker { color: #5EEAD4; }
.ab-doors { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 10px; }
.ab-doors a { position: relative; display: block; padding: 26px 24px 28px; border-radius: 22px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  color: #F1F6F4; text-decoration: none; transition: background .2s, transform .2s; }
.ab-doors a:hover { background: rgba(255,255,255,.09); transform: translateY(-2px); }
.ab-doors .ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: rgba(94,234,212,.12); color: #5EEAD4; }
.ab-doors em { display: block; font-style: normal; margin-top: 22px; font-size: 13px; font-weight: 700; color: #8FB0A9; }
.ab-doors b { display: block; font-size: 22px; letter-spacing: -.02em; margin-top: 2px; }
.ab-doors a > svg:last-child { position: absolute; right: 22px; bottom: 28px; color: #5EEAD4; }
.ab-honest { margin: 28px 0 0; font-size: 14.5px; color: #8FB0A9; }

@media (max-width: 1000px) {
  .ab-hero { padding: 120px 0 70px; }
  .ab-hero-grid { grid-template-columns: 1fr; }
  .ab-portraits { height: 360px; }
  .ab-portrait { width: 190px; }
  .th .ab-portrait img { height: 220px; }
  .ab-portrait--0 { left: 2%; top: 10px; }
  .ab-portrait--1 { right: 2%; top: 80px; }
  .ab-origin-grid { grid-template-columns: 1fr; gap: 10px; }
  .ab-origin-grid .th-h2 { font-size: 34px; margin-bottom: 10px; }
  .ab-chapters { gap: 18px; }
  .ab-chapters p { font-size: 14px; }
  .ab-founder-grid { grid-template-columns: 1fr; }
  .ab-doors { grid-template-columns: 1fr; }
  .ab-founders, .ab-vision { padding: 80px 0; }
}
@media (max-width: 520px) {
  .ab-founder { grid-template-columns: 1fr; }
  .th .ab-founder-img img { min-height: 0; height: 300px; }
  .ab-portrait { width: 160px; }
  .th .ab-portrait img { height: 190px; }
}
`;
