/**
 * One tenant in the AI matcher (/ai-matcher/<lead-…|asg-…>): what they're
 * after, every flat they liked across the lists sent — each with its visit,
 * fixed here and sent on WhatsApp — and "Send 10 more": ten flats they've
 * never seen, from this broker or anyone else (lib/partnerMatcher.js).
 */
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, ChevronRight, Heart, Phone, Sparkles, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, Sheet, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { requirementLine } from "./leadBits";
import { DemoListPreview, MATCHER_CSS, MzBadge, ShareListSheet, useMatcherRows } from "./AiMatcher";
import { friendlyError, pp, waLink } from "../../lib/partners";
import { logReachOut } from "../../lib/partnerLeads";
import {
  FRESH_COUNT, cancelVisit, flatLine, likedFlats, sendCuratedTo, setVisit, slugToKey, visitLabel, visitsMessage,
} from "../../lib/partnerMatcher";

const IST_DAY = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Pick a day and a time (IST) for one flat. */
function VisitSheet({ tenant, listing, visit, onSaved, onClose }) {
  const cur = visit ? new Date(new Date(visit.visit_at).getTime() + 5.5 * 3600e3).toISOString() : "";
  const [day, setDay] = useState(cur ? cur.slice(0, 10) : IST_DAY());
  const [time, setTime] = useState(cur ? cur.slice(11, 16) : "11:00");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await setVisit(tenant, listing.property_id, `${day}T${time}:00+05:30`);
      onSaved(`${day}T${time}:00+05:30`);
    } catch (e) {
      toast(friendlyError(e, "Could not fix the visit."), "error");
      setBusy(false);
    }
  };
  return (
    <Sheet title={visit ? "Move the visit" : "Fix a visit"} onClose={onClose}>
      <div className="pz-pad">
        <p className="pz-meta" style={{ margin: "0 0 12px" }}>{flatLine(listing)} · {String(tenant.name || "").split(" ")[0] || "your tenant"}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label><span className="pz-label">Day</span>
            <input className="pz-input" type="date" min={IST_DAY()} value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label><span className="pz-label">Time</span>
            <input className="pz-input" type="time" step="900" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <p className="pz-hint" style={{ margin: "10px 0 0" }}>On the day it shows on your Home screen, with a reminder in the bell.</p>
        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" style={{ marginTop: 14 }} disabled={busy || !day || !time} onClick={save}>
          <CalendarClock size={16} /> {busy ? "Saving…" : visit ? "Move visit" : "Fix visit"}
        </button>
      </div>
    </Sheet>
  );
}

