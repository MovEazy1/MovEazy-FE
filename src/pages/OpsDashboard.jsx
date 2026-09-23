/**
 * /dashboard — the six numbers the company is run on, day by day.
 *
 * Deliberately not the CRM and not the super-admin panel: no names, no phone
 * numbers, no rows anyone could be worked from. That is what makes it grantable
 * to someone who should see how MovEazy is doing without being handed the
 * client list — see the grant panel in /superadmin.
 *
 * Access is Postgres's call, not this file's: ops_daily_metrics() returns an
 * empty set to anyone can_view_ops_dashboard() refuses. The gate below exists so
 * a refused visitor reads "you don't have access" rather than six tables of
 * zeroes, which look identical to a quiet week.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import { Notice, Table } from "./marketing/marketingUi";
import {
  METRICS, RANGES, addDays, canViewOpsDashboard, dayDeltas, daysBetween, downloadCsv,
  fetchOpsDaily, fmtDay, isMissingMigration, istToday, rangeFor, summarize,
} from "../lib/opsDashboard";

const PAGE_BG = "#f3f4f6";
const FONT = "'Manrope', system-ui, sans-serif";

const num = (n) => (Number.isFinite(n) ? n.toLocaleString("en-IN") : "—");

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap border transition ${
        active
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

/** Movement against the equivalent stretch before this one. */
function Change({ value }) {
  if (value === null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span
      className="text-[11px] font-bold"
      style={{ color: value === 0 ? "#9ca3af" : up ? "#15803d" : "#b91c1c" }}
    >
      {value > 0 ? "+" : ""}
      {Math.round(value)}%
    </span>
  );
}

/** A day's value against the biggest day in view. Shape at a glance, no library. */
function Bar({ value, peak }) {
  const w = peak > 0 && value > 0 ? Math.max(3, Math.round((value / peak) * 100)) : 0;
  return (
    <div className="w-[120px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: "#111827" }} />
    </div>
  );
}

function Delta({ value }) {
  if (value === null) return <span className="text-gray-300">—</span>;
  if (value === 0) return <span className="text-gray-400">0</span>;
  return (
    <span className="font-bold" style={{ color: value > 0 ? "#15803d" : "#b91c1c" }}>
      {value > 0 ? "+" : ""}
      {value}
    </span>
  );
}

function SummaryTile({ metric, stats }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 px-3 py-3" title={metric.hint}>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[21px] font-extrabold text-gray-900 leading-none">
          {num(stats.headline)}
        </p>
        <Change value={stats.change} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1.5 leading-tight">
        {metric.label}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {metric.kind === "level" ? "latest day" : "range total"}
      </p>
    </div>
  );
}

/**
 * One metric, one table: every day in the timeframe, in order, newest first.
 *
 * Every day is a row even at zero. A day-on-day table that skips empty days
 * hides exactly the thing it is read for.
 */
function MetricTable({ metric, rows, stats }) {
  const series = useMemo(() => dayDeltas(metric, rows), [metric, rows]);
  const peak = stats.peak;

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
        <div>
          <h2 className="text-[16px] font-extrabold text-gray-900">Day on day · {metric.label}</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">{metric.hint}</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-500">
          <span>
            <span className="font-bold text-gray-900">{num(stats.headline)}</span>{" "}
            {metric.kind === "level" ? "latest" : "total"}
          </span>
          <span>
            <span className="font-bold text-gray-900">
              {stats.average.toFixed(stats.average >= 10 ? 0 : 1)}
            </span>{" "}
            /day
          </span>
          <span>
            <span className="font-bold text-gray-900">{num(stats.peak)}</span> peak
          </span>
        </div>
      </div>

      <Table
        empty="No days in this timeframe."
        rows={series.map((s) => ({ ...s, _key: s.day }))}
        cols={[
          { key: "day", label: "Date", render: (r) => <span className="font-semibold">{fmtDay(r.day)}</span> },
          {
            key: "value",
            label: metric.label,
            render: (r) => <span className="font-extrabold text-gray-900">{num(r.value)}</span>,
          },
          { key: "delta", label: "vs prev day", render: (r) => <Delta value={r.delta} /> },
          { key: "bar", label: "", render: (r) => <Bar value={r.value} peak={peak} /> },
        ]}
      />
    </section>
  );
}

/* ── Timeframe ────────────────────────────────────────────────────────────── */

const dateInput =
  "px-3 py-2 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-700 outline-none focus:border-gray-400";

