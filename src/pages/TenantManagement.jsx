/**
 * "Tenant Management" — for an owner, how much interest each of their
 * properties is actually getting: views, shortlists, visit requests/bookings,
 * likes/dislikes. Backed by the already-deployed my_listing_stats() RPC
 * (MovEazy-BE/supabase/owner_dashboard_stats.sql), which is security-definer
 * and scoped server-side to the caller's own poster_id — it returns only
 * aggregate counts, never who did what, so renter identity stays private.
 *
 * v1 is an interest dashboard, not a lease/contact tracker — there's no data
 * model yet for "who is actually renting which property" beyond the listing's
 * own status. That's a bigger, separate piece of work if it's wanted later.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import { fetchMyListingStats } from "../lib/ownerDashboard";

const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const STATUS = {
  published: { label: "Live", bg: "#ecfdf5", fg: "#15803d", bd: "#a7f3d0" },
  paused:    { label: "Paused", bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  rented:    { label: "Rented", bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
  sold:      { label: "Rented", bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
};

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-2 py-2 text-center">
      <p className="text-[15px] font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1 leading-tight break-words">{label}</p>
    </div>
  );
}

export default function TenantManagement() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchMyListingStats();
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setErr(e?.message || "Could not load your leads.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [authLoading, user]);

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">Tenant Management</h1>
        <p className="text-[13px] text-gray-500 mt-1 mb-6">
          How much interest each of your properties is getting — shortlists, visit requests, and reactions.
        </p>

        {!authLoading && !user ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">Sign in to see your leads</p>
            <p className="text-[13px] text-gray-500 mb-4">This is tied to the properties on your MovEazy account.</p>
            <button type="button" onClick={() => openLogin()}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              Sign in
            </button>
          </div>
        ) : loading ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">Nothing to show yet</p>
            <p className="text-[13px] text-gray-500 mb-4">List a property and its leads will show up here.</p>
            <button type="button" onClick={() => navigate("/list-my-flat")}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              List my flat
            </button>
          </div>
        ) : (
          <>
            {err && <p className="text-[12px] font-semibold text-red-500 mb-3">{err}</p>}
            <div className="space-y-4">
              {rows.map((p) => {
                const st = STATUS[p.status] || STATUS.published;
                const cover = p.cover_image_url || (p.images || [])[0] || "";
                return (
                  <div key={p.property_id} className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                    <div className="flex gap-4 p-4">
                      <div
                        className="w-20 h-20 rounded-xl shrink-0 bg-gray-100 bg-cover bg-center"
                        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
                      >
                        {!cover && (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 text-center px-2">No photo</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-extrabold text-gray-900 truncate">
                              {p.title || `${p.area || "Home"}`}
                            </p>
                            <p className="text-[12px] text-gray-500 truncate">{p.area || "—"} · {inr(p.rent)}/mo</p>
                          </div>
                          <span
                            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                            style={{ background: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}
                          >
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 px-4 pb-4">
                      <Stat label="Views" value={p.view_count ?? 0} />
                      <Stat label="Shortlisted" value={p.shortlist_count ?? 0} />
                      <Stat label="Visit requests" value={p.visit_request_count ?? 0} />
                      <Stat label="Visits booked" value={p.visit_booking_count ?? 0} />
                      <Stat label="Liked" value={p.like_count ?? 0} />
                      <Stat label="Disliked" value={p.dislike_count ?? 0} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
