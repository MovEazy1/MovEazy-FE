/**
 * moveazy.co.in/my-visit/<id> — a visit with a MovEazy partner, for the tenant
 * (partner_live_visits.sql). Sign in first (with the number you gave MovEazy).
 *
 *   The partner has shared where to meet → the spot on a map, Call the
 *   partner, Directions, and "I am coming".
 *   Coming → both of you on the map, live, until the visit is done (or 3 h).
 *   Done → how it went.
 *
 * Also the bubble on every page of the site while a visit needs the tenant or
 * is live (TenantVisitBubble, mounted in App).
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Navigation, Phone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import VisitAnswer from "../components/VisitAnswer";
import LiveVisitBubble, { bubbleVisit } from "../components/LiveVisitBubble";
import {
  VISIT_STATUS, directionsUrl, distanceText, fetchTenantLiveVisits, metresBetween, pingTenant, seenAgo, setTenantSharing,
  tenantComing, tenantVisitAnswer, useLivePing, visitTime,
} from "../lib/liveVisits";

const LiveVisitMap = lazy(() => import("../components/LiveVisitMap"));

/** The signed-in tenant's visits, kept fresh (every 20 s while live, else every 2 min). */
function useTenantVisits(enabled) {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => fetchTenantLiveVisits().then(setRows, () => setRows([])), []);
  const live = (rows ?? []).some((v) => v.live);
  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const t = setInterval(load, live ? 20000 : 120000);
    return () => clearInterval(t);
  }, [enabled, load, live]);
  return [rows, setRows];
}

