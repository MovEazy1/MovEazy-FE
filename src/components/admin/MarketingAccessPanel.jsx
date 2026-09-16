/**
 * Marketing channels and who may look at them — the super-admin half of
 * /marketing/*.
 *
 * Two jobs, deliberately on one screen: creating a channel and handing it to
 * someone are the same act in practice, and splitting them is how a channel ends
 * up live with nobody able to see its numbers.
 *
 * Creating a channel here is all it takes to make /marketing/<slug> work — the
 * route is :slug and the channel list comes from the database, so there is no
 * deploy in the loop. The campaign string is derived from the slug rather than
 * typed, because it is the key every signup is matched on: a channel whose
 * campaign is edited after links are in the wild silently loses its history.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  channelLink, createChannel, dashboardPath, fetchAccessGrants, fetchAllChannels,
  grantAccess, isMissingMigration, normalizeSlug, revokeAccess, setChannelActive, fmtDate,
} from "../../lib/marketing";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

const input =
  "w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none focus:border-gray-400";

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — the value is on screen and selectable */
        }
      }}
      className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 hover:border-gray-400 whitespace-nowrap"
      style={copied ? { color: "#15803d", borderColor: "#86efac" } : { color: "#6b7280" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function MarketingAccessPanel({ adminEmail = "" }) {
  const [channels, setChannels] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // new channel
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("social");

  // new grant
  const [grantEmail, setGrantEmail] = useState("");
  const [grantSlug, setGrantSlug] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, g] = await Promise.all([fetchAllChannels(), fetchAccessGrants()]);
      setChannels(c);
      setGrants(g);
      setGrantSlug((s) => s || c[0]?.slug || "");
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grantsByChannel = useMemo(() => {
    const m = new Map();
    for (const g of grants) {
      if (!m.has(g.channel_slug)) m.set(g.channel_slug, []);
      m.get(g.channel_slug).push(g);
    }
    return m;
  }, [grants]);

  /** Returns whether it worked, so a failed submit keeps what was typed. */
  const run = async (fn, success) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      setNotice(success);
      await load();
      return true;
    } catch (e) {
      setNotice(e.message || String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async (e) => {
    e.preventDefault();
    const created = normalizeSlug(slug);
    const ok = await run(
      () => createChannel({ slug, label, description, utmSource, utmMedium }),
      `Created /marketing/${created}.`,
    );
    if (!ok) return;
    setSlug("");
    setLabel("");
    setDescription("");
    setUtmSource("");
  };

  const onGrant = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => grantAccess(grantEmail, grantSlug, { grantedBy: adminEmail }),
      `${grantEmail.trim().toLowerCase()} can now open /marketing/${grantSlug}.`,
    );
    if (ok) setGrantEmail("");
  };

  if (loading) return <p className="text-[13px] text-gray-500">Loading…</p>;

  if (error) {
    return (
      <div
        className="rounded-xl p-3 text-[12px] leading-relaxed"
        style={
          isMissingMigration(error)
            ? { background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }
            : { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }
        }
      >
        {isMissingMigration(error) ? (
          <>
            The marketing tables aren&apos;t in this Supabase project yet. Run{" "}
            <code>MovEazy-BE/supabase/marketing_schema.sql</code> in the Supabase SQL editor, then
            reload this page.
          </>
        ) : (
          <>Couldn&apos;t load marketing settings: {error.message}</>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <p className="text-[12px] rounded-xl px-3 py-2 bg-gray-900 text-white">{notice}</p>
      )}

      {/* ── Channels ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[15px] font-extrabold text-gray-900 mb-1">Channels</h2>
        <p className="text-[12px] text-gray-500 mb-3">
          One row per place we post. The tracking link is the only version of the URL that counts —
          a link shared without it arrives as organic traffic and can never be credited back.
        </p>

        <div className="space-y-2">
          {channels.map((c) => {
            const link = channelLink(c);
            const holders = grantsByChannel.get(c.slug) || [];
            return (
              <div key={c.slug} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-extrabold text-gray-900">
                      {c.label}
                      {c.is_overview && (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          roll-up
                        </span>
                      )}
                    </p>
                    <Link
                      to={dashboardPath(c.slug)}
                      className="text-[11px] font-mono text-gray-400 hover:text-gray-700"
                    >
                      {dashboardPath(c.slug)} →
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                      style={
                        c.active
                          ? { background: "#ecfdf5", color: "#15803d" }
                          : { background: "#f1f5f9", color: "#64748b" }
                      }
                    >
                      {c.active ? "Live" : "Paused"}
                    </span>
                    {!c.is_overview && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => setChannelActive(c.slug, !c.active),
                            `${c.label} is now ${c.active ? "paused" : "live"}.`,
                          )
                        }
                        className="text-[11px] font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50"
                      >
                        {c.active ? "Pause" : "Resume"}
                      </button>
                    )}
                  </div>
                </div>

                {!c.is_overview && (
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 min-w-0 truncate text-[11.5px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                      {link}
                    </code>
                    <CopyButton value={link} />
                  </div>
                )}

                <p className="text-[11px] text-gray-400 mt-2">
                  {holders.length
                    ? `Access: ${holders.map((g) => g.email).join(", ")}`
                    : "Access: super admin only"}
                </p>
              </div>
            );
          })}
        </div>

        <form onSubmit={onCreate} className="rounded-xl border border-gray-200 bg-white p-3 mt-3">
          <p className="text-[13px] font-extrabold text-gray-900 mb-2">Add a channel</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="URL slug" hint={slug ? `→ /marketing/${normalizeSlug(slug)}` : "Lowercase letters, numbers, dashes."}>
              <input className={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="instagram" />
            </Field>
            <Field label="Name">
              <input className={input} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Instagram page" />
            </Field>
            <Field label="utm_source" hint="Defaults to the slug.">
              <input className={input} value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="instagram" />
            </Field>
            <Field label="utm_medium">
              <input className={input} value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="social" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" hint="Shown at the top of the dashboard.">
                <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Posts from the MovEazy Instagram page." />
              </Field>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: "#111827" }}
          >
            Create channel
          </button>
        </form>
      </section>

      {/* ── Access ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[15px] font-extrabold text-gray-900 mb-1">Who can see what</h2>
        <p className="text-[12px] text-gray-500 mb-3">
          A grant is one email and one dashboard. It gives that address nothing else on MovEazy —
          not the CRM, not the user list, not another channel&apos;s numbers.
        </p>

        <form onSubmit={onGrant} className="rounded-xl border border-gray-200 bg-white p-3 mb-3">
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:items-end">
            <Field label="Email">
              <input
                className={input}
                type="email"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                placeholder="rishav@example.com"
              />
            </Field>
            <Field label="Dashboard">
              <select className={input} value={grantSlug} onChange={(e) => setGrantSlug(e.target.value)}>
                {channels.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label} (/marketing/{c.slug})
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 whitespace-nowrap"
              style={{ background: "#111827" }}
            >
              Grant access
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            They sign in at <span className="font-mono">/auth</span> with this address — any normal
            MovEazy account works, it just has to be the same email.
          </p>
        </form>

        {grants.length === 0 ? (
          <p className="text-[13px] text-gray-400 py-6 text-center">
            Nobody has been granted a dashboard yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {["Email", "Dashboard", "Granted", ""].map((h) => (
                    <th
                      key={h}
                      className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 border-b border-gray-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 text-[12.5px] text-gray-800">{g.email}</td>
                    <td className="px-3 py-2.5 text-[12.5px]">
                      <Link to={dashboardPath(g.channel_slug)} className="font-mono text-gray-600 hover:underline">
                        {dashboardPath(g.channel_slug)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">{fmtDate(g.created_at)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() => revokeAccess(g.id), `Removed ${g.email} from /marketing/${g.channel_slug}.`)
                        }
                        className="text-[11px] font-bold text-gray-400 hover:text-red-600 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
