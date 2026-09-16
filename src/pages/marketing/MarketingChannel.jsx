/**
 * /marketing/:slug — one channel's funnel, and the people in it.
 *
 * The tiles and the table are the same seven steps twice: once as counts, once
 * per person. Both come from one Postgres function so they cannot disagree, and
 * both return nothing at all unless the signed-in email holds this channel.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMarketing } from "./MarketingShell";
import MarketingHead from "./MarketingHead";
import {
  FUNNEL_STEPS, channelLink, fetchChannelLeads, fetchChannelStats, isMissingMigration, pct,
} from "../../lib/marketing";
import { StatTile, StepCell, Table, CopyLink, Notice } from "./marketingUi";

/** The per-person columns, in the same order as the tiles above them. */
const STEP_COLUMNS = [
  { key: "signed_up_at", label: "Signup" },
  { key: "prefs_filled_at", label: "Pref filled" },
  { key: "shortlisted_at", label: "Shortlisted", countKey: "shortlist_count" },
  { key: "visit_scheduled_at", label: "Visit scheduled", countKey: "visit_count" },
  { key: "closed_at", label: "Closed" },
];

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function downloadCsv(slug, leads) {
  const header = ["Name", "Email", "Phone", "Signed up", "Pref filled", "Shortlisted", "Shortlists", "Visit scheduled", "Visits", "Closed", "Source", "Medium", "Landing page"];
  const body = leads.map((l) => [
    l.name, l.email, l.phone, l.signed_up_at, l.prefs_filled_at, l.shortlisted_at,
    l.shortlist_count, l.visit_scheduled_at, l.visit_count, l.closed_at,
    l.utm_source, l.utm_medium, l.landing_path,
  ]);
  const csv = [header, ...body].map((r) => r.map(csvCell).join(",")).join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `moveazy-${slug}-leads.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MarketingChannel() {
  const { slug } = useParams();
  const { channels } = useMarketing();
  const channel = channels.find((c) => c.slug === slug);

  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [step, setStep] = useState("all");

  useEffect(() => {
    if (!channel || channel.is_overview) return undefined;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const [s, l] = await Promise.all([fetchChannelStats(slug), fetchChannelLeads(slug)]);
        if (alive) {
          setStats(s);
          setLeads(l);
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
  }, [slug, channel]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads
      .filter((l) => (step === "all" ? true : Boolean(l[step])))
      .filter((l) =>
        !needle || [l.name, l.email, l.phone].filter(Boolean).join(" ").toLowerCase().includes(needle),
      )
      .map((l) => ({ ...l, _key: l.user_id }));
  }, [leads, q, step]);

  // The roll-up lives at whichever slug is flagged as the overview, so it is
  // reachable through this route too rather than only through /marketing/head.
  if (channel?.is_overview) return <MarketingHead />;

  if (!channel) {
    return (
      <>
        <h1 className="text-[24px] font-extrabold text-gray-900 mb-2">No access to this dashboard</h1>
        <p className="text-[13px] text-gray-500">
          <span className="font-mono">/marketing/{slug}</span> either doesn&apos;t exist or hasn&apos;t
          been granted to this email. Pick one of your own dashboards above.
        </p>
      </>
    );
  }

  if (loading) return <p className="text-[13px] text-gray-500">Loading…</p>;

  if (error) {
    return (
      <Notice tone={isMissingMigration(error) ? "amber" : "red"}>
        {isMissingMigration(error)
          ? "The marketing tables aren't in this Supabase project yet — run MovEazy-BE/supabase/marketing_schema.sql."
          : `Couldn't load this channel: ${error.message}`}
      </Notice>
    );
  }

  const link = channelLink(stats || channel);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">{channel.label}</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            {channel.description || `Everything that came through /marketing/${slug}.`}
          </p>
        </div>
        {leads.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(slug, rows)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-[12px] font-bold text-gray-600 hover:border-gray-400"
          >
            Download CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
        {FUNNEL_STEPS.map((s, i) => (
          <StatTile
            key={s.key}
            label={s.label}
            hint={s.hint}
            value={Number(stats?.[s.key] || 0)}
            of={i === 0 ? undefined : Number(stats?.[FUNNEL_STEPS[i - 1].key] || 0)}
          />
        ))}
      </div>

      {link && (
        <div className="mb-5">
          <CopyLink value={link} label={`Tracking link for ${channel.label}`} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone…"
          className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none focus:border-gray-400"
        />
        <select
          value={step}
          onChange={(e) => setStep(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none"
        >
          <option value="all">Everyone who signed up</option>
          {STEP_COLUMNS.slice(1).map((s) => (
            <option key={s.key} value={s.key}>
              Reached: {s.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[12px] text-gray-400 mb-2">
        {rows.length} {rows.length === 1 ? "person" : "people"}
        {rows.length !== leads.length && ` of ${leads.length}`}
      </p>

      <Table
        empty={
          stats?.link_clicks
            ? "People have opened this link, but nobody has created an account from it yet."
            : "Nothing yet. Share the tracking link above and the clicks will start landing here."
        }
        rows={rows}
        cols={[
          {
            key: "who",
            label: "Who",
            render: (r) => (
              <div className="min-w-[190px]">
                <p className="font-bold text-gray-900">{r.name || r.email}</p>
                {r.name && <p className="text-[11px] text-gray-500">{r.email}</p>}
              </div>
            ),
          },
          { key: "phone", label: "Phone", render: (r) => r.phone || "—" },
          ...STEP_COLUMNS.map((s) => ({
            key: s.key,
            label: s.label,
            render: (r) => <StepCell at={r[s.key]} count={s.countKey ? r[s.countKey] : 0} />,
          })),
          {
            key: "why",
            label: "Closed as",
            render: (r) => (
              <span className="text-[11.5px] text-gray-500">{r.closed_reason || "—"}</span>
            ),
          },
          {
            key: "landed",
            label: "Landed on",
            render: (r) => (
              <span className="text-[11.5px] font-mono text-gray-500">
                {(r.landing_path || "/").split("?")[0]}
              </span>
            ),
          },
        ]}
      />

      {Number(stats?.signups || 0) > 0 && (
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          {pct(stats.signups, stats.visitors)} of visitors from this link created an account, and{" "}
          {pct(stats.closed, stats.signups)} of those have closed.
        </p>
      )}
    </>
  );
}
