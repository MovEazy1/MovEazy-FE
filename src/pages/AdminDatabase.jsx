import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PageShell from "../components/layout/PageShell";
import { listTables, fetchTableRows } from "../lib/adminDb";
import VisitSlotsManager from "../components/admin/VisitSlotsManager";

const BRAND_RED = "#ff3131";

function fmtCell(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.length ? `[${v.join(", ")}]` : "[]";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? s.slice(0, 120) + "…" : s;
}

export default function AdminDatabase() {
  const { user, loading } = useAuth();

  const [tab, setTab] = useState("database"); // database | slots
  const [tables, setTables] = useState([]);
  const [source, setSource] = useState("");
  const [loadingTables, setLoadingTables] = useState(true);
  const [tablesError, setTablesError] = useState("");

  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState("");

  const isAdmin = user?.role === "admin";

  const loadTables = async () => {
    setLoadingTables(true);
    setTablesError("");
    try {
      const { tables: t, source: s, error } = await listTables();
      if (error) setTablesError(error);
      setTables(t);
      setSource(s || "");
    } catch (e) {
      setTablesError(e?.message || "Could not load tables.");
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadTables();
  }, [isAdmin]);

  const openTable = async (name) => {
    setSelected(name);
    setLoadingRows(true);
    setRowsError("");
    setRows([]); setColumns([]); setTotal(0);
    try {
      const { rows: r, columns: c, total: tot } = await fetchTableRows(name, { limit: 50 });
      setRows(r); setColumns(c); setTotal(tot);
    } catch (e) {
      setRowsError(e?.message || "Could not load rows.");
    } finally {
      setLoadingRows(false);
    }
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const t of tables) (g[t.group] ||= []).push(t);
    return g;
  }, [tables]);

  const totalRows = useMemo(() => tables.reduce((s, t) => s + (t.count || 0), 0), [tables]);

  // While auth resolves, render nothing (avoids flashing anything to a non-admin).
  if (loading) return null;

  // Non-admins (and signed-out visitors) are silently sent home — the panel gives
  // no indication it exists. Real enforcement is server-side RLS / the admin RPC.
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageShell variant="marketing" overlayOnly className="antialiased" style={{ background: "#f0ebe3" }}>
      <Navbar variant="marketing" />
      <main className="max-w-6xl mx-auto px-4 pb-16 pt-8">
        {/* Admin section tabs */}
        <div className="flex items-center rounded-full p-1 mb-6 w-fit" style={{ background: "#1c1917" }}>
          {[["database", "Database"], ["slots", "Visit slots"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              className="px-5 py-2 rounded-full text-[13px] font-bold transition-all"
              style={{ background: tab === v ? "white" : "transparent", color: tab === v ? "#1c1917" : "rgba(255,255,255,0.55)" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "slots" ? (
          <>
            <div className="mb-6">
              <h1 className="text-[24px] font-extrabold text-gray-900">Visit slots</h1>
              <p className="text-[13px] text-gray-500">Add or remove the visit slots renters can book, per property.</p>
            </div>
            <VisitSlotsManager />
          </>
        ) : (
        <>
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[24px] font-extrabold text-gray-900">Database</h1>
            <p className="text-[13px] text-gray-500">
              Every table on the Supabase backend.{" "}
              {source === "registry" && (
                <span className="text-amber-600">Live discovery RPC not installed — showing the known-table registry.</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Tables</p>
              <p className="text-[18px] font-extrabold text-gray-900">{tables.length}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">Total rows</p>
              <p className="text-[18px] font-extrabold text-gray-900">{totalRows.toLocaleString("en-IN")}</p>
            </div>
            <button type="button" onClick={loadTables}
              className="px-4 py-2 rounded-xl text-[13px] font-bold text-white" style={{ background: BRAND_RED }}>
              Refresh
            </button>
          </div>
        </div>

        {tablesError && (
          <div className="mb-4 p-4 rounded-xl text-[13px] font-medium border bg-red-50 text-red-700 border-red-200">
            {tablesError}
          </div>
        )}

        <div className="grid md:grid-cols-[320px_1fr] gap-5">
          {/* Table list */}
          <div className="space-y-4">
            {loadingTables && <p className="text-[13px] text-gray-500 px-1">Loading tables…</p>}
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2 px-1">{group}</p>
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {items.map((t) => (
                    <button key={t.name} type="button" onClick={() => openTable(t.name)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-100 last:border-0 transition-colors hover:bg-gray-50"
                      style={{ background: selected === t.name ? "#fff5f5" : "transparent" }}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 font-mono truncate">{t.name}</p>
                        {t.desc && <p className="text-[11px] text-gray-400 truncate">{t.desc}</p>}
                      </div>
                      <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ background: t.missing ? "#fef2f2" : "#f1f5f9", color: t.missing ? "#dc2626" : "#475569" }}>
                        {t.missing ? "missing" : (t.count ?? "?")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Row viewer */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px]">
            {!selected ? (
              <div className="p-10 text-center text-gray-400 text-[14px]">
                Select a table to browse its rows.
              </div>
            ) : (
              <div>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-[15px] font-extrabold text-gray-900 font-mono">{selected}</p>
                    <p className="text-[12px] text-gray-400">
                      {loadingRows ? "Loading…" : `${total.toLocaleString("en-IN")} row${total === 1 ? "" : "s"} · showing up to 50`}
                    </p>
                  </div>
                  <button type="button" onClick={() => openTable(selected)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">
                    Reload
                  </button>
                </div>

                {rowsError && (
                  <div className="m-4 p-4 rounded-xl text-[13px] font-medium border bg-red-50 text-red-700 border-red-200">
                    {rowsError}
                  </div>
                )}

                {!loadingRows && !rowsError && rows.length === 0 && (
                  <div className="p-10 text-center text-gray-400 text-[14px]">This table is empty.</div>
                )}

                {rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {columns.map((c) => (
                            <th key={c} className="text-left font-bold text-gray-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap font-mono">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                            {columns.map((c) => (
                              <td key={c} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[280px] truncate" title={fmtCell(row[c])}>
                                {fmtCell(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </main>
      <Footer />
    </PageShell>
  );
}