export default function MatcherTenant() {
  const { slug } = useParams();
  const key = slugToKey(slug);
  const { me, byId, demo } = usePartner();
  const { byKey, loaded, md } = useMatcherRows(0);
  const r = byKey.get(key);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);
  const [preview, setPreview] = useState(false);
  const [visitFor, setVisitFor] = useState(null);

  const t = r?.lead;
  const liked = useMemo(() => (r ? likedFlats(r.lists) : []), [r]);
  const visits = useMemo(() => {
    const m = new Map();
    if (!t) return m;
    for (const v of md.visits) {
      if (t.kind === "moveazy" ? v.assignment_id === t.assignment_id : v.lead_id === t.lead_id) m.set(v.property_id, v);
    }
    return m;
  }, [md.visits, t]);

  if (!r) {
    return (
      <>
        <TopBar title="AI Property Matcher" back={pp("/ai-matcher")} />
        {loaded ? <Empty>This tenant isn't open with you any more.</Empty> : <Loading />}
      </>
    );
  }

  const first = String(t.name || "").split(" ")[0];
  const likedHomes = liked.map((l) => byId.get(l.property_id)).filter(Boolean);
  const reach = (channel) => { if (t.kind === "moveazy") logReachOut(t.assignment_id, channel).catch(() => {}); };
  const sendMore = async () => {
    if (t.demo || (demo && t.kind === "own")) { setPreview(true); return; }
    setBusy(true);
    try {
      const list = await sendCuratedTo(t, r.picks.map((m) => m.listing.property_id));
      setShare(list);
      md.reload();
    } catch (e) {
      toast(friendlyError(e, "Could not make the list."), "error");
    } finally {
      setBusy(false);
    }
  };
  const callOff = async (v) => {
    try { await cancelVisit(v.id); md.reload(); toast("Visit called off"); } catch (e) { toast(friendlyError(e), "error"); }
  };

  return (
    <>
      <TopBar title={t.name || "Tenant"} back={pp("/ai-matcher")} />
      <style>{MATCHER_CSS()}</style>
      <style>{CSS}</style>
      <div className="pz-pad">
        <div className="pz-section">
          <div className="pz-row" style={{ alignItems: "flex-start" }}>
            <Avatar name={t.name} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: 17 }}>{t.name}{t.kind === "moveazy" && <MzBadge />}</strong>
              <span className="pz-meta" style={{ display: "block" }}>{[requirementLine(t), (t.localities ?? []).join(", ")].filter(Boolean).join(" · ") || "No requirement yet"}</span>
              {t.move_in_raw && <span className="pz-hint" style={{ display: "block" }}>Moving in: {t.move_in_raw}</span>}
              {t.phone && <span className="pz-hint" style={{ display: "block" }}>{t.phone}</span>}
            </div>
          </div>
          {t.phone && (
            <div className="pz-row" style={{ gap: 8, marginTop: 12 }}>
              <a className="pz-btn pz-btn--sm pz-wa" target="_blank" rel="noreferrer" onClick={() => reach("whatsapp")}
                href={waLink(t.phone, `Hi ${first || "there"}, `)}><WhatsAppIcon size={15} /> WhatsApp</a>
              <a className="pz-btn pz-btn--sm" href={`tel:+91${String(t.phone).replace(/\D/g, "").slice(-10)}`} onClick={() => reach("call")}><Phone size={15} /> Call</a>
            </div>
          )}
        </div>

        {/* ── What they liked, and the visits ── */}
        <div className="mt-head">
          <h2><Heart size={16} fill="#E11D48" color="#E11D48" /> Liked · {liked.length}</h2>
          {likedHomes.length > 0 && t.phone && (
            <a className="pz-btn pz-btn--sm pz-wa" target="_blank" rel="noreferrer" onClick={() => reach("whatsapp")}
              href={waLink(t.phone, visitsMessage(t.name, likedHomes))}><WhatsAppIcon size={15} /> Ask for visit times</a>
          )}
        </div>
        {liked.length === 0 ? (
          <p className="pz-hint" style={{ margin: "0 0 14px" }}>
            Nothing liked yet — {r.lists.reduce((n, l) => n + (l.property_ids?.length || 0), 0)} flats sent across {r.lists.length} list{r.lists.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <div className="pz-card" style={{ marginBottom: 14 }}>
            {liked.map((lk, i) => {
              const l = byId.get(lk.property_id);
              const v = visits.get(lk.property_id);
              return (
                <div key={lk.property_id} className="mt-liked" style={{ borderTop: i ? "1px solid var(--line)" : 0 }}>
                  <Link to={pp(`/property/${lk.property_id}`)} className="mt-thumb">{l && <SmartListingImage listing={l} thumb />}</Link>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 14.5 }}>{l ? flatLine(l) : lk.property_id}</strong>
                    {!l ? <span className="pz-hint">No longer available</span>
                      : v ? <span className="mt-visit"><CalendarClock size={13} /> Visit · {visitLabel(v.visit_at)}</span>
                        : <span className="pz-hint">Liked {new Date(lk.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                  </span>
                  {l && (
                    <span className="mt-acts">
                      <button type="button" className={`pz-btn pz-btn--sm${v ? "" : " pz-btn--primary"}`} onClick={() => setVisitFor({ listing: l, visit: v })}>
                        {v ? "Move" : "Fix visit"}
                      </button>
                      {v && <button type="button" className="pz-iconbtn" aria-label="Call off the visit" onClick={() => callOff(v)}><X size={16} /></button>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Ten more ── */}
        <div className="aim-row">
          <strong style={{ display: "block", fontSize: 15.5 }}><Sparkles size={15} color="var(--gold)" /> {FRESH_COUNT} more for {first || "them"}</strong>
          <span className="pz-meta">Never one they’ve been sent or seen before — from you, another partner or MovEazy.</span>
          {r.picks.length > 0 && (
            <div className="aim-thumbs">
              {r.picks.slice(0, 5).map((m) => <div key={m.listing.property_id} className="aim-th"><SmartListingImage listing={m.listing} thumb /><i>{m.score}</i></div>)}
              {r.picks.length > 5 && <div className="aim-more">+{r.picks.length - 5}</div>}
            </div>
          )}
          {r.picks.length === 0 ? (
            <p className="aim-last">No new flats match right now — everything that fits has been sent or seen. New listings show up here as they come in.</p>
          ) : (r.picks.length < FRESH_COUNT || r.near > 0) && (
            <p className="aim-last">
              {r.picks.length < FRESH_COUNT ? `Only ${r.picks.length} new flat${r.picks.length === 1 ? "" : "s"} match right now. ` : ""}
              {r.near > 0 ? `${r.near} ${r.near === 1 ? "is a near match" : "are near matches"} — their area or BHK, a little off on the rest.` : ""}
            </p>
          )}
          <button type="button" className="pz-btn pz-btn--ai pz-btn--block" style={{ marginTop: 10 }} disabled={!r.picks.length || busy} onClick={sendMore}>
            <Sparkles size={16} /> {busy ? "Making the list…" : `Send ${r.picks.length || ""} new flat${r.picks.length === 1 ? "" : "s"}`.replace("  ", " ")}
          </button>
        </div>

        {/* ── Lists so far ── */}
        {r.lists.length > 0 && (
          <div className="pz-section">
            <h2>Lists sent · {r.lists.length}</h2>
            {r.lists.map((l) => {
              const acts = Object.values(l.actions || {});
              const n = acts.filter((a) => a.action === "liked").length;
              return (
                <Link key={l.id} to={pp(`/curated/${l.id}`)} className="pz-row" style={{ padding: "8px 0", color: "inherit", textDecoration: "none" }}>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 14 }}>{new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {l.property_ids.length} flats</strong>
                    <span className="pz-hint" style={{ display: "block" }}>
                      {l.open_count ? `opened · ♥ ${n} liked · ✕ ${acts.length - n} skipped` : "not opened yet"}
                    </span>
                  </span>
                  <ChevronRight size={16} color="var(--dim)" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {visitFor && (
        <VisitSheet tenant={t} listing={visitFor.listing} visit={visitFor.visit} onClose={() => setVisitFor(null)}
          onSaved={(at) => { setVisitFor(null); md.reload(); toast(`Visit fixed · ${visitLabel(at)}`); }} />
      )}
      {share && <ShareListSheet lead={t} list={share} brokerName={me?.partner?.name} onClose={() => setShare(null)} />}
      {preview && <DemoListPreview lead={t} homes={r.picks.map((m) => m.listing)} onClose={() => setPreview(false)} />}
      {!loaded && <Loading />}
    </>
  );
}

const CSS = `
.mt-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0 8px; }
.mt-head h2 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 16px; }
.mt-liked { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.mt-thumb { width: 60px; height: 48px; border-radius: 8px; overflow: hidden; flex: none; background: #E9E6DF; }
.mt-thumb img, .mt-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.mt-visit { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 700; color: var(--g); }
.mt-acts { display: flex; align-items: center; gap: 2px; flex: none; }
`;
