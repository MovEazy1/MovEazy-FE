/**
 * /marketing/head — every channel side by side.
 *
 * Totals on top, one row per channel below, in the same seven steps a single
 * channel shows. The table is the point: a channel is only ever good or bad
 * relative to the others, and the shape of the drop-off says more than the
 * volume does. A group that sends 40 clicks and closes one deal is worth more
 * than a page that sends 4,000 and closes none, and only this view shows it.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FUNNEL_STEPS, fetchOverview, isMissingMigration, pct } from "../../lib/marketing";
import { StatTile, Table, Notice } from "./marketingUi";

export default function MarketingHead() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchOverview();
        if (alive) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => {
    const sum = (key) => rows.reduce((n, r) => n + Number(r[key] || 0), 0);
    return Object.fromEntries(FUNNEL_STEPS.map((s) => [s.key, sum(s.key)]));
  }, [rows]);

  if (loading) return <p className="text-[13px] text-gray-500">Loading…</p>;

  if (error) {
    return (
      <Notice tone={isMissingMigration(error) ? "amber" : "red"}>
        {isMissingMigration(error)
          ? "The marketing tables aren't in this Supabase project yet — run MovEazy-BE/supabase/marketing_schema.sql."
          : `Couldn't load the overview: ${error.message}`}
      </Notice>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">All channels</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            Every tracked marketing surface, and how far the people it sends actually get.
          </p>
        </div>
      </div>

      {/* Totals. Each tile's small percentage is against the step before it, so
          the row reads as a funnel rather than seven unrelated numbers. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        {FUNNEL_STEPS.map((s, i) => (
          <StatTile
            key={s.key}
            label={s.label}
            hint={s.hint}
            value={totals[s.key] ?? 0}
            of={i === 0 ? undefined : totals[FUNNEL_STEPS[i - 1].key]}
          />
        ))}
      </div>

      <p className="text-[12px] text-gray-400 mb-2">{rows.length} channels</p>

      <Table
        empty="No channels yet. Add one from the Marketing tab in /superadmin."
        rows={rows.map((r) => ({ ...r, _key: r.slug }))}
        cols={[
          {
            key: "channel",
            label: "Channel",
            render: (r) => (
              <div className="min-w-[170px]">
                <Link to={`/marketing/${r.slug}`} className="font-bold text-gray-900 hover:underline">
                  {r.label}
                </Link>
                <p className="text-[11px] font-mono text-gray-400">/marketing/{r.slug}</p>
              </div>
            ),
          },
          ...FUNNEL_STEPS.map((s, i) => ({
            key: s.key,
            label: s.label,
            render: (r) => (
              <span className="inline-flex items-baseline gap-1.5">
                <span className="font-semibold text-gray-900">
                  {Number(r[s.key] || 0).toLocaleString("en-IN")}
                </span>
                {i > 0 && (
                  <span className="text-[11px] text-gray-400">
                    {pct(r[s.key], r[FUNNEL_STEPS[i - 1].key])}
                  </span>
                )}
              </span>
            ),
          })),
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={
                  r.active
                    ? { background: "#ecfdf5", color: "#15803d" }
                    : { background: "#f1f5f9", color: "#64748b" }
                }
              >
                {r.active ? "Live" : "Paused"}
              </span>
            ),
          },
        ]}
      />

      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
        Clicks and visitors are counted the moment someone opens a tracked link, signed in or not.
        Every step after that belongs to an account, and an account is credited to the channel that
        first brought that person to the site — not the last one.
      </p>
    </>
  );
}
