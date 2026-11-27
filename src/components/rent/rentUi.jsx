/**
 * Shared rent-agreement UI: styles, a status badge, a progress strip, and a
 * signature pad (typed or drawn). Used by the in-app panel, the sign page and
 * the vendor app.
 */
import { useEffect, useRef, useState } from "react";
import { statusInfo } from "../../lib/rentAgreements";

export const RENT_ACCENT = "#0E9F6E";

export function RentStyles() {
  return (
    <style>{`
      .ra-wrap{max-width:720px;margin:0 auto;padding:16px;color:#111827}
      .ra-h{font-size:20px;font-weight:800;margin:4px 0 2px}
      .ra-sub{color:#6b7280;font-size:13px;margin-bottom:14px}
      .ra-card{border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin:10px 0;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.03)}
      .ra-row{display:flex;gap:10px;align-items:center;justify-content:space-between}
      .ra-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px}
      .ra-dot{width:7px;height:7px;border-radius:999px;display:inline-block}
      .ra-muted{color:#6b7280;font-size:13px}
      .ra-steps{display:flex;gap:4px;margin-top:10px}
      .ra-step{height:5px;flex:1;border-radius:999px;background:#e5e7eb}
      .ra-step.on{background:${RENT_ACCENT}}
      .ra-btn{appearance:none;border:0;border-radius:10px;padding:11px 14px;font-weight:700;font-size:14px;cursor:pointer}
      .ra-btn.primary{background:${RENT_ACCENT};color:#fff}
      .ra-btn.ghost{background:#f3f4f6;color:#111827}
      .ra-btn.wa{background:#25D366;color:#063}
      .ra-btn:disabled{opacity:.55;cursor:not-allowed}
      .ra-field{display:block;margin:8px 0}
      .ra-field > span{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px}
      .ra-input,.ra-select{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:9px;padding:10px;font-size:14px;background:#fff}
      .ra-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .ra-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
      .ra-sec{font-size:13px;font-weight:800;color:#111827;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.04em}
      .ra-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid #d1d5db;border-radius:999px;padding:6px 10px;font-size:13px;cursor:pointer;user-select:none}
      .ra-chip.on{border-color:${RENT_ACCENT};background:#ecfdf5;color:#065f46;font-weight:700}
      .ra-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px;font-size:13px;margin:8px 0}
      .ra-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:10px;font-size:13px;margin:8px 0}
      .ra-pad{border:1px dashed #9ca3af;border-radius:10px;background:#fff;touch-action:none;width:100%;height:150px;display:block}
      @media(max-width:480px){.ra-grid3{grid-template-columns:1fr 1fr}}
    `}</style>
  );
}

export function StatusBadge({ status }) {
  const s = statusInfo(status);
  return (
    <span className="ra-badge" style={{ background: s.tone + "1A", color: s.tone }}>
      <i className="ra-dot" style={{ background: s.tone }} /> {s.label}
    </span>
  );
}

export function Steps({ status }) {
  const step = statusInfo(status).step;
  return (
    <div className="ra-steps" aria-hidden>
      {[1, 2, 3, 4].map((n) => <div key={n} className={`ra-step ${step >= n ? "on" : ""}`} />)}
    </div>
  );
}

export function Field({ label, children }) {
  return <label className="ra-field"><span>{label}</span>{children}</label>;
}

/**
 * Typed or drawn signature. onChange({ type, data }) — type "typed" with the
 * name, or "drawn" with a PNG data-URL. Empty when cleared.
 */
export function SignaturePad({ defaultName = "", onChange }) {
  const [mode, setMode] = useState("typed");
  const [name, setName] = useState(defaultName);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => { if (mode === "typed") onChange(name.trim() ? { type: "typed", data: name.trim() } : null); }, [mode, name, onChange]);

  const pos = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#111827";
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current) onChange({ type: "drawn", data: canvasRef.current.toDataURL("image/png") });
  };
  const clear = () => {
    const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null);
  };

  return (
    <div>
      <div className="ra-row" style={{ justifyContent: "flex-start", gap: 8, marginBottom: 8 }}>
        <span className={`ra-chip ${mode === "typed" ? "on" : ""}`} onClick={() => setMode("typed")}>Type</span>
        <span className={`ra-chip ${mode === "drawn" ? "on" : ""}`} onClick={() => { setMode("drawn"); onChange(null); }}>Draw</span>
      </div>
      {mode === "typed" ? (
        <input className="ra-input" placeholder="Type your full name" value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive", fontSize: 22 }} />
      ) : (
        <div>
          <canvas ref={canvasRef} width={560} height={150} className="ra-pad"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
          <button type="button" className="ra-btn ghost" style={{ marginTop: 6, padding: "6px 10px" }} onClick={clear}>Clear</button>
        </div>
      )}
    </div>
  );
}
