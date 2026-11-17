/**
 * CRM → Deals (find_deals.sql): what /find shows tenants.
 *
 *   Steal Deals    pick a Monday–Sunday week; any number of live flats (one at
 *                  a time, or every live flat of a type), shown cheapest rent
 *                  first as tenants see them. A week with nothing picked keeps
 *                  showing the last week that had some.
 *   Deal of the Day  a calendar, one flat per type (1 RK, 1 BHK, 2 BHK, 3 BHK+)
 *                  per day. A day left empty rolls the last one over.
 *
 * Why each is a steal is worked out from our own listings (shown here as the
 * site will show it). Any CRM user changes the Steal Deals (and adds a flat from
 * Properties); Deal of the Day needs crm.properties.write. The database checks.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarCheck, Copy, Eye, Flame, Heart, Link2, Plus, X } from "lucide-react";
import { useCrm } from "./CrmShell";
import CrmDealStandards from "./CrmDealStandards";
import { Btn, C, Chip, Empty, Toast, inr } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { whatsappUrl } from "../../lib/crmSettings";
import { logActivity } from "../../lib/crmClients";
import { fetchNotifications, markNotificationRead } from "../../lib/crmPayments";
import {
  DAY_KINDS, addDays, addStealDeal, addStealKind, dayKindLabel, dealKind, dealLink, dealMessage, fetchCrmDeals, fetchDealPeople,
  fetchDealStats, setDayDeal, setStealDeals, weekLabel,
} from "../../lib/deals";

const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const DAYS_AHEAD = 14;
const card = { border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg };

function useToast() {
  const [toast, setToast] = useState(null);
  const say = useCallback((message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3200); }, []);
  return [toast, say];
}

function Thumb({ src }) {
  return <span style={{ width: 52, height: 40, borderRadius: 8, background: C.surface, overflow: "hidden", flex: "none", display: "block" }}>
    {src && <img src={src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
  </span>;
}

/** Live flats to pick from, searched by id, title or area (optionally one Deal of the Day type). */
function FlatPicker({ kind = null, exclude = [], onPick, onClose }) {
  const { inventory } = useCrm();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (inventory ?? [])
      .filter((r) => r.status === "published" && !exclude.includes(r.property_id) && (!kind || dealKind(r.flat_type) === kind))
      .filter((r) => !needle || `${r.property_id} ${r.title} ${r.area} ${r.flat_type}`.toLowerCase().includes(needle));
  }, [inventory, q, kind, exclude]);
  return (
    <div style={{ ...card, padding: 12, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="crm-input" autoFocus style={{ flex: 1, minWidth: 0 }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={`Search live ${kind ? dayKindLabel(kind) + " " : ""}flats: id, title, area…`} aria-label="Search flats" />
        <Btn sm onClick={onClose}><X size={14} /></Btn>
      </div>
      <span className="crm-mute" style={{ fontSize: 11.5 }}>{rows.length} live flat{rows.length === 1 ? "" : "s"}{q.trim() ? " match" : ""} — scroll for all of them</span>
      <div className="crm-scroll" style={{ maxHeight: 320, display: "grid", gap: 4 }}>
        {rows.length === 0 ? <span className="crm-mute" style={{ fontSize: 12, padding: 6 }}>No live flats match.</span> : rows.map((r) => (
          <button key={r.property_id} type="button" className="crm-btn" onClick={() => onPick(r.property_id)}
            style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", padding: 6 }}>
            <Thumb src={r.cover_image_url || (r.images ?? [])[0]} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{r.title || r.property_id}</b>
              <span className="crm-mute" style={{ display: "block", fontSize: 11.5 }}>{[r.property_id, r.flat_type, r.area, r.rent ? inr(r.rent) : ""].filter(Boolean).join(" · ")}</span>
            </span>
            <Plus size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * New on the deals: a client liked a deal flat, or booked a visit for one
 * (find_deals_tracking.sql deal_notify) — this person's unread ones, with a
 * way to their record. Seen clears it.
 */
function DealAlerts() {
  const [notes, setNotes] = useState([]);
  useEffect(() => { fetchNotifications({ unreadOnly: true, type: "deal" }).then(setNotes); }, []);
  if (!notes.length) return null;
  const seen = (ids) => {
    setNotes((cur) => cur.filter((n) => !ids.includes(n.id)));
    ids.forEach((id) => markNotificationRead(id).catch(() => {}));
  };
  return (
    <div style={{ ...card, padding: 12, display: "grid", gap: 6, borderColor: "#F2C9C0", background: "#FFF8F6" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 13 }}>New on the deals · {notes.length}</b>
        <span style={{ flex: 1 }} />
        <Btn sm onClick={() => seen(notes.map((n) => n.id))}>Mark all seen</Btn>
      </div>
      {notes.slice(0, 12).map((n) => (
        <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
          <span style={{ flex: "1 1 260px", minWidth: 0 }}><b>{n.title}</b> <span className="crm-mute">· {n.body} · {when(n.created_at)}</span></span>
          {n.client_id && <Link to={`/crm/clients?client=${n.client_id}`} className="crm-btn crm-btn--sm" style={{ textDecoration: "none" }}>Record</Link>}
          <Btn sm onClick={() => seen([n.id])}>Seen</Btn>
        </div>
      ))}
    </div>
  );
}

/** The general link for a deals page: copy it, or send it on WhatsApp. */
function ShareBar({ deal, say }) {
  const link = dealLink(deal);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); say("Link copied"); } catch { window.prompt("Copy the link", link); }
  };
  return (
    <div style={{ ...card, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <Link2 size={15} style={{ color: C.accent, flex: "none" }} />
      <b style={{ fontSize: 12.5 }}>Share {deal === "steal" ? "this week's Steal Deals" : "today's Deal of the Day"}</b>
      <span className="crm-mute" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 220px", minWidth: 0 }}>{link}</span>
      <Btn sm onClick={copy}><Copy size={13} /> Copy link</Btn>
      <a className="crm-btn crm-btn--sm crm-btn--wa" href={`https://wa.me/?text=${encodeURIComponent(dealMessage(deal))}`}
        target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>WhatsApp</a>
    </div>
  );
}

/** Numbers for deals periods from..to (find_deals_tracking.sql crm_deal_stats). */
function useDealStats(deal, from, to) {
  const [s, setS] = useState(null);
  useEffect(() => {
    let live = true;
    if (!from || !to) return undefined;
    fetchDealStats(deal, from, to).then((r) => live && setS(r), () => live && setS({ periods: [], flats: [] }));
    return () => { live = false; };
  }, [deal, from, to]);
  return {
    ready: Boolean(s),
    period: (key) => s?.periods?.find((p) => p.key === key) || { people: 0, identified: 0 },
    cell: (key, pid) => s?.flats?.find((f) => f.key === key && f.property_id === pid) || { opens: 0, likes: 0, visits: 0 },
    flatsOn: (key) => (s?.flats ?? []).filter((f) => f.key === key),
  };
}

function Visitors({ p, label }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
      <span className="crm-mute" style={{ fontSize: 12 }}>{label}</span>
      <span style={{ fontSize: 13 }}><b style={{ fontSize: 17 }}>{p.people}</b> people opened the page</span>
      <span style={{ fontSize: 13 }}><b style={{ fontSize: 17 }}>{p.identified}</b> gave their number</span>
    </div>
  );
}

const when = (t) => (t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

/** Who opened, liked or booked one deal flat in one period. */
function DealPeople({ deal, k, pid }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    fetchDealPeople(deal, k, pid).then((r) => live && setRows(r ?? []), () => live && setRows([]));
    return () => { live = false; };
  }, [deal, k, pid]);
  if (!rows) return <div className="crm-mute" style={{ fontSize: 12, padding: "6px 0" }}>Loading…</div>;
  if (!rows.length) return <div className="crm-mute" style={{ fontSize: 12, padding: "6px 0" }}>Nobody has opened, liked or booked it yet.</div>;
  return (
    <div style={{ display: "grid", gap: 2, padding: "4px 0", width: "100%" }}>
      {rows.map((p, i) => (
        <div key={p.client_id || i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, padding: "5px 8px", background: C.surface, borderRadius: 6 }}>
          {p.client_id
            ? <Link to={`/crm/clients?client=${p.client_id}`} style={{ fontWeight: 700, color: C.text, textDecoration: "none", minWidth: 140 }}>{p.name || "Client"}</Link>
            : <span className="crm-mute" style={{ minWidth: 140 }}>Visitor · no number yet</span>}
          {p.phone && <span className="crm-num">{p.phone}</span>}
          {p.opens > 0 && <span className="crm-mute">Opened {p.opens}×</span>}
          {p.liked && <span style={{ color: C.coral, fontWeight: 600 }}>♥ Liked{p.liked_at ? ` · ${when(p.liked_at)}` : ""}</span>}
          {p.booked_at && <span style={{ color: C.accent, fontWeight: 600 }}>Visit{p.visit_at ? ` ${when(p.visit_at)}` : " — time to fix"}{p.visit_status ? ` · ${p.visit_status}` : ""}</span>}
        </div>
      ))}
    </div>
  );
}

/** A deal flat's opens · likes · visits, and Who (the list opens under the row). */
function FlatNumbers({ n, onWho, open }) {
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", fontSize: 12 }}>
      <span title="Opened from the deals page"><Eye size={12} /> {n.opens}</span>
      <span title="Liked" style={{ color: n.likes ? C.coral : undefined }}><Heart size={12} /> {n.likes}</span>
      <span title="Visits booked for it in the period, from anywhere" style={{ color: n.visits ? C.accent : undefined }}><CalendarCheck size={12} /> {n.visits}</span>
      <Btn sm onClick={onWho}>{open ? "Hide" : "Who"}</Btn>
    </span>
  );
}

/** Deal of the Day, the last 7 days: who came each day, and each flat's numbers. */
function DayStats() {
  const { inventory } = useCrm();
  const [today] = useState(istToday);
  const from = addDays(today, -6);
  const st = useDealStats("day", from, today);
  const [who, setWho] = useState("");
  const byId = useMemo(() => new Map((inventory ?? []).map((r) => [r.property_id, r])), [inventory]);
  if (!st.ready) return <Empty>Loading the numbers…</Empty>;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  return (
    <div style={{ ...card, padding: 12, display: "grid", gap: 10 }}>
      <b style={{ fontSize: 13 }}>The last 7 days</b>
      {days.map((day) => {
        const flats = st.flatsOn(day);
        return (
          <div key={day} style={{ display: "grid", gap: 6, paddingTop: 8, borderTop: `1px solid ${C.lineSoft}` }}>
            <Visitors p={st.period(day)} label={new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) + (day === today ? " · today" : "")} />
            {flats.map((f) => {
              const r = byId.get(f.property_id);
              const id = `${day}|${f.property_id}`;
              return (
                <div key={id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", paddingLeft: 8 }}>
                  <span style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12.5 }}>
                    <b>{r?.title || f.property_id}</b>
                    <span className="crm-mute"> · {[f.property_id, r?.flat_type, r?.area].filter(Boolean).join(" · ")}</span>
                  </span>
                  <FlatNumbers n={f} open={who === id} onWho={() => setWho(who === id ? "" : id)} />
                  {who === id && <DealPeople deal="day" k={day} pid={f.property_id} />}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function StealTab({ canEdit, say }) {
  const { inventory } = useCrm();
  const [week, setWeek] = useState(null);
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState(""); // the list filtered to one flat type; "" = all
  const load = useCallback((wk) => fetchCrmDeals(wk, null, null).then((r) => { setD(r); setWeek(r.week_start); }, (e) => say(e?.message || "Couldn't load the deals", "error")), [say]);
  useEffect(() => { load(null); }, [load]);

  const ids = useMemo(() => (d?.steal ?? []).map((x) => x.property_id), [d]);
  // Live flats of each type not in the week yet, for "Add all".
  const addable = useMemo(() => {
    const inWeek = new Set(ids);
    const n = {};
    for (const r of inventory ?? []) {
      const k = r.status === "published" && !inWeek.has(r.property_id) ? dealKind(r.flat_type) : null;
      if (k) n[k] = (n[k] || 0) + 1;
    }
    return n;
  }, [inventory, ids]);
  // As tenants see it: cheapest rent first, optionally one type.
  const shown = useMemo(() => {
    const rent = (x) => Number(x.rent) || Infinity;
    return (d?.steal ?? []).filter((x) => !kind || x.kind === kind).slice().sort((a, b) => rent(a) - rent(b));
  }, [d, kind]);
  const counts = useMemo(() => {
    const n = {};
    for (const x of d?.steal ?? []) if (x.kind) n[x.kind] = (n[x.kind] || 0) + 1;
    return n;
  }, [d]);
  // Who looked (find_deals_tracking.sql): the week on screen.
  const st = useDealStats("steal", week, week);
  const [who, setWho] = useState("");

  if (!d) return <Empty>Loading the deals…</Empty>;
  const run = async (fn, ok) => {
    setBusy(true);
    try { setD(await fn()); if (ok) say(ok); } catch (e) { say(e?.message || "Couldn't save", "error"); } finally { setBusy(false); }
  };
  const save = (next, ok) => run(() => setStealDeals(week, next), ok);
  const plural = (n) => (n === 1 ? "" : "s");
  const addAll = (k) => {
    const n = addable[k] || 0;
    if (!n || !window.confirm(`Add all ${n} live ${dayKindLabel(k)} flat${plural(n)} to the Steal Deals for ${weekLabel(week, addDays(week, 6))}?`)) return;
    run(() => addStealKind(week, k), `Added ${n} ${dayKindLabel(k)} flat${plural(n)}`);
  };
  const removeShown = () => {
    if (!window.confirm(`Take all ${shown.length} ${dayKindLabel(kind)} flat${plural(shown.length)} out of this week's Steal Deals?`)) return;
    const out = new Set(shown.map((x) => x.property_id));
    save(ids.filter((x) => !out.has(x)), `Took out ${out.size} flat${plural(out.size)}`);
  };
  const thisWeek = week === d.this_monday;
  const past = week < d.this_monday;
  const editable = canEdit && !past;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {thisWeek && <ShareBar deal="steal" say={say} />}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn sm onClick={() => load(addDays(week, -7))} aria-label="Previous week"><ArrowLeft size={14} /></Btn>
        <b style={{ fontSize: 15, minWidth: 130, textAlign: "center" }}>{weekLabel(week, addDays(week, 6))}</b>
        <Btn sm onClick={() => load(addDays(week, 7))} aria-label="Next week"><ArrowRight size={14} /></Btn>
        {thisWeek ? <Chip on>This week · live now</Chip> : <Btn sm onClick={() => load(d.this_monday)}>Back to this week</Btn>}
        <span className="crm-mute" style={{ fontSize: 12 }}>{ids.length} flat{plural(ids.length)}</span>
        <span style={{ flex: 1 }} />
        {editable && <Btn sm variant="primary" disabled={busy} onClick={() => setPicking(true)}><Plus size={14} /> Add a flat</Btn>}
      </div>
      {st.ready && <Visitors p={st.period(week)} label={thisWeek ? "This week" : "That week"} />}
      {editable && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="crm-mute" style={{ fontSize: 12 }}>Add every live flat of a type:</span>
          {DAY_KINDS.map((k) => (
            <Btn key={k.id} sm disabled={busy || !addable[k.id]} onClick={() => addAll(k.id)}>
              <Plus size={13} /> All {k.label} · {addable[k.id] || 0}
            </Btn>
          ))}
        </div>
      )}
      {!thisWeek && !ids.length && (
        <div className="crm-mute" style={{ fontSize: 12 }}>
          Nothing picked for this week{past ? "" : " yet — until you add some, the site keeps showing the last week that had deals"}.
        </div>
      )}
      {picking && <FlatPicker exclude={ids} onClose={() => setPicking(false)} onPick={(id) => save([...ids, id])} />}
      {ids.length > 0 && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Chip on={!kind} onClick={() => setKind("")}>All · {ids.length}</Chip>
          {DAY_KINDS.map((k) => <Chip key={k.id} on={kind === k.id} onClick={() => setKind(k.id)}>{k.label} · {counts[k.id] || 0}</Chip>)}
          <span className="crm-mute" style={{ fontSize: 11.5 }}>Cheapest rent first, as tenants see it</span>
          <span style={{ flex: 1 }} />
          {editable && kind && shown.length > 0 && <Btn sm variant="danger" disabled={busy} onClick={removeShown}><X size={13} /> Take out all {dayKindLabel(kind)}</Btn>}
        </div>
      )}
      {ids.length === 0 ? <Empty>No Steal Deals for this week.</Empty> : shown.length === 0 ? <Empty>No {dayKindLabel(kind)} flats in this week&apos;s Steal Deals.</Empty> : (
        <div style={{ ...card, overflow: "hidden" }}>
          {shown.map((x, i) => (
            <div key={x.property_id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px", borderTop: i ? `1px solid ${C.lineSoft}` : "none", flexWrap: "wrap" }}>
              <b className="crm-mute" style={{ width: 22, fontSize: 12 }}>{i + 1}</b>
              <Thumb src={x.cover} />
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{x.title || x.property_id}
                  {x.status !== "published" && <span style={{ marginLeft: 8, color: "#B91C1C", fontSize: 11.5, fontWeight: 800 }}>{x.status === "rented" ? "RENTED" : x.status.toUpperCase()}</span>}
                </div>
                <div className="crm-mute" style={{ fontSize: 11.5 }}>{[x.property_id, x.flat_type, x.area, x.rent ? inr(x.rent) : ""].filter(Boolean).join(" · ")}</div>
                <div style={{ fontSize: 11.5, color: x.reason ? C.accent : C.textMute }}>{x.reason || "No below-average comparison — the card shows its best facts"}</div>
              </div>
              <FlatNumbers n={st.cell(week, x.property_id)} open={who === x.property_id} onWho={() => setWho(who === x.property_id ? "" : x.property_id)} />
              {editable && (
                <Btn sm variant="danger" disabled={busy} onClick={() => save(ids.filter((y) => y !== x.property_id))} aria-label="Remove"><X size={13} /></Btn>
              )}
              {who === x.property_id && <DealPeople deal="steal" k={week} pid={x.property_id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayTab({ canEdit, say }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(null); // { day, kind }
  const [today] = useState(istToday);
  // A month back too, so an empty day can say what rolls over into it.
  const load = useCallback(() => fetchCrmDeals(null, addDays(today, -31), addDays(today, DAYS_AHEAD))
    .then(setD, (e) => say(e?.message || "Couldn't load the deals", "error")), [say, today]);
  useEffect(() => { load(); }, [load]);

  const byKey = useMemo(() => new Map((d?.days ?? []).map((x) => [`${x.day}|${x.slot}`, x])), [d]);
  if (!d) return <Empty>Loading the calendar…</Empty>;
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  /** The deal showing on `day` for `kind`: that day's, or the last one before it. */
  const showing = (day, kind) => {
    for (let back = 0; back <= 31; back++) {
      const x = byKey.get(`${addDays(day, -back)}|${kind}`);
      if (x) return { ...x, rolled: back > 0 };
    }
    return null;
  };
  const set = async (day, kind, id) => {
    setBusy(true);
    try { await setDayDeal(day, kind, id); await load(); say(id ? "Deal of the Day set" : "Cleared — the last one rolls over"); }
    catch (e) { say(e?.message || "Couldn't save", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ShareBar deal="day" say={say} />
      <DayStats />
      <div className="crm-mute" style={{ fontSize: 12, lineHeight: 1.5 }}>
        One flat per type per day, live on the site from midnight. A day left empty keeps the last deal for that type (shown faded).
      </div>
      {picking && (
        <FlatPicker kind={picking.kind} onClose={() => setPicking(null)}
          onPick={(id) => { const p = picking; setPicking(null); set(p.day, p.kind, id); }} />
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr>
            <th style={th}>Day</th>
            {DAY_KINDS.map((k) => <th key={k.id} style={th}>{k.label}</th>)}
          </tr></thead>
          <tbody>
            {days.map((day) => (
              <tr key={day} style={{ background: day === today ? C.accentSoft : undefined }}>
                <td style={{ ...td, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  {day === today && <div style={{ fontSize: 10.5, color: C.accent }}>Live now</div>}
                </td>
                {DAY_KINDS.map((k) => {
                  const x = showing(day, k.id);
                  const own = x && !x.rolled;
                  return (
                    <td key={k.id} style={td}>
                      {x ? (
                        <div style={{ opacity: own ? 1 : 0.5 }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{x.title || x.property_id}</div>
                          <div className="crm-mute" style={{ fontSize: 11 }}>
                            {[x.area, x.rent ? inr(x.rent) : "", x.status === "rented" ? "RENTED" : ""].filter(Boolean).join(" · ")}
                            {!own && " · rolls over"}
                          </div>
                        </div>
                      ) : <span className="crm-mute" style={{ fontSize: 11.5 }}>—</span>}
                      {canEdit && (
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <Btn sm disabled={busy} onClick={() => setPicking({ day, kind: k.id })}>{own ? "Change" : "Set"}</Btn>
                          {own && <Btn sm variant="danger" disabled={busy} onClick={() => set(day, k.id, null)} aria-label="Clear"><X size={12} /></Btn>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: "8px", textAlign: "left", fontSize: 12, color: C.textMute, background: C.surface, borderBottom: `1px solid ${C.line}` };
const td = { padding: "8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "top" };

export default function CrmDealsPage() {
  const { access } = useCrm();
  // Steal Deals: anyone in the CRM. Deal of the Day: those who edit properties.
  const canEditSteal = Boolean(access.isStaff);
  const canEdit = access.has(SCOPES.PROPERTIES_WRITE);
  const [tab, setTab] = useState("steal");
  const [toast, say] = useToast();
  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, maxWidth: 1100 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>Deals</h1>
          <p style={{ color: C.textDim, fontSize: 13.5, margin: 0, maxWidth: "75ch", lineHeight: 1.6 }}>
            What tenants see under Find my home: this week&apos;s Steal Deals (moveazy.co.in/find/steal-deals) and today&apos;s
            Deal of the Day (/find/deal-of-the-day). Best-value picks at the flat&apos;s own rent; the “% lower” line on each is worked out
            against the standard rents (Deal of the Day tab).{tab === "day" && !canEdit && " You can look; changing the Deal of the Day needs permission to edit properties."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip on={tab === "steal"} onClick={() => setTab("steal")}>Steal Deals of the Week</Chip>
          <Chip on={tab === "day"} onClick={() => setTab("day")}>Deal of the Day</Chip>
        </div>
        <DealAlerts />
        {tab === "steal" ? <StealTab canEdit={canEditSteal} say={say} /> : <DayTab canEdit={canEdit} say={say} />}
        {/* The standard rents every deal's "% lower" line uses (deal_standards.sql). */}
        {tab === "day" && <CrmDealStandards canEdit={canEdit} say={say} />}
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}

/**
 * This week's Steal Deals, for "Add to Steal Deals" on a property: which flats
 * are in, and add / take one out. Any CRM user (find_deals.sql crm_deal_staff).
 */
export function useWeekSteal(onToast) {
  const [week, setWeek] = useState(null); // { week, ids: Set } once read
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let live = true;
    fetchCrmDeals(null).then((d) => live && setWeek({ week: d.week_start, ids: new Set((d.steal ?? []).map((x) => x.property_id)) }), () => {});
    return () => { live = false; };
  }, []);
  const toggle = async (propertyId) => {
    if (!week || busy) return;
    setBusy(propertyId);
    try {
      const inNow = week.ids.has(propertyId);
      const d = inNow
        ? await setStealDeals(week.week, [...week.ids].filter((x) => x !== propertyId))
        : await addStealDeal(week.week, propertyId);
      setWeek({ week: d.week_start, ids: new Set((d.steal ?? []).map((x) => x.property_id)) });
      onToast?.(inNow ? "Taken out of this week's Steal Deals" : "Added to this week's Steal Deals");
    } catch (e) {
      onToast?.(e?.message || "Couldn't save", "error");
    } finally {
      setBusy("");
    }
  };
  return { has: (id) => Boolean(week?.ids.has(id)), count: week?.ids.size ?? 0, ready: Boolean(week), busy, toggle };
}

/** The button: "Add to Steal Deals", or "In Steal Deals ✓" (a tap takes it out). Live flats only. */
export function StealDealButton({ listing, steal }) {
  if (!steal.ready || listing.status !== "published") return null;
  const on = steal.has(listing.property_id);
  return (
    <Btn sm variant={on ? "primary" : undefined} disabled={steal.busy === listing.property_id}
      onClick={() => steal.toggle(listing.property_id)}
      title={on ? "In this week's Steal Deals — tap to take it out" : `Add to this week's Steal Deals (${steal.count} in now)`}>
      <Flame size={13} /> {on ? "In Steal Deals" : "Add to Steal Deals"}
    </Btn>
  );
}

/** On a property's page: put it in this week's Steal Deals, or make it a Deal of the Day. */
export function CrmDealShortcut({ propertyId, flatType, onToast }) {
  const { access } = useCrm();
  const kind = dealKind(flatType);
  const [day, setDay] = useState(istToday);
  const [busy, setBusy] = useState(false);
  if (!access.isStaff) return null;
  const canDay = access.has(SCOPES.PROPERTIES_WRITE);
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); onToast?.(ok); } catch (e) { onToast?.(e?.message || "Couldn't save", "error"); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <Btn disabled={busy} onClick={() => run(() => addStealDeal(null, propertyId), "Added to this week's Steal Deals")}>
        Add to this week&apos;s Steal Deals
      </Btn>
      {!canDay ? null : kind ? (
        <>
          <input type="date" className="crm-input" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: 150 }} aria-label="Deal of the Day date" />
          <Btn disabled={busy || !day} onClick={() => run(() => setDayDeal(day, kind, propertyId), `${dayKindLabel(kind)} Deal of the Day set`)}>
            Make {dayKindLabel(kind)} Deal of the Day
          </Btn>
        </>
      ) : <span className="crm-mute" style={{ fontSize: 11.5 }}>Deal of the Day is for 1 RK, 1 BHK, 2 BHK and 3 BHK+ flats.</span>}
    </div>
  );
}

/**
 * On a client (Clients, Priority closures): send this week's Steal Deals or
 * today's Deal of the Day on WhatsApp — the general link; their number on the
 * page ties what they like back to them. Logged on the client's timeline.
 */
export function SendDealsButtons({ client, actorEmail = "", onToast, sm = false }) {
  if (!client?.phone) return null;
  const send = (deal) => {
    const url = whatsappUrl(client.phone, dealMessage(deal, client.name));
    if (!url) return;
    window.open(url, "_blank", "noopener");
    logActivity(client.id, { type: "whatsapp", body: deal === "steal" ? "Sent this week's Steal Deals" : "Sent today's Deal of the Day", actorEmail })
      .catch(() => onToast?.("Sent — couldn't note it on the timeline", "error"));
  };
  return (
    <>
      <Btn sm={sm} onClick={() => send("steal")} title="WhatsApp them this week's Steal Deals link"><Flame size={13} /> Send Steal Deals</Btn>
      <Btn sm={sm} onClick={() => send("day")} title="WhatsApp them today's Deal of the Day link"><CalendarCheck size={13} /> Send Deal of the Day</Btn>
    </>
  );
}