function TimeframeBar({ preset, from, to, onPreset, onFrom, onTo, onExport, busy }) {
  const today = istToday();
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      {RANGES.filter((r) => r.days).map((r) => (
        <Pill key={r.id} active={preset === r.id} onClick={() => onPreset(r)}>
          {r.label}
        </Pill>
      ))}
      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 ml-1">from</span>
      <input type="date" className={dateInput} value={from} max={to} onChange={(e) => onFrom(e.target.value)} />
      <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">to</span>
      <input type="date" className={dateInput} value={to} min={from} max={today} onChange={(e) => onTo(e.target.value)} />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        className="px-3.5 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
        style={{ background: "#111827" }}
      >
        Export CSV
      </button>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

function Shell({ children }) {
  return (
    <div style={{ background: PAGE_BG, minHeight: "100dvh", fontFamily: FONT }}>
      <MovEazyNav active="" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

export default function OpsDashboard() {
  const { user, loading: authLoading } = useAuth();

  const [allowed, setAllowed] = useState(null); // null = still checking
  const [accessError, setAccessError] = useState(null);

  const initial = rangeFor(30);
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const [rows, setRows] = useState([]);
  const [previousRows, setPreviousRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading || !user?.email) return undefined;
    let alive = true;
    canViewOpsDashboard()
      .then((ok) => alive && setAllowed(ok))
      .catch((e) => {
        if (!alive) return;
        setAccessError(e);
        setAllowed(false);
      });
    return () => {
      alive = false;
    };
  }, [authLoading, user?.email]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const span = daysBetween(from, to);
      // The stretch immediately before this one, same length — the only
      // comparison that makes "+18%" mean anything on an arbitrary timeframe.
      const prev = { from: addDays(from, -span), to: addDays(from, -1) };
      const [current, previous] = await Promise.all([
        fetchOpsDaily({ from, to }),
        fetchOpsDaily(prev),
      ]);
      setRows(current);
      setPreviousRows(previous);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (allowed !== true) return;
    load();
  }, [allowed, load]);

  const stats = useMemo(
    () =>
      Object.fromEntries(
        METRICS.map((m) => [m.key, summarize(m, rows, previousRows)]),
      ),
    [rows, previousRows],
  );

  const applyPreset = (r) => {
    const next = rangeFor(r.days);
    setPreset(r.id);
    setFrom(next.from);
    setTo(next.to);
  };

  if (authLoading) {
    return (
      <Shell>
        <p className="text-[13px] text-gray-500">Checking access…</p>
      </Shell>
    );
  }

  if (!user) return <Navigate to="/auth?next=/dashboard" replace />;

  if (allowed === null) {
    return (
      <Shell>
        <p className="text-[13px] text-gray-500">Checking access…</p>
      </Shell>
    );
  }

  if (allowed === false) {
    return (
      <Shell>
        <div className="max-w-xl">
          <h1 className="text-[22px] font-extrabold text-gray-900 mb-2">No access to the dashboard</h1>
          {accessError && isMissingMigration(accessError) ? (
            <Notice tone="amber">
              The dashboard tables aren&apos;t in this Supabase project yet. Run{" "}
              <code>MovEazy-BE/supabase/ops_dashboard.sql</code> in the Supabase SQL editor, then
              reload.
            </Notice>
          ) : (
            <p className="text-[13px] text-gray-500">
              You&apos;re signed in as <span className="font-semibold text-gray-700">{user.email}</span>,
              which hasn&apos;t been granted <span className="font-mono">/dashboard</span>. The super
              admin can add it from the Dashboard tab in the superadmin panel.
            </p>
          )}
          <Link to="/" className="inline-block mt-5 text-[13px] font-bold" style={{ color: "#ff3131" }}>
            ← Back to MovEazy
          </Link>
        </div>
      </Shell>
    );
  }

  const span = daysBetween(from, to);

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">Dashboard</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Demand, supply and closures, one row per day. {span} day{span === 1 ? "" : "s"} shown,
            newest first — all times IST.
          </p>
        </div>
      </div>

      <TimeframeBar
        preset={preset}
        from={from}
        to={to}
        busy={loading || !rows.length}
        onPreset={applyPreset}
        onFrom={(v) => {
          setPreset("custom");
          setFrom(v);
        }}
        onTo={(v) => {
          setPreset("custom");
          setTo(v);
        }}
        onExport={() => downloadCsv(rows, from, to)}
      />

      {error ? (
        <Notice tone={isMissingMigration(error) ? "amber" : "red"}>
          {isMissingMigration(error) ? (
            <>
              The dashboard function isn&apos;t in this Supabase project yet. Run{" "}
              <code>MovEazy-BE/supabase/ops_dashboard.sql</code> in the SQL editor, then reload.
            </>
          ) : (
            <>Couldn&apos;t load the numbers: {error.message}</>
          )}
        </Notice>
      ) : loading ? (
        <p className="text-[13px] text-gray-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-8">
            {METRICS.map((m) => (
              <SummaryTile key={m.key} metric={m} stats={stats[m.key]} />
            ))}
          </div>

          {METRICS.map((m) => (
            <MetricTable key={m.key} metric={m} rows={rows} stats={stats[m.key]} />
          ))}

          {!rows.some((r) => METRICS.some((m) => r[m.key] > 0)) && (
            <Notice tone="gray">
              Every day in this range is zero. If that looks wrong, the usual cause is a migration
              that hasn&apos;t been run in this project — the leads and closures columns need{" "}
              <code>crm_schema.sql</code>, properties need <code>inventory_schema.sql</code> and
              visits need <code>visits_schema.sql</code>.
            </Notice>
          )}
        </>
      )}
    </Shell>
  );
}
