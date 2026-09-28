/**
 * What the tenant marketing pages share — home, How it works, About: the
 * tenant brand tokens, the phone frame that shows the app at a true 375px, the
 * scroll-scene hook behind every sticky story, and the footer.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Progress 0→1 of a tall section scrolling past its sticky child. */
export function useScrollScene(ref, onProgress) {
  const cb = useRef(onProgress);
  cb.current = onProgress;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      cb.current(clamp(span > 0 ? -r.top / span : 1));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [ref]);
}

/** A phone whose screen is laid out at a true 375px and scaled to fit. */
export function Phone({ children, className = "" }) {
  return (
    <div className={`th-phone ${className}`} aria-hidden>
      <div className="th-scr"><div className="th-scr-in">{children}</div></div>
    </div>
  );
}

/**
 * Lines that light up word by word as the section scrolls past — the home
 * page's "old way of renting", About's beliefs. `big` is the index of the one
 * line set larger, in italics.
 */
export function HighlightScene({ kicker, lines, big = -1, tall = 300 }) {
  const ref = useRef(null);
  const words = useRef([]);
  useScrollScene(ref, (p) => {
    const ws = words.current;
    const lit = reduced() ? ws.length + 4 : clamp(p / 0.85) * (ws.length + 4) - 2;
    ws.forEach((w, i) => { if (w) w.style.color = lit - i >= 0 ? "#0B1A17" : lit - i > -2.5 ? "#9DAAA6" : "#DCE3E1"; });
  });
  let n = 0;
  return (
    <section ref={ref} className="th-story" style={{ height: `${tall}vh` }}>
      <div className="th-sticky th-story-in">
        <div className="th-wrap">
          {kicker && <p className="th-kicker">{kicker}</p>}
          {lines.map((line, li) => (
            <p key={li} className={`th-story-line${li === big ? " big" : ""}`}>
              {line.split(" ").map((w, wi) => {
                const i = n++;
                return <span key={wi} ref={(el) => { words.current[i] = el; }}>{w} </span>;
              })}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/** onFind / onList: the page's own "find a home" and "list a flat" flows. */
export function SiteFooter({ onFind, onList }) {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-top">
          <div>
            <a href="#top" className="lp-brand" aria-label="MovEazy"><img className="lp-logo-img" src={logoOnDark} alt="MovEazy" width="169" height="40" /></a>
            <p>India’s first Speed-Renting Platform. Bengaluru first.</p>
          </div>
          <div><h4>Renters</h4><ul>
            <li><a href="#" onClick={(e) => { e.preventDefault(); onFind(); }}>Find a home</a></li>
            <li><Link to="/how-it-works">How it works</Link></li>
            <li><Link to="/about">About us</Link></li>
          </ul></div>
          <div><h4>Owners &amp; brokers</h4><ul>
            <li><a href="#" onClick={(e) => { e.preventDefault(); onList(); }}>List a flat</a></li>
            <li><a href="https://owners.moveazy.co.in/">MovEazy for owners</a></li>
            <li><a href="https://partners.moveazy.co.in/">MovEazy for brokers</a></li>
          </ul></div>
          <div><h4>Legal</h4><ul>
            <li><Link to="/terms">Terms</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms#refunds">Refunds</Link></li>
          </ul></div>
        </div>
        <div className="lp-footer-bottom"><span>© {new Date().getFullYear()} MovEazy. All rights reserved.</span><span>Made in Bengaluru</span></div>
      </div>
    </footer>
  );
}

export const SITE_CSS = `
.lp--tenant { --deep:#04211D; --deep2:#02140E; --acc:#0E7C68; --accl:#E4F6F1; --gold:#5EEAD4; --gold2:#E4F6F1; --gold3:#0E7C68;
  --cream:#F4F2ED; --line:#E4E1D8; --ink:#0B1A17; --dim:#5C6B67; font-family: 'Manrope', Inter, system-ui, sans-serif; }
.lp.th { background: var(--cream); overflow-x: clip; }
.th-wrap { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.th-sticky { position: sticky; top: 0; height: 100vh; overflow: hidden; }
.th-kicker { font-size: 12.5px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; color: var(--acc); margin: 0 0 18px; }
.th-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 999px; font: inherit; font-weight: 800;
  font-size: 16.5px; padding: 0 28px; min-height: 56px; cursor: pointer; text-decoration: none; transition: transform .12s ease, box-shadow .2s ease, background .2s; }
.th-btn:active { transform: translateY(1px); }
.th-btn--mint { background: #5EEAD4; color: #04211D; box-shadow: 0 14px 34px rgba(94,234,212,.3); }
.th-btn--mint:hover { box-shadow: 0 18px 40px rgba(94,234,212,.42); }
.th-btn--ghost { background: transparent; color: #F1F6F4; border: 1.5px solid rgba(255,255,255,.26); }
.th-btn--ghost:hover { border-color: rgba(255,255,255,.5); }
.th-btn--ink { background: #04211D; color: #fff; min-height: 46px; padding: 0 20px; font-size: 15px; }
.th-btn--lg { min-height: 62px; font-size: 18px; padding: 0 36px; }
.th-phone { --w: 320px; --h: 660px; width: var(--w); height: var(--h); border-radius: 48px; padding: 10px; background: #0C0F0E; position: relative; flex: none;
  box-shadow: 0 50px 100px rgba(0,0,0,.4), inset 0 0 0 2px #2A2F2D; }
.th-phone::before { content: ""; position: absolute; top: 18px; left: 50%; transform: translateX(-50%); width: 90px; height: 24px; border-radius: 99px; background: #0C0F0E; z-index: 5; }
.th-scr { width: calc(var(--w) - 20px); height: calc(var(--h) - 20px); border-radius: 38px; overflow: hidden; position: relative; background: #fff; color: #111827; pointer-events: none; }
.th-scr-in { position: absolute; top: 0; left: 0; width: 375px; max-width: none; height: calc((var(--h) - 20px) / var(--s, .8)); text-align: left;
  transform: scale(var(--s, .8)); transform-origin: 0 0; overflow: hidden; }
.th-screen { position: absolute; inset: 0; opacity: 0; transform: translateY(18px) scale(.98); transition: opacity .45s ease, transform .55s cubic-bezier(.16,1,.3,1); }
.th-screen.on { opacity: 1; transform: none; }
.th-h2 { font-size: clamp(38px, 5vw, 66px); line-height: 1; letter-spacing: -.04em; font-weight: 800; color: #04211D; margin: 0 0 34px; }
.th-h2 span { color: var(--acc); }
.th-story { height: 300vh; background: #fff; margin-top: 70px; }
.th-story-in { display: flex; align-items: center; background: #fff; }
.th-story-line { font-weight: 800; font-size: clamp(22px, 2.6vw, 38px); line-height: 1.32; letter-spacing: -.02em; margin: 0 0 14px; max-width: 980px; }
.th-story-line.big { font-style: italic; font-size: clamp(28px, 3.8vw, 56px); line-height: 1.2; margin: 6px 0 20px; }
.th-story-line span { color: #DCE3E1; transition: color .25s ease; }
@media (max-width: 520px) { .th-story { height: 260vh !important; } }
`;
