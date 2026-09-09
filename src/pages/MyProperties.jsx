/**
 * "My Properties" — everything the signed-in user has put on MovEazy, whichever
 * role they posted as (owner / tenant / broker).
 *
 * Reachable from the nav only once they actually have a listing, so the option
 * never shows up empty for seekers who have never posted.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, MoreVertical, Share2, PauseCircle, PlayCircle, CalendarClock,
  Home as HomeIcon, Plus, Check,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import { fetchMyInventory, setInventoryStatus } from "../lib/inventory";
import { fetchSlotsFor } from "../lib/visits";
import { fetchMyListingStats } from "../lib/ownerDashboard";
import PropertyVisitSlots from "../components/PropertyVisitSlots";

/** Shared with the listing view — one emerald palette across the owner journey. */
const T = {
  ink: "#04211D",
  teal: "#0E7C68",
  mint: "#5EEAD4",
  mintSoft: "#E4F6F1",
  cream: "#F7FAF8",
  page: "#F4F6F5",
  card: "#FFFFFF",
  line: "#DCE8E5",
  lineSoft: "#EDF3F1",
  text: "#12211E",
  textDim: "#4A5B57",
  textMute: "#7A8F8A",
  coral: "#E2573C",
  gold: "#B0740F",
};

const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const STATUS = {
  published: { label: "Live", bg: T.teal, fg: "#fff" },
  paused: { label: "Inactive", bg: "#EFE2C8", fg: T.gold },
  rented: { label: "Rented", bg: T.lineSoft, fg: T.textDim },
  sold: { label: "Rented", bg: T.lineSoft, fg: T.textDim },
};
const isClosed = (status) => status === "rented" || status === "sold";

export function Stat({ label, value }) {
  return (
    <div style={{ textAlign: "center", minWidth: 0, flex: 1 }}>
      <p style={{ fontSize: 19, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: T.textMute, margin: "3px 0 0", lineHeight: 1.25 }}>{label}</p>
    </div>
  );
}

function Row({ label, value }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span style={{ fontSize: 12, color: T.textMute, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.text, textAlign: "right" }}>
        {Array.isArray(value) ? value.join(", ") : value}
      </span>
    </div>
  );
}

const actionBtn = {
  flex: 1, minWidth: 0, height: 40, borderRadius: 10,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", padding: "0 6px",
  background: T.cream, color: T.textDim, border: `1px solid ${T.line}`,
};

