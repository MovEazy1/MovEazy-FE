/**
 * Shared visual language for the CRM.
 *
 * Deliberately NOT the public site's palette. moveazy.co.in is a dark emerald
 * brand experience; this is an internal tool that gets stared at for eight
 * hours, so it's plain white with hairline structure and one accent. Keeping the
 * two apart also means staff never mistake the CRM for a customer-facing screen.
 *
 * Colour carries state here: nothing is tinted unless the tint means something.
 * The single brand thread kept is the teal accent, darkened where it has to
 * carry text on white.
 *
 * Styles live in one injected sheet rather than Tailwind classes because these
 * surfaces aren't in tailwind.config.js, and adding them there would leak an
 * internal tool's palette into the public site's build.
 */

export const C = {
  bg:         "#FFFFFF",  // page ground — plain white
  surface:    "#F7F9F8",  // raised: column heads, cards, table head
  surfaceAlt: "#EDF3F1",  // selection, hover, drop targets
  line:       "#DFE5E3",
  lineSoft:   "#ECF0EF",
  text:       "#10221E",  // near-black, warmed toward the accent rather than pure grey
  textDim:    "#475854",
  textMute:   "#7B918C",
  accent:     "#0E7C68",  // actions and selection — the one thread kept from the site
  accentSoft: "#E6F2EF",
  gold:       "#B0740F",  // darkened from the site's #E8A33D to stay legible on white
  coral:      "#CC3F28",
  wa:         "#128C4A",  // WhatsApp green, darkened for contrast; used nowhere else
};

/** Match score → colour. Deep teal ≥80, teal 60–79, gold 40–59, grey below. */
export function scoreColor(score) {
  if (score >= 80) return "#0B6E5C";
  if (score >= 60) return "#2E9179";
  if (score >= 40) return C.gold;
  return "#94A3A0";
}

const SHEET = `
.crm { background:${C.bg}; color:${C.text}; min-height:100vh;
  font-family:Inter,system-ui,-apple-system,sans-serif; font-size:13px; line-height:1.5; }
.crm *, .crm *::before, .crm *::after { box-sizing:border-box; }
.crm button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; }
/* Component rules below are prefixed with .crm so they outrank that reset:
   ".crm button" is specificity (0,1,1) and a bare ".crm-btn" is (0,1,0), so
   without the prefix the reset wins and every button renders as naked text.
   Don't drop the prefixes. */
.crm input, .crm textarea, .crm select { font:inherit; }
.crm ::-webkit-scrollbar { width:9px; height:9px; }
.crm ::-webkit-scrollbar-thumb { background:#D3DCD9; border-radius:6px; }
.crm ::-webkit-scrollbar-thumb:hover { background:#BCC9C5; }
.crm ::-webkit-scrollbar-track { background:transparent; }

.crm-label { font-size:10px; letter-spacing:.11em; text-transform:uppercase;
  color:${C.textMute}; font-weight:600; }
.crm-num { font-variant-numeric:tabular-nums; }
.crm-mute { color:${C.textMute}; }
.crm-dim { color:${C.textDim}; }

.crm-input { width:100%; background:${C.bg}; border:1px solid ${C.line}; border-radius:7px;
  padding:7px 10px; color:${C.text}; font-size:12.5px; outline:none; }
.crm-input:focus { border-color:${C.accent}; box-shadow:0 0 0 3px ${C.accentSoft}; }
.crm-input::placeholder { color:${C.textMute}; }
.crm-input:disabled { background:${C.surface}; color:${C.textDim}; }
textarea.crm-input { resize:vertical; line-height:1.55; }

.crm .crm-btn { display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  font-size:12px; font-weight:600; padding:6px 12px; border-radius:8px;
  border:1px solid ${C.line}; background:${C.bg}; color:${C.textDim};
  transition:border-color .12s, color .12s, background .12s; }
.crm .crm-btn:hover:not(:disabled) { border-color:${C.textMute}; color:${C.text}; background:${C.surface}; }
.crm .crm-btn:disabled { opacity:.45; cursor:not-allowed; }
.crm .crm-btn:focus-visible { outline:2px solid ${C.accent}; outline-offset:2px; }
.crm .crm-btn--primary { background:${C.accent}; border-color:${C.accent}; color:#fff; }
.crm .crm-btn--primary:hover:not(:disabled) { background:#0B6353; border-color:#0B6353; color:#fff; }
.crm .crm-btn--wa { background:${C.wa}; border-color:${C.wa}; color:#fff; }
.crm .crm-btn--wa:hover:not(:disabled) { background:#0E7A40; border-color:#0E7A40; color:#fff; }
.crm .crm-btn--call { background:${C.bg}; border-color:${C.accent}; color:${C.accent}; }
.crm .crm-btn--call:hover:not(:disabled) { background:${C.accentSoft}; border-color:${C.accent}; color:${C.accent}; }
.crm .crm-btn--danger { border-color:#E8C4BC; color:${C.coral}; }
.crm .crm-btn--danger:hover:not(:disabled) { border-color:${C.coral}; background:#FBEEEB; color:${C.coral}; }
.crm .crm-btn--sm { font-size:10.5px; padding:3px 8px; border-radius:6px; font-weight:600; }

.crm .crm-chip { display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  font-size:11.5px; padding:3px 10px; border-radius:999px; border:1px solid ${C.line};
  background:${C.bg}; color:${C.textDim}; transition:border-color .12s, color .12s, background .12s; }
.crm .crm-chip:hover { border-color:${C.textMute}; background:${C.surface}; }
.crm .crm-chip--on { border-color:${C.accent}; color:${C.accent}; background:${C.accentSoft}; font-weight:600; }
.crm .crm-chip--bad { border-color:#E8C4BC; color:${C.coral}; background:#FBEEEB; }
.crm .crm-chip--warn { border-color:#E7D3AE; color:${C.gold}; background:#FBF3E4; }
.crm .crm-chip:focus-visible { outline:2px solid ${C.accent}; outline-offset:2px; }

.crm-card { border:1px solid ${C.line}; border-radius:10px; background:${C.bg}; padding:12px; }

.crm-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:5px 0; }
.crm-row + .crm-row { border-top:1px solid ${C.lineSoft}; }

.crm .crm-lead { width:100%; text-align:left; padding:9px 12px; border-bottom:1px solid ${C.lineSoft};
  display:flex; flex-direction:column; gap:3px; }
.crm .crm-lead:hover { background:${C.surface}; }
.crm .crm-lead--on { background:${C.accentSoft}; box-shadow:inset 2px 0 0 ${C.accent}; }

.crm .crm-rail-item { width:38px; height:38px; border-radius:9px; display:grid; place-items:center;
  font-size:10px; font-weight:700; letter-spacing:.04em; color:${C.textMute}; }
.crm .crm-rail-item:hover { background:${C.surfaceAlt}; color:${C.text}; }
.crm .crm-rail-item--on { background:${C.accent}; color:#fff; }

.crm-table { border-collapse:collapse; width:100%; font-size:12.5px; }
.crm-table th { text-align:left; padding:8px 12px; background:${C.surface};
  font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:${C.textMute};
  font-weight:600; border-bottom:1px solid ${C.line}; white-space:nowrap; }
.crm-table td { padding:8px 12px; border-bottom:1px solid ${C.lineSoft}; }
.crm-table tr:last-child td { border-bottom:0; }
.crm-table tbody tr:hover { background:${C.surface}; }

.crm-scroll { overflow-y:auto; overflow-x:hidden; }
.crm-col { display:flex; flex-direction:column; min-width:0; border-right:1px solid ${C.line}; }
.crm-col:last-child { border-right:0; }
.crm-colhead { display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:9px 12px; border-bottom:1px solid ${C.line}; background:${C.surface}; flex:none; }

.crm .crm-step { font-size:11px; padding:4px 10px; border:1px solid ${C.line}; color:${C.textMute};
  background:${C.bg}; white-space:nowrap; }
.crm .crm-step:first-child { border-radius:7px 0 0 7px; }
.crm .crm-step:last-child { border-radius:0 7px 7px 0; }
.crm .crm-step + .crm-step { border-left:0; }
.crm .crm-step:hover:not(:disabled) { color:${C.text}; background:${C.surface}; }
.crm .crm-step--on { background:${C.accent}; color:#fff; border-color:${C.accent}; font-weight:700; }
.crm .crm-step--win { color:${C.accent}; border-color:#B7D8CF; }
.crm .crm-step--out { color:${C.textMute}; border-color:${C.line}; }

@media (prefers-reduced-motion: reduce) { .crm * { transition:none !important; animation:none !important; } }
`;

