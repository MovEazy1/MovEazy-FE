/**
 * "View Shortlists" — everything the signed-in user has shown interest in,
 * split into two segments: their site-visit list, and homes they've liked
 * (♥) but not necessarily added for a visit yet. Each card's one action is
 * scheduling a visit — picking a published slot, or (if none are published
 * yet) asking to join the next open one. Scheduling a liked-only home also
 * adds it to the site-visit list, since a booking only shows up on /visits
 * for homes that are actually in the cart.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useVisitCart } from "../context/VisitCartContext";
import { fetchReactions, fetchSlotsFor, fetchBookings, bookIndividual } from "../lib/visits";
import { fetchInventoryByIds } from "../lib/inventory";

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtSlot = (iso) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "";

export default function Shortlists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useVisitCart();

  const [tab, setTab] = useState("visits"); // visits | liked
  const [reactions, setReactions] = useState({});
  const [likedOnly, setLikedOnly] = useState([]); // full inventory rows for liked properties not already in the cart
  const [slots, setSlots] = useState({});          // { property_id: [{id, slot_at}] }
  const [bookings, setBookings] = useState([]);    // visit_bookings rows
  const [chosen, setChosen] = useState({});        // { property_id: slot_at } — pending dropdown pick
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return undefined; }
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await fetchReactions(user.uid);
      if (!alive) return;
      setReactions(r);
      const likedIds = Object.entries(r).filter(([, v]) => v === "like").map(([pid]) => pid);
      const cartIds = new Set(cart.items.map((i) => i.property_id));
      const needFetch = likedIds.filter((id) => !cartIds.has(id));
      const rows = needFetch.length ? await fetchInventoryByIds(needFetch) : [];
      if (!alive) return;
      setLikedOnly(rows);
      setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // One combined list — cart items (already lightweight snapshots) plus
  // liked-but-not-added listings (fetched in full, so scheduling a visit for
  // one has everything cart.add() needs).
  const combined = useMemo(() => {
    const fromCart = cart.items.map((i) => ({
      property_id: i.property_id, title: i.title, area: i.area, flat_type: i.flat_type,
      rent: i.rent, cover: i.cover, inVisitList: true, raw: i,
    }));
    const fromLiked = likedOnly.map((l) => ({
      property_id: l.property_id,
      title: l.title || `${l.flat_type || "Home"} in ${l.area || "Bengaluru"}`,
      area: l.area, flat_type: l.flat_type, rent: l.rent,
      cover: l.cover_image_url || (Array.isArray(l.images) && l.images[0]) || "",
      inVisitList: false, raw: l,
    }));
    return [...fromCart, ...fromLiked];
  }, [cart.items, likedOnly]);

  const idsKey = useMemo(() => combined.map((i) => i.property_id).join(","), [combined]);
  useEffect(() => {
    if (!user || !idsKey) { setSlots({}); setBookings([]); return undefined; }
    let alive = true;
    (async () => {
      const [s, b] = await Promise.all([fetchSlotsFor(idsKey.split(",")), fetchBookings(user.uid)]);
      if (!alive) return;
      setSlots(s);
      setBookings(b);
    })();
    return () => { alive = false; };
  }, [user, idsKey]);

  const bookingByPid = useMemo(() => Object.fromEntries(bookings.map((b) => [b.property_id, b])), [bookings]);

  const scheduleVisit = async (item, slotAt = null) => {
    setBusy(item.property_id);
    try {
      if (!item.inVisitList) cart.add(item.raw); // implicit: scheduling a liked home adds it to the visit list
      await bookIndividual(user.uid, item.property_id, slotAt);
      if (user) setBookings(await fetchBookings(user.uid));
    } finally { setBusy(""); }
  };

  const visitsList = combined.filter((it) => it.inVisitList);
  const likedList = combined.filter((it) => reactions[it.property_id] === "like");
  const shown = tab === "visits" ? visitsList : likedList;

  return (
    <div className="sl-root">
      <style>{`
        .sl-root { min-height: 100dvh; background: #f4f1ea; color: #1c1a17; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .sl-wrap { max-width: 920px; margin: 0 auto; padding: 22px 18px 60px; }
        .sl-title { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
        .sl-sub { font-size: 13.5px; color: #7a7267; margin-top: 2px; }
        .sl-segment { display: flex; align-items: center; gap: 4px; background: #1c1a17; border-radius: 999px; padding: 5px; margin-top: 20px; width: fit-content; max-width: 100%; }
        .sl-segbtn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 999px; border: none; background: transparent; color: rgba(255,255,255,.55); font: 700 13px 'Plus Jakarta Sans',sans-serif; cursor: pointer; white-space: nowrap; }
        .sl-segbtn.is-on { background: #fff; color: #1c1a17; }
        .sl-segcount { font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 999px; background: rgba(0,0,0,.12); }
        .sl-segbtn.is-on .sl-segcount { background: #f0ebe1; color: #1c1a17; }
        .sl-segbtn:not(.is-on) .sl-segcount { background: rgba(255,255,255,.14); color: rgba(255,255,255,.8); }
        .sl-cards { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
        .sl-card { display: grid; grid-template-columns: 92px 1fr; gap: 14px; background: #fff; border: 1px solid #ece6da; border-radius: 18px; padding: 12px; }
        .sl-thumb { aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg,#f3ded9,#efe3c8); }
        .sl-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sl-name { font-size: 15.5px; font-weight: 800; }
        .sl-meta { font-size: 12.5px; color: #7a7267; margin-top: 1px; }
        .sl-rent { font-size: 15px; font-weight: 800; }
        .sl-rent small { font-size: 11px; font-weight: 600; color: #9a9186; }
        .sl-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .sl-select { flex: 1; min-width: 150px; min-height: 40px; padding: 0 10px; border-radius: 11px; border: 1px solid #e2dccf; background: #fff; font: 500 13px 'Plus Jakarta Sans',sans-serif; color: #2a2621; }
        .sl-btn { min-height: 40px; padding: 0 14px; border-radius: 11px; border: none; background: #1c1a17; color: #fff; font: 700 12.5px/1 'Plus Jakarta Sans',sans-serif; cursor: pointer; white-space: nowrap; }
        .sl-btn:disabled { opacity: .5; cursor: default; }
        .sl-when { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 10px; }
        .sl-when-pending { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: #b98d2f; margin-top: 10px; }
        .sl-empty { text-align: center; color: #7a7267; padding: 60px 20px; }
        .sl-refine { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 999px; border: 1px solid #ded6c8; background: #fff; font-size: 13px; font-weight: 700; cursor: pointer; color: #2a2621; }
        @media (max-width: 640px) {
          .sl-title { font-size: 23px; }
          .sl-card { grid-template-columns: 72px 1fr; }
        }
      `}</style>

      <MovEazyNav active="" />

      <div className="sl-wrap">
        <div className="sl-title">Your shortlist</div>
        <div className="sl-sub">Everything you've liked or added for a site visit, in one place.</div>

        <div className="sl-segment">
          <button type="button" className={`sl-segbtn ${tab === "visits" ? "is-on" : ""}`} onClick={() => setTab("visits")}>
            Site visits
            {visitsList.length > 0 && <span className="sl-segcount">{visitsList.length}</span>}
          </button>
          <button type="button" className={`sl-segbtn ${tab === "liked" ? "is-on" : ""}`} onClick={() => setTab("liked")}>
            Liked Properties
            {likedList.length > 0 && <span className="sl-segcount">{likedList.length}</span>}
          </button>
        </div>

        {loading && <p className="sl-sub" style={{ marginTop: 20 }}>Loading your shortlist…</p>}

        {!loading && shown.length === 0 && (
          <div className="sl-empty">
            <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>
              {tab === "visits" ? "No homes in your site visit list yet." : "You haven't liked any homes yet."}
            </p>
            <p style={{ marginTop: 6 }}>
              {tab === "visits" ? "Schedule a visit for a liked home, or add one from your recommendations." : "Tap the heart on a home from your recommendations to shortlist it."}
            </p>
            <button type="button" className="sl-refine" style={{ marginTop: 16 }} onClick={() => navigate("/recommendations")}>See my matches</button>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className="sl-cards">
            {shown.map((it) => {
              const b = bookingByPid[it.property_id];
              const options = slots[it.property_id] || [];
              return (
                <div className="sl-card" key={it.property_id}>
                  <div className="sl-thumb">
                    {it.cover && <img src={it.cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  </div>
                  <div>
                    <div className="sl-name">{it.title}</div>
                    <div className="sl-meta">{[it.flat_type, it.area].filter(Boolean).join(" · ")} · <span className="sl-rent">{fmtINR(it.rent)}<small>/mo</small></span></div>

                    {b && b.status !== "preference" && (
                      <div className="sl-when">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        Visit {fmtSlot(b.slot_at)}
                      </div>
                    )}
                    {b && b.status === "preference" && (
                      <div className="sl-when-pending">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        Waiting for the next open visit
                      </div>
                    )}
                    {!b && options.length > 0 && (
                      <div className="sl-row">
                        <select className="sl-select" value={chosen[it.property_id] || ""} onChange={(e) => setChosen((c) => ({ ...c, [it.property_id]: e.target.value }))}>
                          <option value="">Pick a visit slot…</option>
                          {options.map((s) => <option key={s.id} value={s.slot_at}>{fmtSlot(s.slot_at)}</option>)}
                        </select>
                        <button type="button" className="sl-btn" disabled={!chosen[it.property_id] || busy === it.property_id} onClick={() => scheduleVisit(it, chosen[it.property_id])}>
                          {busy === it.property_id ? "Booking…" : "Schedule visit"}
                        </button>
                      </div>
                    )}
                    {!b && options.length === 0 && (
                      <div className="sl-row">
                        <button type="button" className="sl-btn" disabled={busy === it.property_id} onClick={() => scheduleVisit(it)}>
                          {busy === it.property_id ? "Joining…" : "Schedule visit"}
                        </button>
                      </div>
                    )}
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
