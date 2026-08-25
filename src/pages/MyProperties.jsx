/**
 * "My Properties" — everything the signed-in user has put on MovEazy, whichever
 * role they posted as (owner / tenant / broker).
 *
 * Reachable from the nav only once they actually have a listing, so the option
 * never shows up empty for seekers who have never posted.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import { fetchMyInventory, setInventoryStatus } from "../lib/inventory";
import { fetchSlotsFor } from "../lib/visits";

const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0
    ? `₹${Number(n).toLocaleString("en-IN")}`
    : "—";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS = {
  published: { label: "Live", bg: "#ecfdf5", fg: "#15803d", bd: "#a7f3d0" },
  paused:    { label: "Paused", bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
  rented:    { label: "Rented", bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
  sold:      { label: "Rented", bg: "#f1f5f9", fg: "#475569", bd: "#cbd5e1" },
};
const isClosed = (status) => status === "rented" || status === "sold";

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-center">
      <p className="text-[15px] font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function Row({ label, value }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[12px] text-gray-500 shrink-0">{label}</span>
      <span className="text-[12px] font-semibold text-gray-800 text-right">{Array.isArray(value) ? value.join(", ") : value}</span>
    </div>
  );
}

function PropertyCard({ p, slotCount, onStatus, busy }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[p.status] || STATUS.published;
  const cover = p.cover_image_url || (p.images || [])[0] || "";

  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <div className="flex gap-4 p-4">
        <div
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 bg-gray-100 bg-cover bg-center"
          style={cover ? { backgroundImage: `url(${cover})` } : undefined}
        >
          {!cover && (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400 text-center px-2">
              No photo
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-gray-900 truncate">
                {p.title || `${p.flat_type || "Home"} in ${p.area || p.city || "Bengaluru"}`}
              </p>
              <p className="text-[12px] text-gray-500 truncate">
                {[p.area, p.city].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <span
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
              style={{ background: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}
            >
              {st.label}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-2">
            <span className="text-[17px] font-extrabold text-gray-900">{inr(p.rent)}<span className="text-[12px] font-semibold text-gray-400">/mo</span></span>
            {Number(p.deposit) > 0 && <span className="text-[12px] text-gray-500">{inr(p.deposit)} deposit</span>}
          </div>

          <p className="text-[11px] font-mono tracking-wider text-gray-400 mt-1.5">{p.property_id}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4">
        <Stat label="Views" value={p.view_count ?? 0} />
        <Stat label="Visit slots" value={slotCount} />
        <Stat label="Photos" value={(p.images || []).length} />
        <Stat label="Verified" value={p.is_verified ? "Yes" : "No"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
        >
          {open ? "Hide details" : "View details"}
        </button>
        <Link to="/map" className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center">
          See on map
        </Link>
        {p.status === "published" && (
          <button type="button" disabled={busy} onClick={() => onStatus(p.property_id, "paused")}
            className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Pause listing
          </button>
        )}
        {p.status === "paused" && (
          <button type="button" disabled={busy} onClick={() => onStatus(p.property_id, "published")}
            className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Make it live
          </button>
        )}
        {!isClosed(p.status) && (
          <button type="button" disabled={busy} onClick={() => onStatus(p.property_id, "rented")}
            className="h-9 px-4 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
            Mark as rented
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 divide-y divide-gray-200/70">
            <div className="pb-1">
              <Row label="Posted as" value={p.posted_by} />
              <Row label="Listed on" value={fmtDate(p.created_at)} />
              <Row label="Available from" value={fmtDate(p.available_from)} />
            </div>
            <div className="py-1">
              <Row label="Flat type" value={p.flat_type} />
              <Row label="Bedrooms" value={p.bedrooms} />
              <Row label="Bathrooms" value={p.bathrooms} />
              <Row label="Furnishing" value={p.furnishing} />
              <Row label="Flatmates" value={p.max_flatmates || null} />
              <Row label="Preference" value={p.gender_pref && p.gender_pref !== "any" ? p.gender_pref : null} />
            </div>
            <div className="py-1">
              <Row label="Address" value={p.full_address} />
              <Row label="Landmark" value={p.landmark} />
              <Row label="Also covers" value={p.nearby_areas} />
            </div>
            <div className="py-1">
              <Row label="Occupants" value={p.occupants_allowed} />
              <Row label="Amenities" value={p.amenities} />
              <Row label="Lifestyle" value={p.lifestyle} />
              <Row label="House rules" value={p.house_rules} />
            </div>
            {p.description && (
              <div className="pt-2">
                <p className="text-[12px] text-gray-500 mb-1">Description</p>
                <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-line">{p.description}</p>
              </div>
            )}
            <div className="pt-2">
              <Row label="Contact on listing" value={p.phone} />
              <Row label="Posted by" value={p.poster_name} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyProperties() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [slotCounts, setSlotCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async (uid) => {
    setLoading(true);
    try {
      const list = await fetchMyInventory(uid);
      setRows(list);
      const ids = list.map((r) => r.property_id);
      if (ids.length) {
        const slots = await fetchSlotsFor(ids);
        const counts = {};
        for (const s of slots || []) {
          const pid = s.property_id;
          counts[pid] = (counts[pid] || 0) + 1;
        }
        setSlotCounts(counts);
      }
    } catch (e) {
      setErr(e?.message || "Could not load your properties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    load(user.uid);
  }, [authLoading, user]);

  const changeStatus = async (propertyId, status) => {
    setBusy(true);
    setErr("");
    try {
      await setInventoryStatus(propertyId, status);
      await load(user.uid);
    } catch (e) {
      setErr(e?.message || "Could not update this listing.");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => ({
    all: rows.length,
    live: rows.filter((r) => r.status === "published").length,
    rented: rows.filter((r) => isClosed(r.status)).length,
    views: rows.reduce((n, r) => n + (r.view_count || 0), 0),
  }), [rows]);

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="my-properties" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">My Properties</h1>
        <p className="text-[13px] text-gray-500 mt-1 mb-6">
          Everything you&apos;ve listed on MovEazy, and how each one is doing.
        </p>

        {!authLoading && !user ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">Sign in to see your properties</p>
            <p className="text-[13px] text-gray-500 mb-4">Your listings are tied to your MovEazy account.</p>
            <button type="button" onClick={() => openLogin()}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              Sign in
            </button>
          </div>
        ) : loading ? (
          <p className="text-[13px] text-gray-500">Loading your properties…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">You haven&apos;t listed a home yet</p>
            <p className="text-[13px] text-gray-500 mb-4">List your flat and it&apos;ll show up here with its views, visit slots and leads.</p>
            <button type="button" onClick={() => navigate("/list-my-flat")}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              List my flat
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
              <Stat label="Listed" value={totals.all} />
              <Stat label="Live" value={totals.live} />
              <Stat label="Rented" value={totals.rented} />
              <Stat label="Views" value={totals.views} />
            </div>

            {err && <p className="text-[12px] font-semibold text-red-500 mb-3">{err}</p>}

            <div className="space-y-4">
              {rows.map((p) => (
                <PropertyCard
                  key={p.property_id}
                  p={p}
                  slotCount={slotCounts[p.property_id] || 0}
                  onStatus={changeStatus}
                  busy={busy}
                />
              ))}
            </div>

            <button type="button" onClick={() => navigate("/list-my-flat")}
              className="w-full mt-6 h-12 rounded-xl text-[13px] font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">
              + List another property
            </button>
          </>
        )}
      </main>
    </div>
  );
}
