/**
 * "View Shortlists" — everything the signed-in user has shown interest in:
 * liked (♥) properties from /recommendations, plus anything already on their
 * site-visit list. Two different actions (react "like", cart.add) that never
 * had one shared place to review together. Distinct from /visits, which
 * (via the bottom bar's "Scheduled Visits") shows only visits that actually
 * have a confirmed slot.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MovEazyNav from "../components/layout/MovEazyNav";
import { useAuth } from "../context/AuthContext";
import { useVisitCart } from "../context/VisitCartContext";
import { fetchReactions, setReaction } from "../lib/visits";
import { fetchInventoryByIds } from "../lib/inventory";

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Shortlists() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useVisitCart();
  const [reactions, setReactionsState] = useState({});
  const [likedOnly, setLikedOnly] = useState([]); // full inventory rows for liked properties not already in the cart
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return undefined; }
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await fetchReactions(user.uid);
      if (!alive) return;
      setReactionsState(r);
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

  // One combined, de-duplicated list — cart items (already lightweight
  // snapshots) plus liked-but-not-yet-added listings (fetched in full, so
  // "Add to site visit" from here has everything cart.add() needs).
  const combined = useMemo(() => {
    const fromCart = cart.items.map((i) => ({
      property_id: i.property_id,
      title: i.title,
      area: i.area,
      flat_type: i.flat_type,
      rent: i.rent,
      cover: i.cover,
      inVisitList: true,
      raw: i,
    }));
    const fromLiked = likedOnly.map((l) => ({
      property_id: l.property_id,
      title: l.title || `${l.flat_type || "Home"} in ${l.area || "Bengaluru"}`,
      area: l.area,
      flat_type: l.flat_type,
      rent: l.rent,
      cover: l.cover_image_url || (Array.isArray(l.images) && l.images[0]) || "",
      inVisitList: false,
      raw: l,
    }));
    return [...fromCart, ...fromLiked];
  }, [cart.items, likedOnly]);

  const visible = combined.filter((it) => reactions[it.property_id] !== "dislike");

  const react = async (propertyId, value) => {
    const current = reactions[propertyId] || null;
    const next = current === value ? null : value;
    setReactionsState((prev) => { const c = { ...prev }; if (next) c[propertyId] = next; else delete c[propertyId]; return c; });
    if (user) await setReaction(user.uid, propertyId, value, current);
  };

  return (
    <div className="sl-root">
      <style>{`
        .sl-root { min-height: 100dvh; background: #f4f1ea; color: #1c1a17; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .sl-wrap { max-width: 920px; margin: 0 auto; padding: 22px 18px 60px; }
        .sl-title { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
        .sl-sub { font-size: 13.5px; color: #7a7267; margin-top: 2px; }
        .sl-cards { display: flex; flex-direction: column; gap: 14px; margin-top: 22px; }
        .sl-card { display: grid; grid-template-columns: 92px 1fr; gap: 14px; background: #fff; border: 1px solid #ece6da; border-radius: 18px; padding: 12px; }
        .sl-thumb { aspect-ratio: 1/1; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg,#f3ded9,#efe3c8); }
        .sl-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .sl-name { font-size: 15.5px; font-weight: 800; }
        .sl-meta { font-size: 12.5px; color: #7a7267; margin-top: 1px; }
        .sl-badges { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
        .sl-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
        .sl-badge-liked { background: #fdeceb; color: #ef5a45; }
        .sl-badge-visit { background: #eaf6ee; color: #16a34a; }
        .sl-foot { display: flex; align-items: baseline; justify-content: space-between; margin-top: 8px; }
        .sl-rent { font-size: 16px; font-weight: 800; }
        .sl-rent small { font-size: 11px; font-weight: 600; color: #9a9186; }
        .sl-actions { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
        .sl-ico { width: 38px; height: 38px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 11px; border: 1px solid #e7e0d3; background: #fff; color: #7a7267; cursor: pointer; }
        .sl-ico.on-like { background: #fdeceb; border-color: #f4b8ae; color: #ef5a45; }
        .sl-add { flex: 1; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 11px; border: none; background: #1c1a17; color: #fff; font: 700 12.5px/1 'Plus Jakarta Sans',sans-serif; cursor: pointer; }
        .sl-add.is-added { background: #eaf6ee; color: #16a34a; border: 1px solid #bfe6ca; }
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

        {loading && <p className="sl-sub" style={{ marginTop: 20 }}>Loading your shortlist…</p>}

        {!loading && visible.length === 0 && (
          <div className="sl-empty">
            <p style={{ fontWeight: 700, fontSize: 16, color: "#2a2621" }}>Nothing shortlisted yet.</p>
            <p style={{ marginTop: 6 }}>Like a home or add it to your site visit list from your recommendations.</p>
            <button type="button" className="sl-refine" style={{ marginTop: 16 }} onClick={() => navigate("/recommendations")}>See my matches</button>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="sl-cards">
            {visible.map((it) => (
              <div className="sl-card" key={it.property_id}>
                <div className="sl-thumb">
                  {it.cover && <img src={it.cover} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                </div>
                <div>
                  <div className="sl-name">{it.title}</div>
                  <div className="sl-meta">{[it.flat_type, it.area].filter(Boolean).join(" · ")}</div>
                  <div className="sl-badges">
                    {reactions[it.property_id] === "like" && <span className="sl-badge sl-badge-liked">♥ Liked</span>}
                    {it.inVisitList && <span className="sl-badge sl-badge-visit">Site visit</span>}
                  </div>
                  <div className="sl-foot">
                    <span className="sl-rent">{fmtINR(it.rent)}<small>/mo</small></span>
                  </div>
                  <div className="sl-actions">
                    <button type="button" className={`sl-ico ${reactions[it.property_id] === "like" ? "on-like" : ""}`} title="Like" aria-label="Like" onClick={() => react(it.property_id, "like")}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill={reactions[it.property_id] === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
                    </button>
                    <button type="button" className="sl-ico" title="Not for me" aria-label="Not for me" onClick={() => react(it.property_id, "dislike")}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2M9.2 22l1.3-6H4.3a2 2 0 0 1-2-2.3l1.4-9A2 2 0 0 1 5.6 3H17v11l-5 8a2 2 0 0 1-2.8-1z" /></svg>
                    </button>
                    {it.inVisitList ? (
                      <button type="button" className="sl-add is-added" onClick={() => navigate("/visits")}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        In your visits
                      </button>
                    ) : (
                      <button type="button" className="sl-add" onClick={() => cart.add(it.raw)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                        Add to site visit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