export function PropertyCard({ p, slotCount, onStatus, busy, onSlotCountChange, onShare }) {
  // "" | "details" | "slots" — one panel at a time. The two are separate
  // because they answer different questions: what is this listing, versus
  // when can people come and see it.
  const [panel, setPanel] = useState("");
  const slotsRef = useRef(null);
  const st = STATUS[p.status] || STATUS.published;
  const cover = p.cover_image_url || (p.images || [])[0] || "";

  // "Visit slots" opens the slots editor on its own. It deliberately does not
  // unfold the property's detail table first — the owner came to set times,
  // and twenty rows of flat type, address and occupants were in the way.
  const goToSlots = () => {
    setPanel((current) => (current === "slots" ? "" : "slots"));
    requestAnimationFrame(() => {
      setTimeout(() => slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    });
  };

  return (
    <div style={{ borderRadius: 16, background: T.card, border: `1px solid ${T.line}`, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 14, padding: 14 }}>
        <div
          style={{
            width: 104, height: 104, borderRadius: 12, flexShrink: 0, position: "relative",
            background: cover ? `url(${cover}) center/cover` : T.lineSoft,
          }}
        >
          <span
            style={{
              position: "absolute", top: 8, left: 8,
              padding: "3px 9px", borderRadius: 999,
              fontSize: 11, fontWeight: 700, background: st.bg, color: st.fg,
            }}
          >
            {st.label}
          </span>
          {!cover && (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, color: T.textMute }}>
              No photo
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontSize: 15.5, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.25 }}>
              {p.title || `${p.flat_type || "Home"} in ${p.area || p.city || "Bengaluru"}`}
            </p>
            <button
              type="button"
              aria-label={panel === "details" ? "Hide details" : "Show details"}
              onClick={() => setPanel((current) => (current === "details" ? "" : "details"))}
              style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: T.textMute, padding: 2 }}
            >
              <MoreVertical size={18} />
            </button>
          </div>

          <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: T.textMute, margin: "5px 0 0" }}>
            <MapPin size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[p.area, p.city].filter(Boolean).join(", ") || "—"}
            </span>
          </p>

          <p style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 800, color: T.text }}>
            {inr(p.rent)}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.textMute }}> / month</span>
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "12px 8px", borderTop: `1px solid ${T.lineSoft}` }}>
        <Stat label="Views" value={p.view_count ?? 0} />
        <Stat label="Interested" value={p.like_count ?? 0} />
        <Stat label="Visit Requests" value={p.visit_count ?? 0} />
        <Stat label="Shortlisted" value={p.shortlist_count ?? 0} />
      </div>

      <div style={{ display: "flex", gap: 7, padding: "0 14px 14px" }}>
        <button type="button" onClick={goToSlots} disabled={isClosed(p.status)} style={{ ...actionBtn, opacity: isClosed(p.status) ? 0.5 : 1 }}>
          <CalendarClock size={14} style={{ flexShrink: 0 }} />
          Visit slots{slotCount ? ` (${slotCount})` : ""}
        </button>
        {p.status === "published" ? (
          <button type="button" disabled={busy} onClick={() => onStatus(p.property_id, "paused")} style={actionBtn}>
            <PauseCircle size={14} style={{ flexShrink: 0 }} />
            Set inactive
          </button>
        ) : (
          <button type="button" disabled={busy || isClosed(p.status)} onClick={() => onStatus(p.property_id, "published")}
            style={{ ...actionBtn, opacity: isClosed(p.status) ? 0.5 : 1 }}>
            <PlayCircle size={14} style={{ flexShrink: 0 }} />
            Make it live
          </button>
        )}
        <button type="button" onClick={() => onShare(p)} style={actionBtn}>
          <Share2 size={14} style={{ flexShrink: 0 }} />
          Share
        </button>
      </div>

      {panel === "details" && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ borderRadius: 12, border: `1px solid ${T.line}`, background: T.cream, padding: 14 }}>
            <div className="pb-1">
              <Row label="Property ID" value={p.property_id} />
              <Row label="Posted as" value={p.posted_by} />
              <Row label="Listed on" value={fmtDate(p.created_at)} />
              <Row label="Available from" value={fmtDate(p.available_from)} />
            </div>
            <div className="py-1">
              <Row label="Flat type" value={p.flat_type} />
              <Row label="Bedrooms" value={p.bedrooms} />
              <Row label="Bathrooms" value={p.bathrooms} />
              <Row label="Furnishing" value={p.furnishing} />
              <Row label="Deposit" value={Number(p.deposit) > 0 ? inr(p.deposit) : null} />
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
                <p style={{ fontSize: 12, color: T.textMute, marginBottom: 4 }}>Description</p>
                <p style={{ fontSize: 12, color: T.text, lineHeight: 1.6, whiteSpace: "pre-line" }}>{p.description}</p>
              </div>
            )}
            <div className="pt-2">
              <Row label="Contact on listing" value={p.phone} />
              <Row label="Posted by" value={p.poster_name} />
            </div>
            {!isClosed(p.status) && (
              <div className="pt-3">
                <button type="button" disabled={busy} onClick={() => onStatus(p.property_id, "rented")}
                  style={{ ...actionBtn, flex: "none", padding: "0 16px", color: T.coral, borderColor: "#E8C4BC" }}>
                  Mark as rented
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {panel === "slots" && !isClosed(p.status) && (
        <div ref={slotsRef} style={{ padding: "0 14px 14px" }}>
          <PropertyVisitSlots
            propertyId={p.property_id}
            hideMarkSold
            onSlotsChanged={(count) => onSlotCountChange?.(p.property_id, count)}
          />
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "drafts", label: "Drafts" },
];

export default function MyProperties() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [slotCounts, setSlotCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("active");
  const [shared, setShared] = useState("");

  const load = async (uid) => {
    setLoading(true);
    try {
      const [list, statRows] = await Promise.all([
        fetchMyInventory(uid),
        fetchMyListingStats(), // per-property counts; already scoped server-side to this poster
      ]);
      const statsByProperty = new Map(statRows.map((s) => [s.property_id, s]));
      const merged = list.map((r) => {
        const s = statsByProperty.get(r.property_id);
        return {
          ...r,
          shortlist_count: s?.shortlist_count || 0,
          // "Interested" is a like on the listing — the reaction a seeker leaves
          // before they commit to asking for a visit.
          like_count: s?.like_count || 0,
          visit_count: (s?.visit_request_count || 0) + (s?.visit_booking_count || 0),
        };
      });
      setRows(merged);
      const ids = list.map((r) => r.property_id);
      if (ids.length) {
        // fetchSlotsFor resolves to { [property_id]: [slot, ...] }, not a flat
        // list — count each property's own array length directly.
        const slotsByProperty = await fetchSlotsFor(ids);
        const counts = {};
        for (const pid of Object.keys(slotsByProperty || {})) {
          counts[pid] = (slotsByProperty[pid] || []).length;
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

  // PropertyVisitSlots reports its own live count after each add/remove, so the
  // slot count doesn't go stale until the next full reload.
  const handleSlotCountChange = (propertyId, count) => {
    setSlotCounts((prev) => ({ ...prev, [propertyId]: count }));
  };

  const share = async (p) => {
    const url = `${window.location.origin}/p/${encodeURIComponent(p.property_id)}`;
    const title = p.title || `${p.flat_type || "Home"} in ${p.area || "Bengaluru"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — ${inr(p.rent)}/month on MovEazy`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(p.property_id);
      setTimeout(() => setShared(""), 2000);
    } catch { /* the user dismissed the share sheet */ }
  };

  const buckets = useMemo(() => ({
    active: rows.filter((r) => r.status === "published"),
    inactive: rows.filter((r) => r.status !== "published"),
    drafts: [],
  }), [rows]);

  const visible = buckets[tab] ?? [];

  return (
    <div style={{ background: T.page, minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="my-properties" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6" style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>
              My Properties
            </h1>
            <p style={{ fontSize: 13, color: T.textMute, margin: "5px 0 0", lineHeight: 1.45 }}>
              Manage your listings, track requests and schedule visits
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/list-my-flat")}
            style={{
              flexShrink: 0, height: 44, padding: "0 18px", borderRadius: 999, border: "none",
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              background: T.coral, color: "#fff", fontSize: 14, fontWeight: 700,
            }}
          >
            <Plus size={17} strokeWidth={2.4} />
            Post Property
          </button>
        </div>

        {!authLoading && !user ? (
          <div style={{ marginTop: 24, borderRadius: 16, background: T.card, border: `1px solid ${T.line}`, padding: 32, textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Sign in to see your properties</p>
            <p style={{ fontSize: 13, color: T.textMute, marginBottom: 16 }}>Your listings are tied to your MovEazy account.</p>
            <button type="button" onClick={() => openLogin()}
              style={{ height: 44, padding: "0 24px", borderRadius: 12, border: "none", background: T.teal, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 22, marginTop: 20, borderBottom: `1px solid ${T.line}` }}>
              {TABS.map((t) => {
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "0 0 10px",
                      fontSize: 14, fontWeight: on ? 800 : 600,
                      color: on ? T.text : T.textMute,
                      borderBottom: `2px solid ${on ? T.teal : "transparent"}`,
                      marginBottom: -1,
                    }}
                  >
                    {t.label} ({(buckets[t.id] ?? []).length})
                  </button>
                );
              })}
            </div>

            {err && <p style={{ fontSize: 12, fontWeight: 600, color: T.coral, marginTop: 12 }}>{err}</p>}

            {loading ? (
              <p style={{ fontSize: 13, color: T.textMute, marginTop: 20 }}>Loading your properties…</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 18 }}>
                {visible.map((p) => (
                  <PropertyCard
                    key={p.property_id}
                    p={p}
                    slotCount={slotCounts[p.property_id] || 0}
                    onStatus={changeStatus}
                    busy={busy}
                    onSlotCountChange={handleSlotCountChange}
                    onShare={share}
                  />
                ))}

                {visible.length === 0 && tab === "drafts" && (
                  <div style={{ borderRadius: 16, background: T.card, border: `1px solid ${T.line}`, padding: 28, textAlign: "center" }}>
                    <p style={{ fontSize: 13.5, color: T.textMute, margin: 0, lineHeight: 1.5 }}>
                      Nothing here — a listing goes live as soon as you post it, so there are no drafts to keep.
                    </p>
                  </div>
                )}

                {visible.length === 0 && tab === "inactive" && (
                  <div style={{ borderRadius: 16, background: T.card, border: `1px solid ${T.line}`, padding: 28, textAlign: "center" }}>
                    <p style={{ fontSize: 13.5, color: T.textMute, margin: 0 }}>
                      Nothing paused or rented out. Everything you&apos;ve listed is live.
                    </p>
                  </div>
                )}

                {/* The prompt to list again — and, when there is nothing at all,
                    the thing that gets someone started. */}
                {(tab !== "drafts" || visible.length === 0) && (
                  <div
                    style={{
                      borderRadius: 16, background: T.mintSoft, border: `1px solid ${T.line}`,
                      padding: "28px 24px", textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 62, height: 62, borderRadius: "50%", margin: "0 auto 14px",
                        background: "rgba(255,255,255,0.72)", display: "grid", placeItems: "center",
                      }}
                    >
                      <HomeIcon size={26} strokeWidth={1.8} color={T.text} />
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>
                      {rows.length === 0 ? "You haven't listed a home yet" : "Post more properties"}
                    </p>
                    <p style={{ fontSize: 13.5, color: T.textDim, margin: "0 0 18px", lineHeight: 1.5 }}>
                      Reach more genuine tenants and find the right match faster.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/list-my-flat")}
                      style={{
                        width: "100%", height: 48, borderRadius: 12, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                        background: T.card, color: T.text, border: `1px solid ${T.line}`,
                        fontSize: 14.5, fontWeight: 700,
                      }}
                    >
                      <Plus size={18} strokeWidth={2.3} />
                      {rows.length === 0 ? "Post your first property" : "Post Another Property"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {shared && (
          <div
            role="status"
            style={{
              position: "fixed", bottom: "calc(88px + env(safe-area-inset-bottom, 0px))", left: "50%",
              transform: "translateX(-50%)", background: T.ink, color: "#fff",
              padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, zIndex: 200,
            }}
          >
            <Check size={15} /> Link copied
          </div>
        )}
      </main>
    </div>
  );
}
