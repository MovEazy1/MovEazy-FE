/**
 * The next upload milestone, one at a time (lib/partnerPool.js): 3 complete
 * flats → 10 fresh leads, then 10 ("65% more leads"), then 20 → 20 fresh
 * leads, then the 5-a-day streak. On top of My inventory and on the screen
 * after an upload. Calm by design: one line, one bar — never the whole ladder.
 */
import { Flame, Gift, TrendingUp } from "lucide-react";
import { nextStep } from "../../lib/partnerPool";

export default function MilestoneBar({ progress, dark = false }) {
  const s = nextStep(progress);
  if (!s) return null;
  const Icon = s.streak != null ? Flame : s.reward ? Gift : TrendingUp;
  return (
    <div className={`mb${dark ? " mb--dark" : ""}`} role="status">
      <style>{CSS}</style>
      <span className="mb-ic" aria-hidden><Icon size={18} /></span>
      <span className="mb-txt">
        <b>{s.title}</b>
        <span className="mb-bar" aria-hidden><i style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} /></span>
        <span className="mb-body">{s.body}</span>
      </span>
      <span className="mb-n">{s.value}/{s.max}</span>
    </div>
  );
}

const CSS = `
.mb { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: #fff; border: 1px solid var(--line); }
.mb-ic { flex: none; width: 36px; height: 36px; border-radius: 99px; background: #FEF7E6; color: #B8860B; display: grid; place-items: center; }
.mb-txt { flex: 1; min-width: 0; display: grid; gap: 5px; }
.mb-txt b { font-size: 14px; line-height: 1.3; }
.mb-bar { display: block; height: 7px; border-radius: 99px; background: #EFECE6; overflow: hidden; }
.mb-bar i { display: block; height: 100%; background: var(--goldg); border-radius: 99px; transition: width .6s ease; }
.mb-body { font-size: 12px; color: var(--dim); line-height: 1.4; }
.mb-n { flex: none; font-size: 13px; font-weight: 800; color: var(--ink); }
.mb--dark { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.18); color: #fff; }
.mb--dark .mb-body { color: rgba(255,255,255,.75); }
.mb--dark .mb-n { color: #F0CF7C; }
.mb--dark .mb-bar { background: rgba(255,255,255,.18); }
`;
