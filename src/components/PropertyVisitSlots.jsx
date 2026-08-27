import { useEffect, useState } from "react";
import { fetchSlotsForProperty, addVisitSlot, deleteVisitSlot } from "../lib/visits";
import { markInventorySold } from "../lib/inventory";

const fmtSlot = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
    : "";

/**
 * Per-property open-visit manager — usable by ANY poster (owner / tenant / broker).
 * Add multiple open visit windows, remove them, and mark the property sold (which
 * removes it from the public map). Renters see these slots for the next 5 days.
 *
 * Writing slots requires the poster-slots DB policy (MovEazy-BE/supabase/poster_visit_slots.sql).
 * Mark-sold works out of the box (inventory already allows poster updates).
 */
export default function PropertyVisitSlots({ propertyId, brandRed = "#e11d48", onSold, hideMarkSold = false, onSlotsChanged }) {
  const [slots, setSlots] = useState([]);
  const [when, setWhen] = useState("");
  const [capacity, setCapacity] = useState(5);
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

  const add = async () => {
    setMsg({ type: "", text: "" });
    if (!when) { setMsg({ type: "err", text: "Pick a date & time first." }); return; }
    setBusy(true);
    try {
      await addVisitSlot(propertyId, new Date(when).toISOString(), capacity);
      setWhen("");
      await load();
      setMsg({ type: "ok", text: "Open visit added." });
    } catch (e) {
      const rls = String(e?.message || "").toLowerCase().includes("row-level");
      setMsg({ type: "err", text: rls
        ? "Couldn't save — the poster-slots database policy isn't applied yet (run poster_visit_slots.sql)."
        : (e?.message || "Could not add the slot.") });
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
        <p className="text-[12px] text-gray-500 mb-4">Add one or more open time windows when renters can visit. Renters see slots for the next 5 days.</p>

        {!sold && (
          <>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Date &amp; time</label>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">Max visitors</label>
                <input type="number" min="1" max="50" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`${inp} w-24`} />
              </div>
              <button type="button" onClick={add} disabled={busy}
                className="h-[46px] px-5 rounded-xl text-[13px] font-bold text-white disabled:opacity-60"
                style={{ background: `linear-gradient(135deg,${brandRed},#ef4444)` }}>
                Add open visit
              </button>
            </div>
            {msg.text && <p className={`text-[12px] mb-2 font-semibold ${msg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
          </>
        )}

        <div className="space-y-2">
          {slots.length === 0 ? (
            <p className="text-[12px] text-gray-400">No open visits yet.</p>
          ) : (
            slots.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                <span className="text-[13px] font-semibold text-gray-800">{fmtSlot(s.slot_at)} <span className="text-gray-400 font-medium">· up to {s.capacity} visitors</span></span>
                {!sold && <button type="button" onClick={() => remove(s.id)} disabled={busy} className="text-[12px] font-bold text-red-500 hover:text-red-700">Remove</button>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
