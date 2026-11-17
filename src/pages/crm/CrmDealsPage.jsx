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
import { ArrowLeft, ArrowRight, Flame, Plus, X } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Toast, inr } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { DAY_KINDS, addDays, addStealDeal, addStealKind, dayKindLabel, dealKind, fetchCrmDeals, setDayDeal, setStealDeals, weekLabel } from "../../lib/deals";

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
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn sm onClick={() => load(addDays(week, -7))} aria-label="Previous week"><ArrowLeft size={14} /></Btn>
        <b style={{ fontSize: 15, minWidth: 130, textAlign: "center" }}>{weekLabel(week, addDays(week, 6))}</b>
        <Btn sm onClick={() => load(addDays(week, 7))} aria-label="Next week"><ArrowRight size={14} /></Btn>
        {thisWeek ? <Chip on>This week · live now</Chip> : <Btn sm onClick={() => load(d.this_monday)}>Back to this week</Btn>}
        <span className="crm-mute" style={{ fontSize: 12 }}>{ids.length} flat{plural(ids.length)}</span>
        <span style={{ flex: 1 }} />
        {editable && <Btn sm variant="primary" disabled={busy} onClick={() => setPicking(true)}><Plus size={14} /> Add a flat</Btn>}
      </div>
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
              {editable && (
                <Btn sm variant="danger" disabled={busy} onClick={() => save(ids.filter((y) => y !== x.property_id))} aria-label="Remove"><X size={13} /></Btn>
              )}
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
            Deal of the Day (/find/deal-of-the-day). Best-value picks at the flat&apos;s own rent; why each is a steal is worked out
            from our listings.{tab === "day" && !canEdit && " You can look; changing the Deal of the Day needs permission to edit properties."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip on={tab === "steal"} onClick={() => setTab("steal")}>Steal Deals of the Week</Chip>
          <Chip on={tab === "day"} onClick={() => setTab("day")}>Deal of the Day</Chip>
        </div>
        {tab === "steal" ? <StealTab canEdit={canEditSteal} say={say} /> : <DayTab canEdit={canEdit} say={say} />}
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
