import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useVisitCart } from "../context/VisitCartContext";
import { fetchSlotsFor, fetchBookings, bookIndividual, bookCombined, cancelBooking } from "../lib/visits";

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const COMBINED_FEE = 1000;
const fmtSlot = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

export default function Visits() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cart = useVisitCart();

  // The bottom bar's "Scheduled Visits" deep-links here with ?only=scheduled —
  // show just the confirmed-slot bookings, not everything still to be
  // scheduled or only submitted as a preference.
  const onlyScheduled = new URLSearchParams(location.search).get("only") === "scheduled";

  const [slots, setSlots] = useState({});          // { property_id: [{id, slot_at}] }
  const [bookings, setBookings] = useState([]);    // visit_bookings rows
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState({});        // { property_id: slot_at }  (pending individual)
  const [combinedOpen, setCombinedOpen] = useState(false);
  const [combinedSlot, setCombinedSlot] = useState("");
  const [busy, setBusy] = useState("");

  const propertyIds = useMemo(() => cart.items.map((i) => i.property_id), [cart.items]);

  const reload = async () => {
    if (!user) return;
    const [s, b] = await Promise.all([fetchSlotsFor(propertyIds), fetchBookings(user.uid)]);
    setSlots(s);
    setBookings(b);
    setLoading(false);
  };

  const idsKey = propertyIds.join(",");
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let alive = true;
    (async () => {
      const [s, b] = await Promise.all([fetchSlotsFor(idsKey ? idsKey.split(",") : []), fetchBookings(user.uid)]);
      if (!alive) return;
      setSlots(s); setBookings(b); setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, idsKey]);

  const bookingByPid = useMemo(() => Object.fromEntries(bookings.map((b) => [b.property_id, b])), [bookings]);
  const toSchedule = useMemo(() => cart.items.filter((i) => !bookingByPid[i.property_id]), [cart.items, bookingByPid]);
  // A booking without a slot_at was submitted as a preference ("join the next
  // open visit"), not an actual finalised time — onlyScheduled excludes those,
  // checking both the status flag and the slot_at itself so a property only
  // counts as "scheduled" once a real visit time has been settled on.
  const scheduled = useMemo(
    () => cart.items.filter((i) => {
      const b = bookingByPid[i.property_id];
      if (!b) return false;
      return !onlyScheduled || (b.status !== "preference" && !!b.slot_at);
    }),
    [cart.items, bookingByPid, onlyScheduled]
  );

  // Slot times shared by every unscheduled property → offered for the combined tour.
  const combinedTimes = useMemo(() => {
    const lists = toSchedule.map((it) => (slots[it.property_id] || []).map((s) => s.slot_at));
    if (!lists.length) return [];
    return lists.reduce((acc, cur) => acc.filter((t) => cur.includes(t)));
  }, [toSchedule, slots]);

  const confirmIndividual = async (pid) => {
    const slot = chosen[pid];
    if (!slot) return;
    setBusy(pid);
    try { await bookIndividual(user.uid, pid, slot); await reload(); } finally { setBusy(""); }
  };

  const confirmCombined = async () => {
    if (!combinedSlot || !toSchedule.length) return;
    setBusy("combined");
    try {
      await bookCombined(user.uid, toSchedule.map((i) => i.property_id), combinedSlot, { fee: COMBINED_FEE });
      setCombinedOpen(false);
      await reload();
    } finally { setBusy(""); }
  };

  const unschedule = async (pid) => { setBusy(pid); try { await cancelBooking(user.uid, pid); await reload(); } finally { setBusy(""); } };
  const removeItem = async (pid) => { if (bookingByPid[pid]) await cancelBooking(user.uid, pid); cart.remove(pid); };

  return (
    <div className="vz-root">
      <style>{`
        .vz-root { min-height: 100dvh; background: #f4f1ea; color: #1c1a17; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .vz-wrap { max-width: 920px; margin: 0 auto; padding: 22px 18px 60px; }
        .vz-title { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
        .vz-sub { font-size: 13.5px; color: #7a7267; margin-top: 2px; }
        .vz-section { margin-top: 26px; }
        .vz-sechead { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .vz-sectitle { font-size: 15px; font-weight: 800; }
        .vz-count { font-size: 12px; font-weight: 800; color: #7a7267; background: #eae4d8; border-radius: 999px; padding: 2px 9px; }
        .vz-card { display: grid; grid-template-columns: 92px 1fr; gap: 14px; background: #fff; border: 1px solid #ece6da; border-radius: 18px; padding: 12px; margin-bottom: 12px; }
        .vz-thumb { aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg,#f3ded9,#efe3c8); }
        .vz-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .vz-name { font-size: 15.5px; font-weight: 800; }
        .vz-meta { font-size: 12.5px; color: #7a7267; margin-top: 1px; }
        .vz-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .vz-select { flex: 1; min-width: 160px; min-height: 42px; padding: 0 12px; border-radius: 12px; border: 1px solid #e2dccf; background: #fff; font: 500 13.5px 'Plus Jakarta Sans',sans-serif; color: #2a2621; }
        .vz-btn { min-height: 42px; padding: 0 16px; border-radius: 12px; border: none; background: #1c1a17; color: #fff; font: 700 13px 'Plus Jakarta Sans',sans-serif; cursor: pointer; white-space: nowrap; }
        .vz-btn:disabled { opacity: .5; cursor: default; }
        .vz-btn-ghost { background: #fff; color: #4a443d; border: 1px solid #e2dccf; }
        .vz-when { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 700; color: #16a34a; margin-top: 8px; }
        .vz-kind { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #b98d2f; }
        .vz-rent { font-size: 14px; font-weight: 800; }
        .vz-link { background: none; border: none; color: #b0392b; font: 600 12.5px 'Plus Jakarta Sans',sans-serif; cursor: pointer; padding: 4px; }
        .vz-combined { background: linear-gradient(135deg,#1c1917,#3b2b28); color: #fff; border-radius: 18px; padding: 18px; margin-bottom: 16px; }
        .vz-combined h3 { font-size: 16.5px; font-weight: 800; }
        .vz-combined p { font-size: 13px; color: rgba(255,255,255,.74); margin-top: 4px; }
        .vz-fee { color: #f3cd6a; font-weight: 800; }
        .vz-combined-cta { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .vz-combined .vz-select { color: #2a2621; }
        .vz-empty { text-align: center; color: #7a7267; padding: 60px 20px; }
        @media (max-width: 640px) {
          .vz-title { font-size: 23px; }
          .vz-card { grid-template-columns: 72px 1fr; }
        }
      `}</style>

      <MovEazyNav active="" />

      <div className="vz-wrap">
        <div className="vz-title">{onlyScheduled ? "Your scheduled visits" : "Your site visits"}</div>
        <div className="vz-sub">{onlyScheduled ? "Homes with a confirmed visit time." : "Book a slot per home, or see them all in one guided tour."}</div>

        {loading && <p className="vz-sub" style={{ marginTop: 20 }}>Loading your visits…</p>}

        {!loading && cart.items.length === 0 && (
          <div className="vz-empty">
            <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>No homes added yet.</p>
            <p style={{ marginTop: 6 }}>Add homes to your site visit from your recommendations.</p>
            <button type="button" className="vz-btn" style={{ marginTop: 16 }} onClick={() => navigate("/recommendations")}>See my matches</button>
          </div>
        )}

        {!loading && cart.items.length > 0 && onlyScheduled && scheduled.length === 0 && (
          <div className="vz-empty">
            <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>Nothing scheduled yet.</p>
            <p style={{ marginTop: 6 }}>Once you book a visit slot for a home, it'll show up here.</p>
            <button type="button" className="vz-btn" style={{ marginTop: 16 }} onClick={() => navigate("/visits")}>See everything in your list</button>
          </div>
        )}

        {/* ── Schedule visit ── */}
        {!loading && !onlyScheduled && toSchedule.length > 0 && (
          <div className="vz-section">
            <div className="vz-sechead">
              <span className="vz-sectitle">Schedule visit</span>
              <span className="vz-count">{toSchedule.length}</span>
            </div>

            {/* Combined "view all at once" option */}
            {toSchedule.length > 1 && (
              <div className="vz-combined">
                <h3>See all {toSchedule.length} homes in one guided tour</h3>
                <p>One trip, our agent drives you between every home. <span className="vz-fee">{fmtINR(COMBINED_FEE)} upfront</span> — fully refundable when you book a flat through us.</p>
                {combinedOpen ? (
                  <div className="vz-combined-cta">
                    <select className="vz-select" value={combinedSlot} onChange={(e) => setCombinedSlot(e.target.value)}>
                      <option value="">Pick a tour time…</option>
                      {combinedTimes.map((t) => <option key={t} value={t}>{fmtSlot(t)}</option>)}
                    </select>
                    <button type="button" className="vz-btn" disabled={!combinedSlot || busy === "combined"} onClick={confirmCombined}>
                      {busy === "combined" ? "Reserving…" : `Reserve tour · ${fmtINR(COMBINED_FEE)}`}
                    </button>
                    <button type="button" className="vz-btn vz-btn-ghost" onClick={() => setCombinedOpen(false)}>Cancel</button>
                  </div>
                ) : (
                  <div className="vz-combined-cta">
                    <button type="button" className="vz-btn" onClick={() => setCombinedOpen(true)} disabled={combinedTimes.length === 0}>
                      {combinedTimes.length ? "View all at one go →" : "No common slot across these homes"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {toSchedule.map((it) => {
              const options = slots[it.property_id] || [];
              return (
                <div className="vz-card" key={it.property_id}>
                  <div className="vz-thumb">{it.cover && <img src={it.cover} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}</div>
                  <div>
                    <div className="vz-name">{it.title}</div>
                    <div className="vz-meta">{[it.flat_type, it.area].filter(Boolean).join(" · ")} · <span className="vz-rent">{fmtINR(it.rent)}/mo</span></div>
                    <div className="vz-row">
                      <select className="vz-select" value={chosen[it.property_id] || ""} onChange={(e) => setChosen((c) => ({ ...c, [it.property_id]: e.target.value }))}>
                        <option value="">{options.length ? "Pick a visit slot…" : "No slots published yet"}</option>
                        {options.map((s) => <option key={s.id} value={s.slot_at}>{fmtSlot(s.slot_at)}</option>)}
                      </select>
                      <button type="button" className="vz-btn" disabled={!chosen[it.property_id] || busy === it.property_id} onClick={() => confirmIndividual(it.property_id)}>
                        {busy === it.property_id ? "Booking…" : "Book slot"}
                      </button>
                    </div>
                    <button type="button" className="vz-link" onClick={() => removeItem(it.property_id)}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Visits scheduled ── */}
        {!loading && scheduled.length > 0 && (
          <div className="vz-section">
            <div className="vz-sechead">
              <span className="vz-sectitle">Visits scheduled</span>
              <span className="vz-count">{scheduled.length}</span>
            </div>
            {scheduled.map((it) => {
              const b = bookingByPid[it.property_id];
              return (
                <div className="vz-card" key={it.property_id}>
                  <div className="vz-thumb">{it.cover && <img src={it.cover} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}</div>
                  <div>
                    <div className="vz-name">{it.title}</div>
                    <div className="vz-meta">{[it.flat_type, it.area].filter(Boolean).join(" · ")} · <span className="vz-rent">{fmtINR(it.rent)}/mo</span></div>
                    <div className="vz-when">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      Visit {fmtSlot(b.slot_at)}
                      &nbsp;<span className="vz-kind">{b.kind === "combined" ? `· Combined tour (${fmtINR(COMBINED_FEE)})` : ""}</span>
                    </div>
                    <div className="vz-row">
                      <button type="button" className="vz-btn vz-btn-ghost" onClick={() => unschedule(it.property_id)}>Reschedule</button>
                      <button type="button" className="vz-link" onClick={() => removeItem(it.property_id)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
