/**
 * One tenant (/tenants/<lead-…|asg-…>, also /ai-matcher/<…>): everything a
 * partner needs to take them to a closure, top to bottom —
 *
 *   who and what they want · the stage and the next step · move-in date ·
 *   follow-up reminders · the flats they liked, each with its visit ·
 *   10 more flats they've never seen · Deal done / Lost · notes · timeline.
 *
 * Their own clients and MovEazy's alike (lib/partnerTenants.js,
 * lib/partnerMatcher.js). Opening it marks their new likes as seen.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlarmClock, CalendarClock, Check, ChevronRight, Heart, Pencil, Phone, RotateCcw, Sparkles, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, Sheet, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { requirementLine } from "./leadBits";
import { MATCHER_CSS, MzBadge, ShareListSheet, useMatcherRows } from "./AiMatcher";
import { useMatcherData } from "./matcherData";
import { useTenants } from "./tenantData";
import { KIT_CSS, OutcomeSheet, RemindSheet, StagePill, useReach } from "./TenantKit";
import { friendlyError, inr, pp } from "../../lib/partners";
import {
  FRESH_COUNT, cancelVisit, flatLine, likedFlats, listsFor, sendCuratedTo, setVisit, slugToKey, visitLabel, visitsMessage,
} from "../../lib/partnerMatcher";
import {
  STAGES, addNote, fetchTimeline, markTenantSeen, reminderDone, snoozeReminder, reminderPresets, updateTenant, whenLabel,
} from "../../lib/partnerTenants";

const IST_DAY = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** What to do next, by stage. */
const NEXT = {
  new: "Say hello on WhatsApp and confirm what they want.",
  contacted: "Send them flats — they swipe, you see every like.",
  list_sent: "Waiting for likes. A quick nudge on WhatsApp helps.",
  liked: "They liked flats — fix visits.",
  visit: "After the visit: mark the deal done, or send more flats.",
};

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

