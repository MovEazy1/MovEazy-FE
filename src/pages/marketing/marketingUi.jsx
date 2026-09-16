/**
 * The pieces every marketing dashboard is built from.
 *
 * Kept together so the roll-up and a single channel read identically — the
 * whole point of /marketing/head is comparing channels, and a comparison that
 * renders the same number in two different shapes is a comparison nobody
 * trusts.
 */
import { useState } from "react";

export const PAGE_BG = "#f3f4f6";
export const ACCENT = "#ff3131";
export const FONT = "'Manrope', system-ui, sans-serif";

/** One funnel number. `of` turns it into a conversion rate against the step above. */
export function StatTile({ label, value, hint, of }) {
  const rate =
    typeof of === "number" && of > 0 && typeof value === "number"
      ? `${Math.round((value / of) * 100)}%`
      : null;

  return (
    <div className="rounded-xl bg-white border border-gray-200 px-3 py-3" title={hint || ""}>
      <div className="flex items-baseline gap-1.5">
        <p className="text-[21px] font-extrabold text-gray-900 leading-none">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value ?? "—"}
        </p>
        {rate && <span className="text-[11px] font-bold text-gray-400">{rate}</span>}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-1.5 leading-tight">
        {label}
      </p>
    </div>
  );
}

/** A flat table. `cols` is [{ key, label, render }]; `render` gets the row. */
export function Table({ cols, rows, empty = "Nothing here yet." }) {
  if (!rows.length) return <p className="text-[13px] text-gray-400 py-10 text-center">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {cols.map((c) => (
              <th
                key={c.key}
                className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 whitespace-nowrap border-b border-gray-200"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._key ?? i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
              {cols.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-[12.5px] text-gray-800 whitespace-nowrap">
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Whether a person reached a funnel step, and when.
 *
 * A date rather than a tick: "shortlisted" is far more useful next to "three
 * weeks ago" than on its own, and the gap between two columns is how you see a
 * channel that produces signups but no intent.
 */
export function StepCell({ at, count }) {
  if (!at) return <span className="text-gray-300">—</span>;
  const d = new Date(at);
  const label = Number.isNaN(d.getTime())
    ? "Yes"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16a34a" }} />
      <span className="text-gray-700">{label}</span>
      {count > 1 && <span className="text-[11px] text-gray-400">×{count}</span>}
    </span>
  );
}

/** Copy-to-clipboard for a tracked link, with the link visible beside it. */
export function CopyLink({ value, label = "Tracking link" }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked in some in-app browsers; the input below is
      // selectable, so there is still a way to get the link out.
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-[12px] font-mono text-gray-700 outline-none"
        />
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 rounded-lg text-[12px] font-bold text-white whitespace-nowrap"
          style={{ background: copied ? "#16a34a" : "#111827" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5">
        Paste this exact link. Everything after the <code>?</code> is what makes the clicks countable.
      </p>
    </div>
  );
}

export function Notice({ tone = "amber", children }) {
  const tones = {
    amber: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    red: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
    gray: { bg: "#f8fafc", border: "#e2e8f0", text: "#475569" },
  };
  const t = tones[tone] || tones.gray;
  return (
    <div
      className="rounded-xl p-3 text-[12px] leading-relaxed"
      style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.text }}
    >
      {children}
    </div>
  );
}
