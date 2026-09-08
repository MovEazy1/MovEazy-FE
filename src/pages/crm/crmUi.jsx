/**
 * Shared visual language for the CRM.
 *
 * The public site's emerald palette, pushed darker and denser — this screen is
 * stared at for eight hours, not scrolled once. Colour carries state: nothing is
 * tinted unless the tint means something.
 *
 * Styles live in one injected sheet rather than Tailwind classes because the CRM
 * uses a dark surface set that isn't in tailwind.config.js, and duplicating it
 * there would leak an internal tool's palette into the public site's build.
 */

export const C = {
  ink: "#04211D",
  ink2: "#0B1A17",
  panel: "#0A2B25",
  panel2: "#0E332C",
  line: "#17453C",
  lineSoft: "#103B33",
  teal: "#0E7C68",
  mint: "#5EEAD4",
  cream: "#F4F2ED",
  creamDim: "#B9CFCA",
  creamMute: "#7FA69E",
  gold: "#E8A33D",
  coral: "#EF5A45",
  wa: "#25D366",
};

/** Match score → colour. Mint ≥80, teal 60–79, gold 40–59, hairline below. */
export function scoreColor(score) {
  if (score >= 80) return C.mint;
  if (score >= 60) return C.teal;
  if (score >= 40) return C.gold;
  return C.creamMute;
}

