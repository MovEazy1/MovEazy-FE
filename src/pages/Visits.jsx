import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useVisitCart } from "../context/VisitCartContext";
import { fetchSlotsFor, fetchBookings, bookIndividual, cancelBooking } from "../lib/visits";
import { logUserAction, ACTIONS } from "../lib/userActions";

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const COMBINED_FEE = 1000;
const fmtSlot = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

export default function Visits() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useVisitCart();

  const [slots, setSlots] = useState({});          // { property_id: [{id, slot_at}] }
  const [bookings, setBookings] = useState([]);    // visit_bookings rows
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState({});        // { property_id: slot_at }  (pending individual)
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("schedule");      // schedule | scheduled | preferences
  const defaultTabSet = useRef(false);

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

  // Three buckets: not yet submitted · confirmed to a real slot · submitted as a
  // preference because no admin slot existed to pick from ("join the next open visit").
  const toSchedule = useMemo(() => cart.items.filter((i) => !bookingByPid[i.property_id]), [cart.items, bookingByPid]);
  const scheduledConfirmed = useMemo(
    () => cart.items.filter((i) => bookingByPid[i.property_id] && bookingByPid[i.property_id].status !== "preference"),
    [cart.items, bookingByPid]
  );
  const submittedPreferences = useMemo(
    () => cart.items.filter((i) => bookingByPid[i.property_id]?.status === "preference"),
    [cart.items, bookingByPid]
  );

  // Land on whichever tab actually has something the first time data loads —
  // afterwards leave the user's own tab choice alone.
  useEffect(() => {
    if (loading || defaultTabSet.current) return;
    defaultTabSet.current = true;
    if (toSchedule.length === 0 && scheduledConfirmed.length > 0) setTab("scheduled");
    else if (toSchedule.length === 0 && submittedPreferences.length > 0) setTab("preferences");
  }, [loading, toSchedule.length, scheduledConfirmed.length, submittedPreferences.length]);

  // Submit a visit preference for one property — with a chosen slot it's a
  // confirmed booking; with no slot (no admin availability yet) it's recorded as
  // a preference, i.e. "join the next open visit", so the team can coordinate one.
  const submitPreference = async (pid, slotAt = null) => {
    setBusy(pid);
    try {
      await bookIndividual(user.uid, pid, slotAt);
      logUserAction(user, slotAt ? ACTIONS.VISIT_BOOKED : ACTIONS.VISIT_PREFERENCE, { property_id: pid, slot_at: slotAt });
      await reload();
    } finally { setBusy(""); }
  };

  const unschedule = async (pid) => { setBusy(pid); try { await cancelBooking(user.uid, pid); await reload(); } finally { setBusy(""); } };
  const removeItem = async (pid) => { if (bookingByPid[pid]) await cancelBooking(user.uid, pid); cart.remove(pid); };

  const TABS = [
    ["schedule", "Schedule visit", toSchedule.length],
    ["scheduled", "Visits scheduled", scheduledConfirmed.length],
    ["preferences", "Submitted preferences", submittedPreferences.length],
  ];

  return (
    <div className="vz-root">
      <style>{`
        .vz-root { min-height: 100dvh; background: #f4f1ea; color: #1c1a17; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .vz-wrap { max-width: 920px; margin: 0 auto; padding: 22px 18px 60px; }
        .vz-title { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
        .vz-sub { font-size: 13.5px; color: #7a7267; margin-top: 2px; }
        .vz-tabs { display: flex; align-items: center; gap: 4px; background: #1c1a17; border-radius: 999px; padding: 5px; margin-top: 20px; width: fit-content; max-width: 100%; overflow-x: auto; }
        .vz-tab { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 999px; border: none; background: transparent; color: rgba(255,255,255,.55); font: 700 13px 'Plus Jakarta Sans',sans-serif; cursor: pointer; white-space: nowrap; }
        .vz-tab.is-active { background: #fff; color: #1c1a17; }
        .vz-tab-count { font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 999px; background: rgba(0,0,0,.12); }
        .vz-tab.is-active .vz-tab-count { background: #f0ebe1; color: #1c1a17; }
        .vz-tab:not(.is-active) .vz-tab-count { background: rgba(255,255,255,.14); color: rgba(255,255,255,.8); }
        .vz-section { margin-top: 22px; }
        .vz-tabempty { color: #7a7267; font-size: 13.5px; padding: 30px 4px; }
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
        .vz-when-pending { color: #b98d2f; }
        .vz-kind { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #b98d2f; }
        .vz-rent { font-size: 14px; font-weight: 800; }
        .vz-link { background: none; border: none; color: #b0392b; font: 600 12.5px 'Plus Jakarta Sans',sans-serif; cursor: pointer; padding: 4px; }
        .vz-empty { text-align: center; color: #7a7267; padding: 60px 20px; }
        .vz-explore-wrap { margin-top: 30px; padding-top: 22px; border-top: 1px solid #ece4d4; text-align: center; }
        .vz-explore-sub { font-size: 13px; color: #7a7267; margin-bottom: 10px; }
        .vz-explore-btn { width: 100%; min-height: 50px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 14px; border: 1.5px dashed #d3c9b8; background: #fff; color: #2a2621; font: 700 14px/1 'Plus Jakarta Sans', sans-serif; cursor: pointer; transition: all .15s ease; }
        .vz-explore-btn:hover { border-color: #ef5a45; color: #ef5a45; border-style: solid; }
        @media (max-width: 640px) {
          .vz-title { font-size: 23px; }
          .vz-card { grid-template-columns: 72px 1fr; }
        }
      `}</style>

      <MovEazyNav active="" />

      <div className="vz-wrap">
        <div className="vz-title">Your site visits</div>
        <div className="vz-sub">Pick a slot where one's published, or join the next open visit — we'll coordinate the rest.</div>

        {loading && <p className="vz-sub" style={{ marginTop: 20 }}>Loading your visits…</p>}

        {!loading && cart.items.length === 0 && (
          <div className="vz-empty">
            <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>No homes added yet.</p>
            <p style={{ marginTop: 6 }}>Add homes to your site visit from your recommendations.</p>
            <button type="button" className="vz-btn" style={{ marginTop: 16 }} onClick={() => navigate("/recommendations")}>See my matches</button>
          </div>
        )}

        {!loading && cart.items.length > 0 && (
          <>
            <div className="vz-tabs">
              {TABS.map(([key, label, count]) => (
                <button key={key} type="button" className={`vz-tab ${tab === key ? "is-active" : ""}`} onClick={() => setTab(key)}>
                  {label}
                  {count > 0 && <span className="vz-tab-count">{count}</span>}
                </button>
              ))}
            </div>

            {/* ── Schedule visit ── */}
            {tab === "schedule" && (
              <div className="vz-section">
                {toSchedule.length === 0 ? (
                  <p className="vz-tabempty">Everything in your cart has been scheduled or submitted — check the other tabs.</p>
                ) : toSchedule.map((it) => {
                  const options = slots[it.property_id] || [];
                  return (
                    <div className="vz-card" key={it.property_id}>
                      <div className="vz-thumb">{it.cover && <img src={it.cover} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}</div>
                      <div>
                        <div className="vz-name">{it.title}</div>
                        <div className="vz-meta">{[it.flat_type, it.area].filter(Boolean).join(" · ")} · <span className="vz-rent">{fmtINR(it.rent)}/mo</span></div>
                        {options.length > 0 ? (
                          <div className="vz-row">
                            <select className="vz-select" value={chosen[it.property_id] || ""} onChange={(e) => setChosen((c) => ({ ...c, [it.property_id]: e.target.value }))}>
                              <option value="">Pick a visit slot…</option>
                              {options.map((s) => <option key={s.id} value={s.slot_at}>{fmtSlot(s.slot_at)}</option>)}
                            </select>
                            <button type="button" className="vz-btn" disabled={!chosen[it.property_id] || busy === it.property_id} onClick={() => submitPreference(it.property_id, chosen[it.property_id])}>
                              {busy === it.property_id ? "Booking…" : "Book this slot"}
                            </button>
                          </div>
                        ) : (
                          <div className="vz-row">
                            <button type="button" className="vz-btn" disabled={busy === it.property_id} onClick={() => submitPreference(it.property_id)}>
                              {busy === it.property_id ? "Joining…" : "Join the next open visit"}
                            </button>
                          </div>
                        )}
                        <button type="button" className="vz-link" onClick={() => removeItem(it.property_id)}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Visits scheduled ── */}
            {tab === "scheduled" && (
              <div className="vz-section">
                {scheduledConfirmed.length === 0 ? (
                  <p className="vz-tabempty">No confirmed visit times yet.</p>
                ) : scheduledConfirmed.map((it) => {
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
                          {b.kind === "combined" && <>&nbsp;<span className="vz-kind">Combined tour ({fmtINR(COMBINED_FEE)})</span></>}
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

            {/* ── Submitted preferences (joined the next open visit, no slot yet) ── */}
            {tab === "preferences" && (
              <div className="vz-section">
                {submittedPreferences.length === 0 ? (
                  <p className="vz-tabempty">No visit preferences submitted yet.</p>
                ) : submittedPreferences.map((it) => {
                  const options = slots[it.property_id] || [];
                  return (
                    <div className="vz-card" key={it.property_id}>
                      <div className="vz-thumb">{it.cover && <img src={it.cover} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}</div>
                      <div>
                        <div className="vz-name">{it.title}</div>
                        <div className="vz-meta">{[it.flat_type, it.area].filter(Boolean).join(" · ")} · <span className="vz-rent">{fmtINR(it.rent)}/mo</span></div>
                        <div className="vz-when vz-when-pending">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                          Waiting for the next open visit — we'll notify you as soon as a slot opens
                        </div>
                        {options.length > 0 && (
                          <div className="vz-row">
                            <select className="vz-select" value={chosen[it.property_id] || ""} onChange={(e) => setChosen((c) => ({ ...c, [it.property_id]: e.target.value }))}>
                              <option value="">A slot just opened — pick a time…</option>
                              {options.map((s) => <option key={s.id} value={s.slot_at}>{fmtSlot(s.slot_at)}</option>)}
                            </select>
                            <button type="button" className="vz-btn" disabled={!chosen[it.property_id] || busy === it.property_id} onClick={() => submitPreference(it.property_id, chosen[it.property_id])}>
                              {busy === it.property_id ? "Confirming…" : "Confirm slot"}
                            </button>
                          </div>
                        )}
                        <button type="button" className="vz-link" onClick={() => removeItem(it.property_id)}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom of the page — head back to the map to find more homes. Any
                flat disliked so far won't be shown again on the next load. */}
            <div className="vz-explore-wrap">
              <p className="vz-explore-sub">Not seeing enough options?</p>
              <button type="button" className="vz-explore-btn" onClick={() => navigate("/recommendations")}>
                Explore more flats
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