export default function TenantPage() {
  const { slug } = useParams();
  const key = slugToKey(slug);
  const { me, byId, inventory } = usePartner();
  const { byKey } = useMatcherRows(0);
  const md = useMatcherData();
  const { board, reminders, loaded, reload } = useTenants();
  const reach = useReach();
  const t = useMemo(() => board.find((x) => x.slug === slug), [board, slug]);
  const r = byKey.get(key); // the matcher's row: next picks (open tenants only)
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);
  const [visitFor, setVisitFor] = useState(null);
  const [remind, setRemind] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [note, setNote] = useState("");
  const [timeline, setTimeline] = useState(null);

  const tenant = useMemo(() => (t ? { ...t, kind: t.kind } : null), [t]);
  const lists = useMemo(() => (tenant ? listsFor(tenant, md.lists) : []), [tenant, md.lists]);
  const liked = useMemo(() => likedFlats(lists), [lists]);
  const visits = useMemo(() => {
    const m = new Map();
    if (!tenant) return m;
    for (const v of md.visits) if (tenant.lead_id ? v.lead_id === tenant.lead_id : v.assignment_id === tenant.assignment_id) m.set(v.property_id, v);
    return m;
  }, [md.visits, tenant]);
  const mine = useMemo(() => reminders.filter((x) => x.slug === slug), [reminders, slug]);

  const loadTimeline = () => { if (tenant) fetchTimeline(tenant).then(setTimeline, () => setTimeline([])); };
  useEffect(() => {
    if (!tenant) return;
    loadTimeline();
    if (tenant.new_actions > 0) markTenantSeen(tenant).then(() => reload());
  }, [tenant?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tenant) {
    return (
      <>
        <TopBar title="Tenant" back={pp("/leads")} />
        {loaded ? <Empty>This tenant isn't with you any more.</Empty> : <Loading />}
      </>
    );
  }

  const open = tenant.stage !== "done" && tenant.stage !== "lost";
  const first = String(tenant.name || "").split(" ")[0];
  const likedHomes = liked.map((l) => byId.get(l.property_id)).filter(Boolean);
  const refresh = () => { reload(); md.reload(); loadTimeline(); };
  const sendMore = async () => {
    setBusy(true);
    try {
      const list = await sendCuratedTo(tenant, r.picks.map((m) => m.listing.property_id));
      setShare(list);
      refresh();
    } catch (e) {
      toast(friendlyError(e, "Could not make the list."), "error");
    } finally {
      setBusy(false);
    }
  };
  const act = async (fn, ok) => { try { await fn(); toast(ok); refresh(); } catch (e) { toast(friendlyError(e), "error"); } };
  const saveNote = async () => {
    if (!note.trim()) return;
    await act(() => addNote(tenant, note.trim()), "Note added");
    setNote("");
  };
  // Flats to pick from when the deal's done: what they liked, then the partner's own live flats.
  const dealFlats = [...likedHomes, ...(inventory ?? []).filter((l) => l.source === "mine" && l.status === "published" && !liked.some((x) => x.property_id === l.property_id))].slice(0, 8);

  return (
    <>
      <TopBar title={tenant.name || "Tenant"} back={pp("/leads")} />
      <style>{MATCHER_CSS()}</style>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="pz-pad">
        {/* ── Who ── */}
        <div className="pz-section">
          <div className="pz-row" style={{ alignItems: "flex-start" }}>
            <Avatar name={tenant.name} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 17 }}>
                {tenant.name}{tenant.kind === "moveazy" && <MzBadge />}
              </strong>
              <span className="pz-meta" style={{ display: "block" }}>
                {[requirementLine(tenant), (tenant.localities ?? []).join(", ")].filter(Boolean).join(" · ") || "No requirement yet"}
              </span>
              {tenant.phone && <span className="pz-hint" style={{ display: "block" }}>{tenant.phone}</span>}
            </div>
            {tenant.lead_id && <Link to={pp(`/leads/${tenant.lead_id}/edit`)} className="pz-iconbtn" aria-label="Edit requirement"><Pencil size={17} /></Link>}
          </div>
          {tenant.phone && (
            <div className="pz-row" style={{ gap: 8, marginTop: 12 }}>
              <button type="button" className="pz-btn pz-btn--sm pz-wa" onClick={() => reach(tenant, "whatsapp")}><WhatsAppIcon size={15} /> WhatsApp</button>
              <button type="button" className="pz-btn pz-btn--sm" onClick={() => reach(tenant, "call")}><Phone size={15} /> Call</button>
              <button type="button" className="pz-btn pz-btn--sm" onClick={() => setRemind(true)}><AlarmClock size={15} /> Remind me</button>
            </div>
          )}
        </div>

        {/* ── Where they are ── */}
        <div className="pz-section">
          <div className="tp-steps" aria-label="Stage">
            {STAGES.filter((s) => s.id !== "lost").map((s, i, all) => {
              const at = all.findIndex((x) => x.id === tenant.stage);
              return <span key={s.id} className={`tp-step${i <= at ? " on" : ""}${s.id === tenant.stage ? " now" : ""}`} title={s.hint}>{s.label}</span>;
            })}
          </div>
          {open ? (
            <>
              <p className="tp-next"><Sparkles size={15} /> {NEXT[tenant.stage]}</p>
              <div className="pz-row" style={{ gap: 8 }}>
                <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={() => setOutcome("done")}><Check size={15} /> Deal done</button>
                <button type="button" className="pz-btn pz-btn--sm" onClick={() => setOutcome("lost")}>Lost</button>
              </div>
            </>
          ) : (
            <div className="pz-row" style={{ gap: 8, marginTop: 8 }}>
              <StagePill stage={tenant.stage} />
              <span className="pz-meta" style={{ flex: 1 }}>
                {tenant.stage === "done" && tenant.deal
                  ? [tenant.deal.property_id && byId.get(tenant.deal.property_id) ? flatLine(byId.get(tenant.deal.property_id)) : tenant.deal.property_id,
                    tenant.deal.rent ? `${inr(tenant.deal.rent)}/month` : "",
                    tenant.deal.move_in ? `moved in ${new Date(tenant.deal.move_in).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""].filter(Boolean).join(" · ")
                  : tenant.lost_reason}
              </span>
              {!(tenant.stage === "done" && tenant.kind === "moveazy") && (
                <button type="button" className="pz-btn pz-btn--sm" onClick={() => act(() => updateTenant(tenant, { outcome: null }), "Reopened")}><RotateCcw size={14} /> Reopen</button>
              )}
            </div>
          )}
        </div>

        {/* ── Move-in and follow-ups ── */}
        <div className="pz-section">
          <label className="pz-row" style={{ gap: 10 }}>
            <CalendarClock size={18} color="var(--g)" />
            <span style={{ flex: 1, fontWeight: 600 }}>Move-in date{tenant.move_in_raw && !tenant.move_in ? <span className="pz-hint"> · they said “{tenant.move_in_raw}”</span> : null}</span>
            <input className="pz-input" type="date" style={{ width: 160 }} value={tenant.move_in || ""}
              onChange={(e) => act(() => updateTenant(tenant, { move_in: e.target.value }), e.target.value ? "Move-in date saved" : "Move-in date cleared")} />
          </label>
          {mine.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {mine.map((x) => (
                <div key={x.id} className="pz-row" style={{ gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                  <AlarmClock size={16} color={new Date(x.due_at) <= new Date() ? "#B91C1C" : "var(--dim)"} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                    <b className={new Date(x.due_at) <= new Date() ? "tk-due" : ""}>{whenLabel(x.due_at)}</b>{x.note ? ` · ${x.note}` : ""}
                  </span>
                  <button type="button" className="pz-btn pz-btn--sm" onClick={() => act(() => snoozeReminder(x.id, reminderPresets()[1].at), "Moved to tomorrow 10 am")}>Tomorrow</button>
                  <button type="button" className="pz-iconbtn" aria-label="Done" onClick={() => act(() => reminderDone(x.id), "Done")}><Check size={17} /></button>
                </div>
              ))}
            </div>
          )}
          {!tenant.phone && <button type="button" className="pz-btn pz-btn--sm" style={{ marginTop: 10 }} onClick={() => setRemind(true)}><AlarmClock size={15} /> Remind me</button>}
        </div>

        {/* ── What they liked, and the visits ── */}
        <div className="mt-head">
          <h2><Heart size={16} fill="#E11D48" color="#E11D48" /> Liked · {liked.length}</h2>
          {likedHomes.length > 0 && tenant.phone && open && (
            <button type="button" className="pz-btn pz-btn--sm pz-wa" onClick={() => reach(tenant, "whatsapp", visitsMessage(tenant.name, likedHomes))}>
              <WhatsAppIcon size={15} /> Ask for visit times
            </button>
          )}
        </div>
        {liked.length === 0 ? (
          <p className="pz-hint" style={{ margin: "0 0 14px" }}>
            {lists.length ? `Nothing liked yet — ${lists.reduce((n, l) => n + (l.property_ids?.length || 0), 0)} flats sent across ${lists.length} list${lists.length === 1 ? "" : "s"}.` : "No flats sent yet."}
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
                  {l && open && (
                    <span className="mt-acts">
                      <button type="button" className={`pz-btn pz-btn--sm${v ? "" : " pz-btn--primary"}`} onClick={() => setVisitFor({ listing: l, visit: v })}>
                        {v ? "Move" : "Fix visit"}
                      </button>
                      {v && <button type="button" className="pz-iconbtn" aria-label="Call off the visit"
                        onClick={() => act(() => cancelVisit(v.id), "Visit called off")}><X size={16} /></button>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Ten more ── */}
        {open && r && (
          <div className="aim-row">
            <strong style={{ display: "block", fontSize: 15.5 }}><Sparkles size={15} color="var(--gold)" /> {lists.length ? `${FRESH_COUNT} more` : `${FRESH_COUNT} flats`} for {first || "them"}</strong>
            <span className="pz-meta">Never one they’ve been sent or seen before — from you, another partner or MovEazy.</span>
            {r.picks.length > 0 && (
              <div className="aim-thumbs">
                {r.picks.slice(0, 5).map((m) => <div key={m.listing.property_id} className="aim-th"><SmartListingImage listing={m.listing} thumb /><i>{m.score}</i></div>)}
                {r.picks.length > 5 && <div className="aim-more">+{r.picks.length - 5}</div>}
              </div>
            )}
            {r.picks.length === 0 ? (
              <p className="aim-last">No new flats match right now. Add a flat, or widen their requirement, and the matcher finds more.</p>
            ) : (r.picks.length < FRESH_COUNT || r.near > 0) && (
              <p className="aim-last">
                {r.picks.length < FRESH_COUNT ? `Only ${r.picks.length} new flat${r.picks.length === 1 ? "" : "s"} match right now. ` : ""}
                {r.near > 0 ? `${r.near} ${r.near === 1 ? "is a near match" : "are near matches"} — their area or BHK, a little off on the rest.` : ""}
              </p>
            )}
            <button type="button" className="pz-btn pz-btn--ai pz-btn--block" style={{ marginTop: 10 }} disabled={!r.picks.length || busy} onClick={sendMore}>
              <Sparkles size={16} /> {busy ? "Making the list…" : r.picks.length ? `Send ${r.picks.length} flat${r.picks.length === 1 ? "" : "s"}` : "Nothing new to send"}
            </button>
          </div>
        )}

        {/* ── Notes and what happened ── */}
        <div className="pz-section">
          <h2>Notes & history</h2>
          <div className="pz-row" style={{ gap: 8, marginBottom: 10 }}>
            <input className="pz-input" placeholder="Add a note — e.g. wants a ground floor" value={note} maxLength={1000}
              onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveNote(); }} />
            <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" disabled={!note.trim()} onClick={saveNote}>Add</button>
          </div>
          {timeline === null ? <span className="pz-hint">Loading…</span> : timeline.length === 0 ? <span className="pz-hint">Nothing yet.</span> : (
            <div className="tp-tl">
              {timeline.slice(0, 40).map((e, i) => (
                <div key={i} className={`tp-ev tp-${e.kind}`}>
                  <span className="tp-dot" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {e.list_id ? <Link to={pp(`/curated/${e.list_id}`)} style={{ color: "inherit" }}>{e.text}</Link> : e.text}
                    <span className="pz-hint" style={{ display: "block" }}>{whenLabel(e.at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {lists.length > 0 && (
          <Link to={pp("/ai-matcher")} className="pz-row" style={{ justifyContent: "center", gap: 4, color: "var(--dim)", fontSize: 13, textDecoration: "none" }}>
            All tenants in the AI matcher <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {visitFor && (
        <VisitSheet tenant={tenant} listing={visitFor.listing} visit={visitFor.visit} onClose={() => setVisitFor(null)}
          onSaved={(at) => { setVisitFor(null); refresh(); toast(`Visit fixed · ${visitLabel(at)}`); }} />
      )}
      {remind && <RemindSheet tenant={tenant} onClose={() => setRemind(false)} onSaved={refresh} />}
      {outcome && <OutcomeSheet tenant={tenant} kind={outcome} flats={dealFlats} onClose={() => setOutcome(null)} onSaved={refresh} />}
      {share && <ShareListSheet lead={tenant} list={share} brokerName={me?.partner?.name} onClose={() => setShare(null)} />}
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
.tp-steps { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px; }
.tp-step { flex: 1 0 auto; text-align: center; padding: 6px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 700; background: var(--bg); color: var(--dim); white-space: nowrap; }
.tp-step.on { background: #DCFCE7; color: #166534; }
.tp-step.now { background: var(--g); color: #fff; }
.tp-next { display: flex; align-items: center; gap: 6px; margin: 10px 0; font-size: 14px; font-weight: 600; color: var(--ink); }
.tp-next svg { color: var(--gold); flex: none; }
.tp-tl { display: grid; gap: 0; }
.tp-ev { display: flex; gap: 10px; padding: 7px 0; font-size: 13.5px; position: relative; }
.tp-dot { width: 9px; height: 9px; border-radius: 99px; background: #D1D5DB; margin-top: 5px; flex: none; }
.tp-liked .tp-dot { background: #E11D48; } .tp-visit .tp-dot { background: var(--g); } .tp-done .tp-dot { background: #166534; }
.tp-note .tp-dot { background: var(--gold); } .tp-list .tp-dot, .tp-opened .tp-dot { background: #6366F1; }
`;
