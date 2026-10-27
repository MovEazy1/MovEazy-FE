/**
 * The bar the super admin sees on every page while viewing the site as
 * someone (lib/viewAs.js): whom, view-only or actions allowed, their apps to
 * hop between, and Exit. Also says when something wasn't saved, keeps the
 * session alive, and exits by itself after 30 minutes idle.
 */
import { useEffect, useRef, useState } from "react";
import { Eye, LogOut, MousePointerClick, X } from "lucide-react";
import { IDLE_LIMIT_MS, appsFor, control, exitViewAs, setViewAsMode, touchViewAs } from "../lib/viewAs";
import { VIEW_AS_EVENT, blockPaymentsWhileViewingAs, saveViewAsState, viewAsState } from "../lib/viewAsState";

const NOTICES = {
  "view-only": "View-only — that wasn't saved.",
  payments: "Payments are off while viewing as a user.",
};

export default function ViewAsBanner() {
  const [st, setSt] = useState(viewAsState);
  const [open, setOpen] = useState(() => Boolean(viewAsState()?.panel));
  const [confirmAct, setConfirmAct] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);

  useEffect(() => {
    blockPaymentsWhileViewingAs();
    const sync = () => setSt(viewAsState());
    const onNotice = (e) => {
      setNotice(NOTICES[e.detail] || "");
      clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(""), 3500);
    };
    window.addEventListener(VIEW_AS_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener(`${VIEW_AS_EVENT}-notice`, onNotice);
    // The panel opens once, on arrival.
    const cur = viewAsState();
    if (cur?.panel) saveViewAsState({ ...cur, panel: false });
    return () => {
      window.removeEventListener(VIEW_AS_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener(`${VIEW_AS_EVENT}-notice`, onNotice);
      clearTimeout(noticeTimer.current);
    };
  }, []);

  // Still here: a heartbeat, activity noted now and then, and the 30-minute idle exit.
  useEffect(() => {
    let lastNoted = 0;
    const onActivity = () => {
      if (Date.now() - lastNoted > 30_000) { lastNoted = Date.now(); touchViewAs(); }
    };
    const tick = async () => {
      const cur = viewAsState();
      if (!cur) return;
      if (Date.now() - (cur.lastActive || cur.startedAt || 0) > IDLE_LIMIT_MS) { exitViewAs("idle"); return; }
      if (document.visibilityState === "visible") {
        const out = await control("ping").catch(() => null);
        if (out?.ended) exitViewAs("ended");
      }
    };
    tick();
    const timer = setInterval(tick, 60_000);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => {
      clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, []);

  if (!st) return null;
  const act = st.mode === "act";
  const who = st.target?.name || st.target?.email || "this user";
  const apps = appsFor(st.target?.roles);
  const here = window.location.pathname;
  const currentApp = [...apps].reverse().find((a) => a.path !== "/" && here.startsWith(a.path)) || apps[0];

  const switchMode = async (mode) => {
    setBusy(mode);
    try { await setViewAsMode(mode); setConfirmAct(false); } catch (e) { setNotice(e.message); } finally { setBusy(""); }
  };
  const exit = async () => {
    setBusy("exit");
    await exitViewAs("exit");
  };

  const accent = act ? "#DC2626" : "#D97706";
  return (
    <div style={S.wrap} role="region" aria-label="Viewing as a user">
      <button type="button" style={{ ...S.pill, borderColor: accent }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={{ ...S.dot, background: accent }} />
        <span style={S.pillText}>Viewing as <b>{who}</b></span>
        <span style={{ ...S.chip, background: act ? "#FEE2E2" : "#FEF3C7", color: act ? "#991B1B" : "#92400E" }}>
          {act ? "Actions on" : "View-only"}
        </span>
      </button>

      {notice && <div style={S.notice} role="status">{notice}</div>}

      {open && (
        <div style={S.panel}>
          <div style={S.head}>
            <div style={{ minWidth: 0 }}>
              <div style={S.name}>{who}</div>
              <div style={S.mute}>{st.target?.email}</div>
            </div>
            <button type="button" style={S.icon} onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button>
          </div>

          <div style={S.label}>Their apps</div>
          <div style={S.apps}>
            {apps.map((a) => (
              <button key={a.role} type="button" onClick={() => window.location.assign(a.path)}
                style={{ ...S.app, ...(a === currentApp ? S.appOn : null) }}>
                {a.label}
              </button>
            ))}
          </div>

          <div style={S.label}>Mode</div>
          <div style={S.seg}>
            <button type="button" style={{ ...S.segBtn, ...(!act ? S.segOn : null) }} disabled={busy !== ""}
              onClick={() => act && switchMode("view")}>
              <Eye size={14} /> View-only
            </button>
            <button type="button" style={{ ...S.segBtn, ...(act ? { ...S.segOn, color: "#991B1B" } : null) }} disabled={busy !== ""}
              onClick={() => !act && setConfirmAct(true)}>
              <MousePointerClick size={14} /> Allow actions
            </button>
          </div>
          {confirmAct && !act && (
            <div style={S.warn}>
              Anything you do now really happens in {who}'s account. When you exit you can revert it all to how it is
              right now. Payments stay off, and messages sent outside MovEazy (WhatsApp, calls) can't be undone.
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" style={S.danger} disabled={busy !== ""} onClick={() => switchMode("act")}>
                  {busy === "act" ? "Turning on…" : "Allow actions"}
                </button>
                <button type="button" style={S.ghost} onClick={() => setConfirmAct(false)}>Cancel</button>
              </div>
            </div>
          )}
          {!confirmAct && (
            <p style={S.mute}>
              {act ? "Every change is recorded — you can revert it when you exit." : "Nothing you click can change their account."}
              {" "}Exits by itself after 30 minutes idle.
            </p>
          )}

          <button type="button" style={S.exit} onClick={exit} disabled={busy === "exit"}>
            <LogOut size={15} /> {busy === "exit" ? "Exiting…" : "Exit to my account"}
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: { position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 2147483000, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: "calc(100vw - 16px)", fontFamily: "Manrope, Inter, system-ui, sans-serif" },
  pill: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 12px", borderRadius: 999, border: "2px solid", background: "rgba(255,255,255,.97)", boxShadow: "0 6px 20px rgba(0,0,0,.18)", cursor: "pointer", font: "inherit", fontSize: 13, color: "#111827", maxWidth: "100%" },
  dot: { width: 9, height: 9, borderRadius: 99, flex: "none" },
  pillText: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 },
  chip: { fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 99, flex: "none" },
  notice: { background: "#111827", color: "#fff", fontSize: 13, fontWeight: 600, padding: "7px 12px", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.25)" },
  panel: { width: 340, maxWidth: "calc(100vw - 16px)", background: "#fff", borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.25)", padding: 14, color: "#111827", fontSize: 13 },
  head: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  name: { fontWeight: 800, fontSize: 15 },
  mute: { color: "#6B7280", fontSize: 12, lineHeight: 1.45, margin: "6px 0 0" },
  icon: { border: 0, background: "transparent", cursor: "pointer", color: "#6B7280", padding: 2 },
  label: { fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#6B7280", margin: "12px 0 6px" },
  apps: { display: "flex", flexWrap: "wrap", gap: 6 },
  app: { border: "1px solid #E5E7EB", background: "#F9FAFB", borderRadius: 999, padding: "6px 11px", font: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: "#111827" },
  appOn: { borderColor: "#111827", background: "#111827", color: "#fff" },
  seg: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "#F3F4F6", borderRadius: 10, padding: 3 },
  segBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: 8, padding: "7px 6px", font: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: "transparent", color: "#4B5563" },
  segOn: { background: "#fff", color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,.12)" },
  warn: { marginTop: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#7F1D1D", borderRadius: 10, padding: 10, fontSize: 12.5, lineHeight: 1.45 },
  danger: { border: 0, background: "#DC2626", color: "#fff", borderRadius: 8, padding: "7px 12px", font: "inherit", fontWeight: 800, fontSize: 12.5, cursor: "pointer" },
  ghost: { border: "1px solid #E5E7EB", background: "#fff", borderRadius: 8, padding: "7px 12px", font: "inherit", fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  exit: { marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: 0, background: "#111827", color: "#fff", borderRadius: 10, padding: "10px 12px", font: "inherit", fontWeight: 800, fontSize: 13.5, cursor: "pointer" },
};
