import { useEffect, useMemo, useState } from "react";
import { fetchPublishedInventory } from "../../lib/inventory";
import { fetchSlotsForProperty, addVisitSlot, deleteVisitSlot } from "../../lib/visits";

const fmtSlot = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

/**
 * Admin editor for per-property visit slots (property_visit_slots). Pick a
 * listing, see its upcoming slots, add or remove them. Writes are gated by the
 * table's admin RLS policy.
 */
export default function VisitSlotsManager() {
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState("");
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [when, setWhen] = useState("");
  const [capacity, setCapacity] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchPublishedInventory({ limit: 500 }).then((rows) => {
      setListings(rows);
      if (rows[0]) setSelected(rows[0].property_id);
    });
  }, []);

  const loadSlots = async (pid) => {
    if (!pid) return;
    setLoading(true);
    try { setSlots(await fetchSlotsForProperty(pid)); } finally { setLoading(false); }
  };
  useEffect(() => { if (selected) loadSlots(selected); }, [selected]);

  const selectedListing = useMemo(() => listings.find((l) => l.property_id === selected), [listings, selected]);

  const add = async () => {
    setMsg({ type: "", text: "" });
    if (!when) { setMsg({ type: "err", text: "Pick a date & time." }); return; }
    setBusy(true);
    try {
      await addVisitSlot(selected, new Date(when).toISOString(), capacity);
      setWhen("");
      await loadSlots(selected);
      setMsg({ type: "ok", text: "Slot added." });
    } catch (e) {
      setMsg({ type: "err", text: e?.message?.includes("row-level") ? "Not authorized — your account isn't an admin on the database." : (e?.message || "Could not add slot.") });
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    setBusy(true);
    try { await deleteVisitSlot(id); await loadSlots(selected); } finally { setBusy(false); }
  };

  const inp = "px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100";

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-5">
      {/* Property picker */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">Listings</p>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-h-[70vh] overflow-y-auto">
          {listings.map((l) => (
            <button key={l.property_id} type="button" onClick={() => setSelected(l.property_id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
              style={{ background: selected === l.property_id ? "#fff5f5" : "transparent" }}>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{l.title || `${l.flat_type} in ${l.area}`}</p>
                <p className="text-[11px] text-gray-400 font-mono truncate">{l.property_id}</p>
              </div>
            </button>
          ))}
          {listings.length === 0 && <p className="text-[13px] text-gray-400 p-4">No listings yet.</p>}
        </div>
      </div>

      {/* Slots for selected property */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[15px] font-extrabold text-gray-900">{selectedListing ? (selectedListing.title || `${selectedListing.flat_type} in ${selectedListing.area}`) : "Select a listing"}</p>
          <p className="text-[12px] text-gray-400">Visit slots renters can book for this property.</p>
        </div>

        {/* Add slot */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/60">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Add a slot</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-[11px] text-gray-400 mb-1">Date &amp; time</label>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inp} />
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] text-gray-400 mb-1">Capacity</label>
              <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inp + " w-24"} />
            </div>
            <button type="button" onClick={add} disabled={busy || !selected}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: "#ff3131" }}>
              {busy ? "Saving…" : "Add slot"}
            </button>
          </div>
          {msg.text && <p className={`text-[12px] mt-2 font-semibold ${msg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
        </div>

        {/* Slot list */}
        <div className="p-5">
          {loading ? (
            <p className="text-[13px] text-gray-400">Loading slots…</p>
          ) : slots.length === 0 ? (
            <p className="text-[13px] text-gray-400">No upcoming slots. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-[13.5px] font-bold text-gray-800">{fmtSlot(s.slot_at)}</p>
                    <p className="text-[11px] text-gray-400">Capacity {s.capacity}</p>
                  </div>
                  <button type="button" onClick={() => remove(s.id)} disabled={busy}
                    className="text-[12px] font-semibold text-red-600 hover:text-red-700 px-2 py-1">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