export default function TenantLiveVisit() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const { openLogin } = useLoginModal();
  const [rows, setRows] = useTenantVisits(Boolean(user));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const v = (rows ?? []).find((x) => x.id === id) || null;
  useLivePing(v, v?.tenant_sharing, pingTenant, (row) => setRows((cur) => (cur ?? []).map((x) => (x.id === row.id ? { ...x, ...row } : x))));
  useEffect(() => {
    if (!loading && !user) openLogin({ title: "Sign in to see your visit", subtitle: "Use the mobile number you gave MovEazy." });
  }, [loading, user, openLogin]);

  const run = async (key, fn) => {
    setBusy(key);
    setErr("");
    try { const row = await fn(); if (row) setRows((cur) => (cur ?? []).map((x) => (x.id === row.id ? { ...x, ...row } : x))); return row; }
    catch (e) { setErr(e?.message || "Something went wrong."); return null; }
    finally { setBusy(""); }
  };

  const shell = (body) => (
    <div style={{ minHeight: "100vh", background: "#F4F2ED" }}>
      <MovEazyNav />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 16px 120px", display: "grid", gap: 14, fontFamily: "Manrope, Inter, system-ui, sans-serif" }}>{body}</main>
    </div>
  );
  const card = { background: "#fff", border: "1px solid #E4E1D8", borderRadius: 18, padding: 16 };
  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 50, padding: "0 18px", borderRadius: 999,
    border: primary ? 0 : "1.5px solid #04211D", background: primary ? "#04211D" : "#fff", color: primary ? "#fff" : "#04211D",
    font: "inherit", fontWeight: 800, fontSize: 15.5, textDecoration: "none", cursor: "pointer",
  });

  if (loading || (user && rows === null)) return shell(<div style={card}>Loading your visit…</div>);
  if (!user) {
    return shell(
      <div style={card}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Your visit</h1>
        <p style={{ margin: "0 0 12px", color: "#5C6B67" }}>Sign in with the mobile number you gave MovEazy to see where to meet your partner.</p>
        <button type="button" style={btn(true)} onClick={() => openLogin({ title: "Sign in to see your visit", subtitle: "Use the mobile number you gave MovEazy." })}>Sign in</button>
      </div>,
    );
  }
  if (!v) {
    return shell(
      <div style={card}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>We couldn&apos;t find this visit</h1>
        <p style={{ margin: 0, color: "#5C6B67" }}>It may be on another number — sign in with the mobile number you gave MovEazy — or it was cancelled.</p>
      </div>,
    );
  }

  const st = VISIT_STATUS[v.status] || VISIT_STATUS.assigned;
  const partnerFirst = String(v.partner?.name || "Your partner").split(" ")[0];
  const away = v.broker_loc && v.meet ? metresBetween(v.broker_loc, v.meet) : null;
  return shell(
    <>
      <div style={card}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: st.tone }}>{st.label}</span>
        <h1 style={{ margin: "6px 0 4px", fontSize: 24, letterSpacing: "-.02em" }}>{v.flat?.title || "Your visit"}</h1>
        <p style={{ margin: 0, color: "#5C6B67" }}>{visitTime(v.visit_at)} · with {v.partner?.name || "your MovEazy partner"}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {v.partner?.phone && <a style={btn(false)} href={`tel:+91${v.partner.phone}`}><Phone size={17} /> Call {partnerFirst}</a>}
          {v.meet && <a style={btn(false)} href={directionsUrl(v.meet)} target="_blank" rel="noreferrer"><Navigation size={17} /> Directions</a>}
        </div>
      </div>

      {v.status === "assigned" ? (
        <div style={card}>{partnerFirst} will share where to meet soon. We&apos;ll show it here.</div>
      ) : (
        <div style={card}>
          <Suspense fallback={<div style={{ height: 320 }} />}>
            <LiveVisitMap flat={null} meet={v.meet} partner={v.live ? v.broker_loc : null} tenant={v.live ? v.tenant_loc : null}
              partnerLabel={partnerFirst} tenantLabel="You" height={320} />
          </Suspense>
          {v.live && (
            <p style={{ margin: "10px 0 0", color: "#5C6B67" }}>
              {v.broker_loc ? `${partnerFirst} is ${distanceText(away)} from the meeting spot · ${seenAgo(v.broker_loc.at)}` : `Waiting for ${partnerFirst}'s location…`}
              {" "}Keep this page open so {partnerFirst} can see you coming.
            </p>
          )}
          {v.status === "shared" && (
            <button type="button" style={{ ...btn(true), width: "100%", marginTop: 12 }} disabled={busy === "coming"}
              onClick={() => run("coming", () => tenantComing(v.id))}>
              {busy === "coming" ? "Telling them…" : "I am coming"}
            </button>
          )}
          {v.live && (
            <button type="button" style={{ ...btn(false), width: "100%", marginTop: 10 }} disabled={!!busy}
              onClick={() => run("sharing", () => setTenantSharing(v.id, !v.tenant_sharing))}>
              {v.tenant_sharing ? "Stop sharing my location" : "Share my location again"}
            </button>
          )}
          {err && <p style={{ color: "#B91C1C", margin: "10px 0 0" }}>{err}</p>}
        </div>
      )}

      {(v.status === "done" || v.live) && (
        <div style={card}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>How was the flat?</h2>
          <p style={{ margin: "0 0 12px", color: "#5C6B67", fontSize: 14 }}>It helps us find you better ones.</p>
          <VisitAnswer answer={v.tenant_answer} extraReasons={v.reasons ?? []} onSave={(f) => run("answer", () => tenantVisitAnswer(v.id, f))} />
        </div>
      )}
    </>,
  );
}

/** On every page of the site, for a signed-in tenant with a visit that needs them or is live. */
export function TenantVisitBubble() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [rows, setRows] = useTenantVisits(Boolean(user));
  const v = bubbleVisit(rows ?? [], "tenant");
  const onPage = Boolean(v && pathname === `/my-visit/${v.id}`);
  useLivePing(v, v?.tenant_sharing && !onPage, pingTenant, (row) => setRows((cur) => (cur ?? []).map((x) => (x.id === row.id ? { ...x, ...row } : x))));
  if (!user || !v || onPage) return null;
  return <LiveVisitBubble visit={v} side="tenant" onOpen={() => navigate(`/my-visit/${v.id}`)} />;
}
