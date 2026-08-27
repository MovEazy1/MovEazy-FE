import { useEffect, useMemo, useState } from "react";
import { fetchSlotsForProperty, addVisitSlot, deleteVisitSlot } from "../lib/visits";
import { markInventorySold } from "../lib/inventory";

const fmtSlot = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : "";
const fmtDateChip = (ymd) =>
  ymd ? new Date(`${ymd}T00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";
const fmtTimeOnly = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }) : "";
/** Local-calendar YYYY-MM-DD — deliberately not toISOString(), which converts
 * through UTC and silently shifts the date backward for any timezone ahead of
 * UTC (e.g. IST, UTC+5:30): local midnight becomes the previous UTC day. */
const localYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayYMD = () => localYMD(new Date());

const toMin = (hhmm) => {
  // Number("") is 0, so an empty <input type="time"> would otherwise read as
  // midnight and silently generate a full day of slots — demand real HH:MM.
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return NaN;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
};
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * property_visit_slots stores one timestamp per bookable slot (no end column),
 * so a "10:00–18:00" window is saved as the individual start times inside it,
 * stepped every `stepMin` — that keeps seekers booking a precise time instead
 * of a vague range, with no schema change needed.
 */
function buildTimes(from, to, stepMin) {
  const a = toMin(from), b = toMin(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !stepMin || b <= a) return [];
  const out = [];
  for (let t = a; t + stepMin <= b; t += stepMin) out.push(toHHMM(t));
  return out;
}

const DATE_WINDOW_DAYS = 30; // how far out "Every day / Weekdays / Weekends" reaches
/** YYYY-MM-DD dates for a recurring mode, within the next DATE_WINDOW_DAYS. */
function datesForMode(mode) {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < DATE_WINDOW_DAYS; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dow = d.getDay(); // 0 = Sun … 6 = Sat
    const isWeekend = dow === 0 || dow === 6;
    if (mode === "everyday" || (mode === "weekday" && !isWeekend) || (mode === "weekend" && isWeekend)) {
      out.push(localYMD(d));
    }
  }
  return out;
}

function Label({ children }) {
  return <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">{children}</label>;
}

/**
 * Per-property open-visit manager — usable by ANY poster (owner / tenant / broker).
 * One time window (from–to, stepped into individual bookable times) applied across
 * every date the poster picked — a recurring rule (every day / weekdays / weekends,
 * next 30 days) or hand-picked custom dates. The form resets after each add so
 * another time window can be layered on top, endlessly.
 *
 * Writing slots requires the poster-slots DB policy (MovEazy-BE/supabase/poster_visit_slots.sql).
 * Mark-sold works out of the box (inventory already allows poster updates).
 */
export default function PropertyVisitSlots({ propertyId, brandRed = "#e11d48", onSold, hideMarkSold = false, onSlotsChanged }) {
  const [slots, setSlots] = useState([]);
  const [fromT, setFromT] = useState("10:00");
  const [toT, setToT] = useState("18:00");
  const [every, setEvery] = useState(60);
  const [capacity, setCapacity] = useState(5);
  const [dateMode, setDateMode] = useState(""); // "" | everyday | weekday | weekend | custom
  const [customDates, setCustomDates] = useState([]);
  const [customConfirmed, setCustomConfirmed] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [sold, setSold] = useState(false);

  const load = async () => {
    try {
      const rows = await fetchSlotsForProperty(propertyId);
      setSlots(rows);
      onSlotsChanged?.(rows.length);
    } catch { /* ignore read errors */ }
  };
  useEffect(() => {
    if (propertyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const times = useMemo(() => buildTimes(fromT, toT, every), [fromT, toT, every]);
  const dates = useMemo(() => {
    if (dateMode === "custom") return customConfirmed ? customDates : [];
    if (dateMode === "everyday" || dateMode === "weekday" || dateMode === "weekend") return datesForMode(dateMode);
    return [];
  }, [dateMode, customDates, customConfirmed]);
  const willCreate = times.length * dates.length;

  const addCustomDate = () => {
    if (!dateDraft) return;
    setCustomDates((d) => (d.includes(dateDraft) ? d : [...d, dateDraft].sort()));
    setDateDraft("");
  };

  // One time window applied across every date picked, then the date choice
  // resets (from/to/step/seats stay put) so another window can be added right
  // on top — there's no limit to how many times this can be repeated.
  const addSlotGroup = async () => {
    setMsg({ type: "", text: "" });
    if (!times.length) { setMsg({ type: "err", text: "Set an end time later than the start time." }); return; }
    if (!dates.length) { setMsg({ type: "err", text: dateMode === "custom" ? "Add at least one date, then press OK." : "Choose which dates this applies to." }); return; }
    setBusy(true);
    let added = 0, skipped = 0;
    try {
      for (const d of dates) {
        for (const t of times) {
          try {
            await addVisitSlot(propertyId, new Date(`${d}T${t}`).toISOString(), capacity);
            added += 1;
          } catch (e) {
            // (property_id, slot_at) is unique — a time that already exists is
            // not a failure, just nothing to do.
            const m = String(e?.message || "").toLowerCase();
            if (m.includes("duplicate") || m.includes("unique")) skipped += 1;
            else throw e;
          }
        }
      }
      await load();
      setDateMode("");
      setCustomDates([]);
      setCustomConfirmed(false);
      setMsg({ type: "ok", text: `Added ${added} visit time${added === 1 ? "" : "s"}${skipped ? ` · ${skipped} already existed` : ""}. Add another time slot below if you like.` });
    } catch (e) {
      const rls = String(e?.message || "").toLowerCase().includes("row-level");
      setMsg({ type: "err", text: rls
        ? "Couldn't save — the poster-slots database policy isn't applied yet (run poster_visit_slots.sql)."
        : (e?.message || "Could not add these times.") });
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    setBusy(true);
    try { await deleteVisitSlot(id); await load(); } catch { /* ignore */ } finally { setBusy(false); }
  };

  const markSold = async () => {
    if (!window.confirm("Mark this property as sold / closed? It will be removed from the public map and search.")) return;
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      await markInventorySold(propertyId);
      setSold(true);
      onSold?.();
    } catch (e) {
      setMsg({ type: "err", text: e?.message || "Could not update the listing." });
    } finally { setBusy(false); }
  };

  const grouped = useMemo(() => {
    const byDay = new Map();
    for (const s of slots) {
      const iso = s.slot_at;
      if (!iso) continue;
      const key = localYMD(new Date(iso));
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(s);
    }
    return [...byDay.entries()]
      .map(([key, items]) => ({ key, items: items.sort((a, b) => new Date(a.slot_at) - new Date(b.slot_at)) }))
      .sort((a, b) => new Date(a.items[0].slot_at) - new Date(b.items[0].slot_at));
  }, [slots]);

  const inp = "px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="p-6">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <p className="text-[15px] font-extrabold text-gray-900">Open visit slots</p>
          {sold ? (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: "#f1f5f9", color: "#475569" }}>Sold · removed from platform</span>
          ) : !hideMarkSold ? (
            <button type="button" onClick={markSold} disabled={busy}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border disabled:opacity-60"
              style={{ borderColor: "#e2e8f0", color: "#475569" }}>
              Mark as sold
            </button>
          ) : null}
        </div>
        <p className="text-[12px] text-gray-500 mb-4">Set a time window and which dates it applies to. Renters see slots for the next 5 days.</p>

        {!sold && (
          <div className="rounded-2xl border border-gray-200 p-4 sm:p-5 mb-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-3">Add a time slot</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>From</Label>
                <input type="time" value={fromT} onChange={(e) => setFromT(e.target.value)} className={inp} />
              </div>
              <div>
                <Label>To</Label>
                <input type="time" value={toT} onChange={(e) => setToT(e.target.value)} className={inp} />
              </div>
              <div>
                <Label>Each visit</Label>
                <select value={every} onChange={(e) => setEvery(Number(e.target.value))} className={inp}>
                  {[15, 30, 45, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>{n < 60 ? `${n} min` : n === 60 ? "1 hour" : `${n / 60} hours`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Seats</Label>
                <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={inp}>
                  {[1, 2, 3, 4, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <Label>Dates</Label>
              <select
                value={dateMode}
                onChange={(e) => { setDateMode(e.target.value); setCustomConfirmed(false); setCustomDates([]); }}
                className={inp}
              >
                <option value="">Choose…</option>
                <option value="everyday">Everyday</option>
                <option value="weekday">Weekday</option>
                <option value="weekend">Weekend</option>
                <option value="custom">Select custom</option>
              </select>

              {(dateMode === "everyday" || dateMode === "weekday" || dateMode === "weekend") && (
                <p className="text-[12px] text-gray-500 mt-2">
                  Applies to the next {DATE_WINDOW_DAYS} days — {dates.length} date{dates.length === 1 ? "" : "s"}.
                </p>
              )}

              {dateMode === "custom" && !customConfirmed && (
                <div className="mt-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      min={todayYMD()}
                      value={dateDraft}
                      onChange={(e) => setDateDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomDate(); } }}
                      className={inp}
                    />
                    <button type="button" onClick={addCustomDate} disabled={!dateDraft}
                      className="h-[46px] shrink-0 px-4 rounded-xl text-[13px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      + Add date
                    </button>
                  </div>

                  {customDates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {customDates.map((d) => (
                        <span key={d} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-[12px] font-bold bg-white border border-gray-200 text-gray-700">
                          {fmtDateChip(d)}
                          <button type="button" onClick={() => setCustomDates((x) => x.filter((v) => v !== d))}
                            aria-label={`Remove ${fmtDateChip(d)}`}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-900">×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={() => setCustomConfirmed(true)} disabled={!customDates.length}
                    className="mt-3 h-9 px-5 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}>
                    OK
                  </button>
                </div>
              )}

              {dateMode === "custom" && customConfirmed && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-gray-500">{customDates.length} date{customDates.length === 1 ? "" : "s"} selected</span>
                  <button type="button" onClick={() => setCustomConfirmed(false)} className="text-[12px] font-bold text-gray-500 underline">Edit</button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                {times.length === 0
                  ? "Set an end time later than the start time."
                  : dates.length === 0
                    ? <>{times.length} visit{times.length === 1 ? "" : "s"} per day — choose the dates above.</>
                    : <>Creates <span className="font-extrabold text-gray-800">{willCreate}</span> visit time{willCreate === 1 ? "" : "s"} · {times[0]}–{toT} on {dates.length} date{dates.length === 1 ? "" : "s"}</>}
              </p>
              <button type="button" onClick={addSlotGroup} disabled={busy || !willCreate}
                className="h-[46px] px-5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60"
                style={{ background: `linear-gradient(135deg,${brandRed},#ef4444)` }}>
                {busy ? "Adding…" : "Add these times"}
              </button>
            </div>
            {msg.text && <p className={`text-[12px] mt-2 font-semibold ${msg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
          </div>
        )}

        <div>
          {slots.length === 0 ? (
            <p className="text-[12px] text-gray-400">No open visits yet.</p>
          ) : (
            <>
              <p className="text-[12px] font-bold uppercase tracking-wide text-gray-400 mb-2">Added times ({slots.length})</p>
              <div className="space-y-3">
                {grouped.map((g) => (
                  <div key={g.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[12px] font-extrabold text-gray-700 mb-2">{fmtDateChip(g.key)}</p>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((s) => (
                        <span key={s.id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-white border border-gray-200 text-[12px] font-bold text-gray-800">
                          {fmtTimeOnly(s.slot_at)}
                          {!sold && (
                            <button type="button" onClick={() => remove(s.id)} disabled={busy}
                              aria-label={`Remove ${fmtSlot(s.slot_at)}`}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50">×</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
