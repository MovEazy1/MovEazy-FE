/**
 * "View Shortlists" — everything the signed-in user has shown interest in,
 * split into two segments: their site-visit list, and homes they've liked
 * (♥) but not necessarily added for a visit yet. Each card's one action is
 * scheduling a visit, always by picking a slot from the dropdown first —
 * there's no one-tap "book" that fires without an explicit slot chosen, so
 * nothing gets scheduled by accident.
 *
 * A home whose lister hasn't published any times is the common case, not the
 * exception, and it used to dead-end here: an empty dropdown, a disabled
 * button, and no way to say "I want to see this" — which is exactly what
 * someone looking at a home they liked is trying to say. That case now asks
 * for a visit instead, optionally with a time they'd prefer, the same as the
 * property page does. It lands as a request the team schedules.
 *
 * Scheduling a liked-only home also adds it to the site-visit list, since a
 * booking only shows up on /visits for homes that are actually in the cart.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import PropertyModal from "../components/PropertyModal";
import { useAuth } from "../context/AuthContext";
import { useVisitCart } from "../context/VisitCartContext";
import {
  fetchReactions, fetchOpenVisitsFor, fetchBookings, bookIndividual, requestNextAvailableVisit,
} from "../lib/visits";
import { fetchInventoryByIds } from "../lib/inventory";
import { fetchMyCuratedProperties } from "../lib/curatedShares";

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
  const [curatedCount, setCuratedCount] = useState(0); // homes our team has sent this account
  const [suggest, setSuggest] = useState({});      // { property_id: datetime-local value }
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);     // full inventory row for the card currently open
  const [viewingId, setViewingId] = useState("");   // property_id being fetched, so a slow tap doesn't look dead
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
      const [s, b] = await Promise.all([fetchOpenVisitsFor(idsKey.split(",")), fetchBookings(user.uid)]);
      if (!alive) return;
      setSlots(s);
      setBookings(b);
    })();
    return () => { alive = false; };
  }, [user, idsKey]);

  // A shortlist the team sent over WhatsApp is reachable from that link and,
  // until now, nowhere else — someone who lost the message had no way back to
  // it. This page is where they come looking.
  useEffect(() => {
    if (!user) { setCuratedCount(0); return undefined; }
    let alive = true;
    fetchMyCuratedProperties()
      .then((res) => { if (alive) setCuratedCount(res?.propertyIds?.length || 0); })
      .catch(() => { if (alive) setCuratedCount(0); });
    return () => { alive = false; };
  }, [user]);

  const bookingByPid = useMemo(() => Object.fromEntries(bookings.map((b) => [b.property_id, b])), [bookings]);

  /** No point offering a time in the past. `datetime-local` wants local time. */
  const minVisitLocal = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  /**
   * Book a published slot, or — with none to book — ask for one.
   *
   * The two write different rows on purpose: a chosen slot is 'scheduled' and
   * needs nobody, while a request is 'preference', which is what tells the
   * lister and the CRM that a human still has to agree a time.
   */
  const scheduleVisit = async (item, slotAt = null) => {
    setBusy(item.property_id);
    setError("");
    try {
      if (!item.inVisitList) cart.add(item.raw); // implicit: scheduling a liked home adds it to the visit list
      if (slotAt) await bookIndividual(user.uid, item.property_id, slotAt);
      else await requestNextAvailableVisit(user.uid, item.property_id, null);
      if (user) setBookings(await fetchBookings(user.uid));
    } catch (e) {
      setError(e?.message || "Could not request that visit — please try again.");
    } finally { setBusy(""); }
  };

  // Tapping a home's photo or name opens it, same as everywhere else in the app.
  // A cart snapshot only carries a few fields (see VisitCartContext), so this
  // always fetches the full inventory row rather than trusting whatever's
  // already on the card. A listing with no photos yet is disproportionately
  // likely to still be a draft the owner hasn't published — the read policy
  // only allows published rows, so the fetch quietly comes back empty and the
  // card looked "dead" on tap. Falling back to the card's own snapshot means
  // it still opens; PropertyModal already shows a placeholder when there's no
  // image at all. (The photo and the name are the targets, not the whole card:
  // the card now holds a time picker and buttons of its own.)
  const openProperty = async (it) => {
    setViewingId(it.property_id);
    try {
      const rows = await fetchInventoryByIds([it.property_id]);
      setViewing(
        rows?.[0] || {
          property_id: it.property_id,
          title: it.title,
          area: it.area,
          flat_type: it.flat_type,
          rent: it.rent,
          cover_image_url: it.cover,
          images: it.cover ? [it.cover] : [],
        },
      );
    } finally {
      setViewingId((id) => (id === it.property_id ? "" : id));
    }
  };

  /** A time they'd like, on a home with nothing published to pick from. */
  const requestAt = async (item, localValue) => {
    setBusy(item.property_id);
    setError("");
    try {
      if (!item.inVisitList) cart.add(item.raw);
      const iso = localValue ? new Date(localValue).toISOString() : null;
      await requestNextAvailableVisit(user.uid, item.property_id, iso);
      setSuggest((c) => ({ ...c, [item.property_id]: "" }));
      if (user) setBookings(await fetchBookings(user.uid));
    } catch (e) {
      setError(e?.message || "Could not send that request — please try again.");
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
        .sl-open { display: block; position: relative; padding: 0; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; background-clip: padding-box; }
        button.sl-name { background: none; }
        .sl-thumb.sl-open { width: 100%; }
        .sl-thumb-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.75); font-size: 10.5px; font-weight: 700; color: #2a2621; text-align: center; padding: 4px; }
        .sl-note { font-size: 12.5px; color: #7a7267; margin: 10px 0 0; line-height: 1.45; }
        .sl-curated { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; text-align: left; margin-top: 18px; padding: 14px 16px; border-radius: 16px; border: 1px solid #cfe5df; background: #e9f5f2; color: #0e5a4c; font: 600 13px 'Plus Jakarta Sans',sans-serif; cursor: pointer; }
        .sl-curated strong { display: block; font-size: 14.5px; font-weight: 800; }
        .sl-curated-sub { display: block; margin-top: 2px; font-weight: 500; color: #3f6f65; }
        .sl-error { margin-top: 14px; border-radius: 12px; padding: 10px 13px; font-size: 13px; color: #9a2f1c; background: #fbeae0; border: 1px solid #f3c6b0; }
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

        {curatedCount > 0 && (
          <button type="button" className="sl-curated" onClick={() => navigate("/curated")}>
            <span>
              <strong>{curatedCount} {curatedCount === 1 ? "home" : "homes"} we picked for you</strong>
              <span className="sl-curated-sub">Swipe through them and book a visit for any that fit.</span>
            </span>
            <span aria-hidden>&rarr;</span>
          </button>
        )}

        {error && <div className="sl-error" role="alert">{error}</div>}

        {loading && <p className="sl-sub" style={{ marginTop: 20 }}>Loading your shortlist…</p>}

        {!loading && shown.length === 0 && (
          <div className="sl-empty">
            <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>
              {tab === "visits" ? "No homes in your site visit list yet." : "You haven't liked any homes yet."}
            </p>
            <p style={{ marginTop: 6 }}>
              {tab === "visits" ? "Schedule a visit for a liked home, or add one from your recommendations." : "Tap the heart on a home from your recommendations to shortlist it."}
            </p>
            <button type="button" className="sl-refine" style={{ marginTop: 16 }} onClick={() => navigate("/matches")}>See my matches</button>
          </div>
        )}

        {!loading && shown.length > 0 && (
          <div className="sl-cards">
            {shown.map((it) => {
              const b = bookingByPid[it.property_id];
              const options = slots[it.property_id] || [];
              return (
                <div className="sl-card" key={it.property_id}>
                  <button type="button" className="sl-thumb sl-open" onClick={() => openProperty(it)} aria-label={`Open ${it.title}`}>
                    {it.cover && <img src={it.cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                    {viewingId === it.property_id && <div className="sl-thumb-loading">Opening…</div>}
                  </button>
                  <div>
                    <button type="button" className="sl-name sl-open" onClick={() => openProperty(it)}>{it.title}</button>
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
                        {b.slot_at
                          ? `Requested ${fmtSlot(b.slot_at)} — we'll confirm`
                          : "Visit requested — we'll confirm a time"}
                      </div>
                    )}
                    {!b && options.length > 0 && (
                      <div className="sl-row">
                        <select
                          className="sl-select"
                          aria-label={`Visit slot for ${it.title}`}
                          value={chosen[it.property_id] || ""}
                          onChange={(e) => setChosen((c) => ({ ...c, [it.property_id]: e.target.value }))}
                        >
                          <option value="">Pick a visit slot…</option>
                          {options.map((s) => <option key={s.id} value={s.slot_at}>{fmtSlot(s.slot_at)}</option>)}
                        </select>
                        <button type="button" className="sl-btn" disabled={!chosen[it.property_id] || busy === it.property_id} onClick={() => scheduleVisit(it, chosen[it.property_id])}>
                          {busy === it.property_id ? "Booking…" : "Schedule visit"}
                        </button>
                      </div>
                    )}

                    {/* Nothing published to pick from. Ask for a visit rather
                        than show a dead dropdown; a preferred time is optional. */}
                    {!b && options.length === 0 && (
                      <>
                        <p className="sl-note">No visit times published yet — ask and we&apos;ll arrange one.</p>
                        <div className="sl-row">
                          <input
                            type="datetime-local"
                            className="sl-select"
                            aria-label={`Preferred visit time for ${it.title}`}
                            min={minVisitLocal}
                            value={suggest[it.property_id] || ""}
                            onChange={(e) => setSuggest((c) => ({ ...c, [it.property_id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="sl-btn"
                            disabled={busy === it.property_id}
                            onClick={() => requestAt(it, suggest[it.property_id])}
                          >
                            {busy === it.property_id
                              ? "Sending…"
                              : suggest[it.property_id] ? "Request this time" : "Request a visit"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {viewing && <PropertyModal property={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
