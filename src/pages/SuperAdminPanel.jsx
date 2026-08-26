/**
 * Superadmin panel — demand (client leads), supply (flat leads) and the
 * people behind them (owners, brokers).
 *
 * Access is hardcoded to SUPERADMIN_EMAIL (see lib/adminAccess.js) — deliberately
 * NOT the general role==="admin"/admin_allowlist system, so adding someone else
 * as a regular admin can never grant them this panel.
 *
 * Once in, the data itself is still gated by Postgres: every table here is
 * RLS'd to "own rows or is_admin_allowlisted()", so the numbers only fill in
 * if this email is also present in public.admin_allowlist.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isSuperAdminEmail } from "../lib/adminAccess";
import MovEazyNav from "../components/layout/MovEazyNav";
import {
  fetchProfiles, fetchSearchProfiles, fetchRequirements, fetchBookings,
  fetchActions, fetchInventoryAll,
  buildClientLeads, buildFlatLeads, buildPosters, buildBrokers,
  BUCKETS, FLAT_SOURCES,
} from "../lib/adminLeads";

const inr = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const budget = (a, b) => (a || b ? `${inr(a)} – ${inr(b)}` : "—");

const TABS = [
  { id: "clients", label: "Client Leads" },
  { id: "flats",   label: "Flat Leads" },
  { id: "owners",  label: "Owners" },
  { id: "brokers", label: "Brokers" },
];

function Pill({ active, onClick, children, count }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap border transition ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
      {children}{typeof count === "number" && <span className={`ml-1.5 ${active ? "text-white/70" : "text-gray-400"}`}>{count}</span>}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 px-3 py-3 text-center">
      <p className="text-[19px] font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1.5">{label}</p>
    </div>
  );
}

function Table({ cols, rows, empty }) {
  if (!rows.length) return <p className="text-[13px] text-gray-400 py-8 text-center">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {cols.map((c) => (
              <th key={c.key} className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 whitespace-nowrap border-b border-gray-200">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._key || i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
              {cols.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-[12.5px] text-gray-800 whitespace-nowrap">{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SuperAdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = isSuperAdminEmail(user?.email);

  const [tab, setTab] = useState("clients");
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState(null);

  // shared filters
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [bucket, setBucket] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("moveIn");

  useEffect(() => {
    if (authLoading || !isAdmin) { if (!authLoading) setLoading(false); return; }
    let alive = true;
    (async () => {
      const [profiles, searchProfiles, requirements, bookings, actions, inventory] = await Promise.all([
        fetchProfiles(), fetchSearchProfiles(), fetchRequirements(),
        fetchBookings(), fetchActions(), fetchInventoryAll(),
      ]);
      if (alive) {
        setRaw({ profiles, searchProfiles, requirements, bookings, actions, inventory });
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [authLoading, isAdmin]);

  const clients = useMemo(() => (raw ? buildClientLeads(raw) : []), [raw]);
  const flats = useMemo(() => (raw ? buildFlatLeads(raw.inventory) : []), [raw]);
  const owners = useMemo(() => (raw ? buildPosters(raw.inventory, raw.profiles, "owner") : []), [raw]);
  const brokers = useMemo(() => (raw ? buildBrokers(raw.inventory, raw.profiles) : []), [raw]);

  const allAreas = useMemo(() => {
    const s = new Set();
    clients.forEach((c) => c.areas.forEach((a) => a && s.add(a)));
    flats.forEach((f) => f.area && s.add(f.area));
    return [...s].sort();
  }, [clients, flats]);

  const matchesText = (hay) => !q || hay.filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase());

  const clientRows = useMemo(() => {
    let out = clients
      .filter((c) => bucket === "all" || c.bucket === bucket)
      .filter((c) => !area || c.areas.includes(area))
      .filter((c) => matchesText([c.email, c.name, c.phone, ...(c.areas || [])]));
    out = [...out].sort((a, b) =>
      sortBy === "moveIn" ? a.moveInTs - b.moveInTs
      : sortBy === "recent" ? String(b.lastActivity || "").localeCompare(String(a.lastActivity || ""))
      : String(b.signedUpAt || "").localeCompare(String(a.signedUpAt || "")));
    return out.map((c) => ({ ...c, _key: c.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, bucket, area, q, sortBy]);

  const flatRows = useMemo(() => flats
    .filter((f) => source === "all" || f.source === source)
    .filter((f) => status === "all" || (status === "closed" ? f.closed : f.status === status))
    .filter((f) => !area || f.area === area)
    .filter((f) => matchesText([f.title, f.area, f.property_id, f.poster_email, f.poster_name]))
    .map((f) => ({ ...f, _key: f.property_id })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flats, source, status, area, q]);

  const posterRows = (list) => list
    .filter((o) => !area || o.areas.includes(area))
    .filter((o) => matchesText([o.name, o.email, o.phone, ...(o.areas || [])]))
    .sort((a, b) => b.total - a.total)
    .map((o) => ({ ...o, _key: o.key }));

  if (!authLoading && !isAdmin) {
    return (
      <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <MovEazyNav active="" />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-[22px] font-extrabold text-gray-900 mb-2">Superadmin only</h1>
          <p className="text-[13px] text-gray-500 mb-6">This panel is limited to the MovEazy founder account.</p>
          <Link to="/" className="text-[13px] font-bold" style={{ color: "#ff3131" }}>← Back to home</Link>
        </main>
      </div>
    );
  }

  const bucketCounts = Object.fromEntries(BUCKETS.map((b) => [b.id, clients.filter((c) => c.bucket === b.id).length]));

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">Superadmin panel</h1>
            <p className="text-[13px] text-gray-500 mt-1">Demand, supply and the people behind them.</p>
          </div>
          <Link to="/admin" className="text-[12px] font-bold text-gray-500 hover:text-gray-800">Raw tables →</Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
          {TABS.map((t) => <Pill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Pill>)}
        </div>

        {loading ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : (
          <>
            {/* filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, area…"
                className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none focus:border-gray-400" />
              <select value={area} onChange={(e) => setArea(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none">
                <option value="">All areas</option>
                {allAreas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {tab === "clients" && (
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none">
                  <option value="moveIn">Sort: move-in date</option>
                  <option value="recent">Sort: last activity</option>
                  <option value="signup">Sort: newest signup</option>
                </select>
              )}
              {tab === "flats" && (
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none">
                  <option value="all">All statuses</option>
                  <option value="published">Live</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Rented</option>
                </select>
              )}
            </div>

            {/* ── CLIENT LEADS ── */}
            {tab === "clients" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                  {BUCKETS.map((b) => <Stat key={b.id} label={b.label} value={bucketCounts[b.id] || 0} />)}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  <Pill active={bucket === "all"} onClick={() => setBucket("all")} count={clients.length}>All</Pill>
                  {BUCKETS.map((b) => (
                    <Pill key={b.id} active={bucket === b.id} onClick={() => setBucket(b.id)} count={bucketCounts[b.id] || 0}>{b.label}</Pill>
                  ))}
                </div>
                {bucket !== "all" && (
                  <p className="text-[12px] text-gray-500 mb-3">{BUCKETS.find((b) => b.id === bucket)?.hint}</p>
                )}
                <p className="text-[12px] text-gray-400 mb-2">{clientRows.length} people</p>
                <Table
                  empty="No one in this bucket yet."
                  rows={clientRows}
                  cols={[
                    { key: "who", label: "Who", render: (r) => (
                      <div className="min-w-[180px]">
                        <p className="font-bold text-gray-900">{r.name || r.email}</p>
                        {r.name && <p className="text-[11px] text-gray-500">{r.email}</p>}
                      </div>) },
                    { key: "phone", label: "Phone", render: (r) => r.phone || "—" },
                    { key: "movein", label: "Move-in", render: (r) => <span className="font-semibold">{r.moveInLabel}</span> },
                    { key: "areas", label: "Areas", render: (r) => (r.areas.length ? r.areas.slice(0, 3).join(", ") + (r.areas.length > 3 ? ` +${r.areas.length - 3}` : "") : "—") },
                    { key: "budget", label: "Budget", render: (r) => budget(r.budgetMin, r.budgetMax) },
                    { key: "bhk", label: "Type", render: (r) => r.bhk || "—" },
                    { key: "act", label: "Activity", render: (r) => (
                      <span className="text-[11px] text-gray-600">{r.visits}v · {r.shortlists}s · {r.interactions}i</span>) },
                    { key: "signup", label: "Signed up", render: (r) => fmtDate(r.signedUpAt) },
                  ]}
                />
              </>
            )}

            {/* ── FLAT LEADS ── */}
            {tab === "flats" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <Stat label="Total flats" value={flats.length} />
                  {FLAT_SOURCES.map((s) => <Stat key={s.id} label={s.label} value={flats.filter((f) => f.source === s.id).length} />)}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  <Pill active={source === "all"} onClick={() => setSource("all")} count={flats.length}>All sources</Pill>
                  {FLAT_SOURCES.map((s) => (
                    <Pill key={s.id} active={source === s.id} onClick={() => setSource(s.id)} count={flats.filter((f) => f.source === s.id).length}>{s.label}</Pill>
                  ))}
                </div>
                <p className="text-[12px] text-gray-400 mb-2">{flatRows.length} flats</p>
                <Table
                  empty="No flats match these filters."
                  rows={flatRows}
                  cols={[
                    { key: "flat", label: "Flat", render: (r) => (
                      <div className="min-w-[180px]">
                        <p className="font-bold text-gray-900">{r.title || `${r.flat_type || "Home"} in ${r.area || "—"}`}</p>
                        <p className="text-[11px] font-mono tracking-wider text-gray-400">{r.property_id}</p>
                      </div>) },
                    { key: "src", label: "Source", render: (r) => <span className="capitalize">{r.source}</span> },
                    { key: "area", label: "Area", render: (r) => r.area || "—" },
                    { key: "rent", label: "Rent", render: (r) => inr(r.rent) },
                    { key: "status", label: "Status", render: (r) => (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={r.closed ? { background: "#f1f5f9", color: "#475569" }
                          : r.status === "paused" ? { background: "#fffbeb", color: "#b45309" }
                          : { background: "#ecfdf5", color: "#15803d" }}>
                        {r.closed ? "Rented" : r.status === "paused" ? "Paused" : "Live"}
                      </span>) },
                    { key: "views", label: "Views", render: (r) => r.view_count ?? 0 },
                    { key: "poster", label: "Posted by", render: (r) => (
                      <div className="min-w-[150px]">
                        <p className="text-gray-800">{r.poster_name || "—"}</p>
                        <p className="text-[11px] text-gray-500">{r.poster_email || r.phone || ""}</p>
                      </div>) },
                    { key: "when", label: "Listed", render: (r) => fmtDate(r.created_at) },
                  ]}
                />
              </>
            )}

            {/* ── OWNERS / BROKERS ── */}
            {(tab === "owners" || tab === "brokers") && (() => {
              const list = posterRows(tab === "owners" ? owners : brokers);
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <Stat label={tab === "owners" ? "Owners" : "Brokers"} value={list.length} />
                    <Stat label="Active" value={list.filter((o) => o.active).length} />
                    <Stat label="Flats listed" value={list.reduce((n, o) => n + o.total, 0)} />
                    <Stat label="Closed" value={list.reduce((n, o) => n + o.closed, 0)} />
                  </div>
                  <p className="text-[12px] text-gray-400 mb-2">{list.length} {tab}</p>
                  <Table
                    empty={`No ${tab} yet.`}
                    rows={list}
                    cols={[
                      { key: "who", label: "Who", render: (r) => (
                        <div className="min-w-[180px]">
                          <p className="font-bold text-gray-900">{r.name || r.email}</p>
                          {r.name && <p className="text-[11px] text-gray-500">{r.email}</p>}
                        </div>) },
                      { key: "phone", label: "Phone", render: (r) => r.phone || "—" },
                      { key: "status", label: "Status", render: (r) => (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={r.active ? { background: "#ecfdf5", color: "#15803d" } : { background: "#f1f5f9", color: "#64748b" }}>
                          {r.active ? "Active" : r.total ? "Inactive" : "No listings"}
                        </span>) },
                      { key: "total", label: "Flats", render: (r) => r.total },
                      { key: "live", label: "Live", render: (r) => r.live },
                      { key: "closed", label: "Closed", render: (r) => r.closed },
                      { key: "views", label: "Views", render: (r) => r.views },
                      { key: "areas", label: "Areas", render: (r) => (r.areas.length ? r.areas.slice(0, 2).join(", ") + (r.areas.length > 2 ? ` +${r.areas.length - 2}` : "") : "—") },
                      { key: "last", label: "Last listed", render: (r) => fmtDate(r.lastListedAt) },
                    ]}
                  />
                </>
              );
            })()}

            {raw && !raw.profiles.length && (
              <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
                No user rows came back. Row-level security only returns other people&apos;s data when your email
                is in <code>public.admin_allowlist</code> — add it in Supabase if these tables look empty.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