export function CrmStyles() {
  return <style>{SHEET}</style>;
}

/* ── Primitives ───────────────────────────────────────────────────────────── */

export function Chip({ on, tone, children, ...rest }) {
  const cls = ["crm-chip", on && "crm-chip--on", tone && `crm-chip--${tone}`].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Btn({ variant, sm, children, ...rest }) {
  const cls = ["crm-btn", variant && `crm-btn--${variant}`, sm && "crm-btn--sm"].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function TempDot({ color, size = 8 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none",
        display: "inline-block", background: color || C.line,
      }}
    />
  );
}

/** Match score as a ring, so a column of matches reads as a column of gauges. */
export function ScoreRing({ score = 0, size = 42 }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = scoreColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% match`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.lineSoft} strokeWidth="4" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={`${(circ * pct) / 100} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2} y={size / 2 + 3.5} textAnchor="middle" fill={color}
        fontFamily="ui-monospace, SFMono-Regular, monospace" fontSize="11" fontWeight="600"
      >
        {pct}
      </text>
    </svg>
  );
}

export function Empty({ children, pad = 40 }) {
  return (
    <p style={{ color: C.textMute, fontSize: 13, textAlign: "center", padding: `${pad}px 16px`, margin: 0 }}>
      {children}
    </p>
  );
}

export function Loading({ label = "Loading…" }) {
  return <Empty>{label}</Empty>;
}

/** Non-blocking status line — the CRM never interrupts with a modal for these. */
export function Toast({ message, tone = "ok" }) {
  if (!message) return null;
  const color = tone === "error" ? C.coral : C.accent;
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
        background: C.text, border: `1px solid ${C.text}`, color: "#fff",
        padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
        zIndex: 90, maxWidth: "90vw", boxShadow: "0 10px 30px rgba(16,34,30,.22)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      {message}
    </div>
  );
}

export const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

export const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

export const relTime = (d) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 31) return `${days}d ago`;
  return shortDate(d);
};