const SHEET = `
.crm { background:${C.ink}; color:${C.cream}; min-height:100vh;
  font-family:Inter,system-ui,-apple-system,sans-serif; font-size:13px; line-height:1.5; }
.crm *, .crm *::before, .crm *::after { box-sizing:border-box; }
.crm button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; }
.crm input, .crm textarea, .crm select { font:inherit; }
.crm ::-webkit-scrollbar { width:9px; height:9px; }
.crm ::-webkit-scrollbar-thumb { background:${C.line}; border-radius:6px; }
.crm ::-webkit-scrollbar-track { background:transparent; }

.crm-label { font-size:10px; letter-spacing:.11em; text-transform:uppercase;
  color:${C.creamMute}; font-weight:600; }
.crm-num { font-variant-numeric:tabular-nums; }
.crm-mute { color:${C.creamMute}; }
.crm-dim { color:${C.creamDim}; }

.crm-input { width:100%; background:${C.ink}; border:1px solid ${C.line}; border-radius:7px;
  padding:7px 10px; color:${C.cream}; font-size:12.5px; outline:none; }
.crm-input:focus { border-color:${C.mint}; box-shadow:0 0 0 2px rgba(94,234,212,.14); }
.crm-input::placeholder { color:${C.creamMute}; }
textarea.crm-input { resize:vertical; line-height:1.55; }

.crm-btn { display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  font-size:12px; font-weight:600; padding:6px 12px; border-radius:8px;
  border:1px solid ${C.line}; background:${C.panel}; color:${C.creamDim};
  transition:border-color .12s, color .12s, background .12s; }
.crm-btn:hover:not(:disabled) { border-color:${C.creamMute}; color:${C.cream}; }
.crm-btn:disabled { opacity:.45; cursor:not-allowed; }
.crm-btn:focus-visible { outline:2px solid ${C.mint}; outline-offset:2px; }
.crm-btn--primary { background:${C.teal}; border-color:${C.teal}; color:#04211D; }
.crm-btn--primary:hover:not(:disabled) { background:${C.mint}; border-color:${C.mint}; color:#04211D; }
.crm-btn--wa { background:${C.wa}; border-color:${C.wa}; color:#04211D; }
.crm-btn--wa:hover:not(:disabled) { background:#3ee87c; border-color:#3ee87c; color:#04211D; }
.crm-btn--call { background:transparent; border-color:${C.mint}; color:${C.mint}; }
.crm-btn--call:hover:not(:disabled) { background:rgba(94,234,212,.1); color:${C.mint}; }
.crm-btn--danger { border-color:rgba(239,90,69,.5); color:${C.coral}; }
.crm-btn--danger:hover:not(:disabled) { border-color:${C.coral}; background:rgba(239,90,69,.1); color:${C.coral}; }
.crm-btn--sm { font-size:10.5px; padding:3px 8px; border-radius:6px; font-weight:600; }

.crm-chip { display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  font-size:11.5px; padding:3px 10px; border-radius:999px; border:1px solid ${C.line};
  background:${C.panel}; color:${C.creamDim}; transition:border-color .12s, color .12s; }
.crm-chip:hover { border-color:${C.creamMute}; }
.crm-chip--on { border-color:${C.mint}; color:${C.mint}; background:rgba(94,234,212,.09); }
.crm-chip--bad { border-color:${C.coral}; color:${C.coral}; background:rgba(239,90,69,.1); }
.crm-chip--warn { border-color:${C.gold}; color:${C.gold}; background:rgba(232,163,61,.1); }
.crm-chip:focus-visible { outline:2px solid ${C.mint}; outline-offset:2px; }

.crm-card { border:1px solid ${C.line}; border-radius:10px; background:${C.panel}; padding:12px; }

.crm-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:5px 0; }
.crm-row + .crm-row { border-top:1px solid ${C.lineSoft}; }

.crm-lead { width:100%; text-align:left; padding:9px 12px; border-bottom:1px solid ${C.lineSoft};
  display:flex; flex-direction:column; gap:3px; }
.crm-lead:hover { background:${C.panel}; }
.crm-lead--on { background:${C.panel2}; box-shadow:inset 2px 0 0 ${C.mint}; }

.crm-rail-item { width:38px; height:38px; border-radius:9px; display:grid; place-items:center;
  font-size:10px; font-weight:700; letter-spacing:.04em; color:${C.creamMute}; }
.crm-rail-item:hover { background:${C.panel}; color:${C.cream}; }
.crm-rail-item--on { background:${C.teal}; color:#04211D; }

.crm-table { border-collapse:collapse; width:100%; font-size:12.5px; }
.crm-table th { text-align:left; padding:8px 12px; background:${C.panel};
  font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:${C.creamMute};
  font-weight:600; border-bottom:1px solid ${C.line}; white-space:nowrap; }
.crm-table td { padding:8px 12px; border-bottom:1px solid ${C.lineSoft}; }
.crm-table tr:last-child td { border-bottom:0; }
.crm-table tbody tr:hover { background:${C.panel}; }

.crm-scroll { overflow-y:auto; overflow-x:hidden; }
.crm-col { display:flex; flex-direction:column; min-width:0; border-right:1px solid ${C.line}; }
.crm-col:last-child { border-right:0; }
.crm-colhead { display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:9px 12px; border-bottom:1px solid ${C.line}; background:${C.panel}; flex:none; }

.crm-step { font-size:11px; padding:4px 10px; border:1px solid ${C.line}; color:${C.creamMute};
  background:${C.ink2}; white-space:nowrap; }
.crm-step:first-child { border-radius:7px 0 0 7px; }
.crm-step:last-child { border-radius:0 7px 7px 0; }
.crm-step + .crm-step { border-left:0; }
.crm-step:hover { color:${C.cream}; }
.crm-step--on { background:${C.mint}; color:#04211D; border-color:${C.mint}; font-weight:700; }
.crm-step--win { color:${C.mint}; border-color:rgba(94,234,212,.42); }
.crm-step--out { color:#9FB5B0; border-color:rgba(159,181,176,.4); }

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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.line} strokeWidth="4" />
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
    <p style={{ color: C.creamMute, fontSize: 13, textAlign: "center", padding: `${pad}px 16px`, margin: 0 }}>
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
  const color = tone === "error" ? C.coral : C.mint;
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
        background: C.panel2, border: `1px solid ${color}`, color,
        padding: "9px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
        zIndex: 90, maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.45)",
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
