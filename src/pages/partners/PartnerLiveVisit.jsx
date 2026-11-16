/**
 * Partner app → a visit the MovEazy team gave you (partner_live_visits.sql).
 *
 *   1  Share where to meet: paste a Google Maps link, or tap the spot on the
 *      map (your spot for this flat from last time is filled in). Then send
 *      the tenant the visit on WhatsApp.
 *   2  When they tap "I am coming": both of you live on the map, until done.
 *   3  Mark the visit done, and say how it went.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CircleAlert, MapPin, Navigation, Phone } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Empty, Loading, TopBar, WhatsAppIcon, formatPhone, toast } from "./partnerUi";
import { pp } from "../../lib/partners";
import VisitAnswer from "../../components/VisitAnswer";
import {
  SPOT_WARNING, VISIT_STATUS, directionsUrl, distanceText, fetchPartnerLiveVisits, markPartnerVisitDone, metresBetween, partnerVisitAnswer,
  pingPartner, seenAgo, setPartnerSharing, sharePartnerSpot, spotFromLink, tenantWhatsApp, useLivePing, visitTime,
} from "../../lib/liveVisits";

const LiveVisitMap = lazy(() => import("../../components/LiveVisitMap"));
const errText = (e) => e?.message || "Something went wrong.";

export default function PartnerLiveVisit() {
  const { id } = useParams();
  const { me } = usePartner();
  const [v, setV] = useState(undefined);
  const [pick, setPick] = useState(null); // the spot being chosen
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => fetchPartnerLiveVisits().then((rows) => setV(rows.find((x) => x.id === id) || null), () => setV(null)), [id]);
  useEffect(() => { load(); }, [load]);
  // While live: the tenant's spot every 20 s.
  useEffect(() => {
    if (!v?.live) return undefined;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [v?.live, load]);
  useLivePing(v, v?.broker_sharing, pingPartner, (row) => setV((cur) => ({ ...cur, ...row })));

  // The spot to start from: what's shared, else your spot here from last time, else the flat.
  useEffect(() => {
    if (!v || pick) return;
    const start = v.meet || v.saved_spot || (v.flat?.lat != null ? { lat: Number(v.flat.lat), lng: Number(v.flat.lng) } : null);
    if (start) { setPick({ lat: Number(start.lat), lng: Number(start.lng) }); if (start.link) setLink(start.link); }
  }, [v, pick]);

  if (v === undefined) return <><TopBar title="Visit" back={pp("/")} /><Loading /></>;
  if (v === null) return <><TopBar title="Visit" back={pp("/")} /><div className="pz-pad"><Empty>This visit isn&apos;t yours any more, or it was cancelled.</Empty></div></>;

  const run = async (key, fn, ok) => {
    setBusy(key);
    try { const row = await fn(); if (row) setV((cur) => ({ ...cur, ...row })); if (ok) toast(ok); return row; } catch (e) { toast(errText(e), "error"); return null; } finally { setBusy(""); }
  };
  const fromLink = async () => {
    setBusy("link");
    try {
      const s = await spotFromLink(link);
      if (!s) { toast("Couldn't read a spot from that link. Copy the link from the pin in Google Maps.", "error"); return; }
      setPick(s);
      toast("Spot taken from the link — check it on the map");
    } finally { setBusy(""); }
  };
  const share = async () => {
    const row = await run("share", () => sharePartnerSpot(v.id, pick.lat, pick.lng, link.trim().startsWith("http") ? link.trim() : ""), "Meeting spot shared");
    if (row) setEditing(false);
  };
  const st = VISIT_STATUS[v.status] || VISIT_STATUS.assigned;
  const tenantFirst = String(v.client?.name || "Tenant").split(" ")[0];
  const choosing = v.status === "assigned" || editing;
  const tenantFar = v.tenant_loc && v.meet ? metresBetween(v.tenant_loc, v.meet) : null;

  return (
    <>
      <TopBar title={`Visit · ${tenantFirst}`} back={pp("/")} />
      <div className="pz-pad">
        <div className="pz-section">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 16 }}>{v.client?.name || "Tenant"}</b>
              <div className="pz-meta">{v.flat?.title} · {visitTime(v.visit_at)}</div>
            </div>
            <span className="pz-pill" style={{ background: `${st.tone}18`, color: st.tone, borderColor: "transparent", alignSelf: "flex-start" }}>{st.label}</span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <a className="pz-btn pz-btn--sm" href={`tel:+91${String(v.client?.phone || "").slice(-10)}`}><Phone size={15} /> {formatPhone(v.client?.phone)}</a>
            <a className="pz-btn pz-btn--sm pz-wa" href={`https://wa.me/91${String(v.client?.phone || "").slice(-10)}`} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} /> WhatsApp</a>
          </div>
        </div>

        {choosing ? (
          <div className="pz-section">
            <b style={{ fontSize: 15 }}>Share where to meet</b>
            <p className="pz-hint" style={{ margin: "4px 0 10px" }}>Paste a Google Maps link, or tap the spot on the map.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input className="pz-input" placeholder="Paste a Google Maps link" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Google Maps link" />
              <button type="button" className="pz-btn" disabled={busy === "link" || link.trim().length < 8} onClick={fromLink}>{busy === "link" ? "…" : "Use"}</button>
            </div>
            <Suspense fallback={<Loading label="Loading the map…" />}>
              <LiveVisitMap flat={v.flat} meet={pick} onPick={(lat, lng) => { setPick({ lat, lng }); setLink(""); }} height={280} />
            </Suspense>
            {v.saved_spot && v.status === "assigned" && <p className="pz-hint" style={{ margin: "8px 0 0" }}>Filled in with your spot for this flat from last time.</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0", padding: 10, borderRadius: 10, background: "#FFF4E5", color: "#7A4A0B", fontSize: 13, lineHeight: 1.5 }}>
              <CircleAlert size={17} style={{ flex: "none", marginTop: 1 }} /> {SPOT_WARNING}
            </div>
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={!pick || busy === "share"} onClick={share}>
              <MapPin size={16} /> {busy === "share" ? "Sharing…" : "Share this spot"}
            </button>
            {editing && <button type="button" className="pz-btn pz-btn--block" style={{ marginTop: 8 }} onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        ) : (
          <div className="pz-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <b style={{ fontSize: 15 }}>{v.live ? "Live" : "Meeting spot"}</b>
              {v.status !== "done" && <button type="button" className="pz-btn pz-btn--sm" onClick={() => setEditing(true)}>Change spot</button>}
            </div>
            <Suspense fallback={<Loading label="Loading the map…" />}>
              <LiveVisitMap flat={v.flat} meet={v.meet} partner={v.live ? v.broker_loc : null} tenant={v.live ? v.tenant_loc : null}
                partnerLabel="You" tenantLabel={tenantFirst} height={300} />
            </Suspense>
            {v.live && (
              <div className="pz-meta" style={{ marginTop: 8 }}>
                {v.tenant_loc ? `${tenantFirst} is ${distanceText(tenantFar)} from the spot · ${seenAgo(v.tenant_loc.at)}` : `Waiting for ${tenantFirst}'s location…`}
                {!v.tenant_sharing && ` · ${tenantFirst} stopped sharing`}
              </div>
            )}
            {v.status === "shared" && (
              <a className="pz-btn pz-btn--primary pz-btn--block pz-wa" style={{ marginTop: 10 }} href={tenantWhatsApp(v, me?.partner?.name)} target="_blank" rel="noreferrer">
                <WhatsAppIcon size={16} /> Send the spot to {tenantFirst} on WhatsApp
              </a>
            )}
            {v.meet && <a className="pz-btn pz-btn--block" style={{ marginTop: 8 }} href={directionsUrl(v.meet)} target="_blank" rel="noreferrer"><Navigation size={16} /> Directions to the spot</a>}
            {v.live && (
              <button type="button" className="pz-btn pz-btn--block" style={{ marginTop: 8 }} disabled={!!busy}
                onClick={() => run("share-loc", () => setPartnerSharing(v.id, !v.broker_sharing), v.broker_sharing ? "Stopped sharing your location" : "Sharing your location")}>
                {v.broker_sharing ? "Stop sharing my location" : "Share my location again"}
              </button>
            )}
            {v.status !== "done" && v.status !== "assigned" && (
              <button type="button" className="pz-btn pz-btn--primary pz-btn--block" style={{ marginTop: 8 }} disabled={!!busy}
                onClick={() => window.confirm("Mark this visit done? Live locations stop.") && run("done", () => markPartnerVisitDone(v.id), "Visit done")}>
                Mark visit done
              </button>
            )}
          </div>
        )}

        {(v.status === "done" || v.live) && (
          <div className="pz-section">
            <b style={{ fontSize: 15 }}>How did it go?</b>
            <p className="pz-hint" style={{ margin: "4px 0 10px" }}>Saved for the MovEazy team as what you said.</p>
            <VisitAnswer answer={v.partner_answer} extraReasons={v.reasons ?? []}
              onSave={(f) => run("answer", () => partnerVisitAnswer(v.id, f), "Saved")} />
            {v.tenant_answer?.liked && (
              <p className="pz-hint" style={{ margin: "10px 0 0" }}>{tenantFirst} said: {v.tenant_answer.liked === "liked" ? "Liked it" : "Didn't like it"}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
