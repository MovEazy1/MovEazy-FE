/**
 * Who may open /dashboard — the super-admin half of the operating dashboard.
 *
 * A grant is one email and nothing else. It gives that address the six day-on-day
 * counts and no way to reach a person behind them: not the CRM, not the client
 * list, not a phone number, not the marketing channels. That is the whole reason
 * this is its own table rather than a role in the Team screen — handing someone
 * the headline numbers should not be the same act as putting them on staff.
 *
 * The super admin is not listed here and cannot be revoked; that identity is
 * hardcoded in Postgres (is_super_admin()) and in lib/adminAccess.js.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchDashboardGrants, grantDashboardAccess, isMissingMigration, normalizeEmail,
  revokeDashboardAccess,
} from "../../lib/opsDashboard";
import { fmtDate } from "../../lib/marketing";

const input =
  "w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] outline-none focus:border-gray-400";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

export default function DashboardAccessPanel({ adminEmail = "" }) {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGrants(await fetchDashboardGrants());
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

  const onGrant = async (e) => {
    e.preventDefault();
    const who = normalizeEmail(email);
    const ok = await run(
      () => grantDashboardAccess(email, { notes, grantedBy: adminEmail }),
      `${who} can now open /dashboard.`,
    );
    if (!ok) return;
    setEmail("");
    setNotes("");
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
            The dashboard tables aren&apos;t in this Supabase project yet. Run{" "}
            <code>MovEazy-BE/supabase/ops_dashboard.sql</code> in the Supabase SQL editor, then
            reload this page.
          </>
        ) : (
          <>Couldn&apos;t load dashboard access: {error.message}</>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && <p className="text-[12px] rounded-xl px-3 py-2 bg-gray-900 text-white">{notice}</p>}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-1">
          <h2 className="text-[15px] font-extrabold text-gray-900">Operating dashboard</h2>
          <Link to="/dashboard" className="text-[12px] font-bold text-gray-500 hover:text-gray-800">
            Open /dashboard →
          </Link>
        </div>
        <p className="text-[12px] text-gray-500 mb-3">
          Six day-on-day counts: new leads, active leads, new properties, active properties, visits
          and our closures. Numbers only — nobody granted this can see a name, a phone number or a
          single client row.
        </p>

        <form onSubmit={onGrant} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end">
            <Field label="Email">
              <input
                className={input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@example.com"
              />
            </Field>
            <Field label="Note" hint="Why they have it — for you, six months from now.">
              <input
                className={input}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Angel investor, monthly update"
              />
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
      </section>

      <section>
        <h3 className="text-[13px] font-extrabold text-gray-900 mb-2">
          Who has it {grants.length ? <span className="text-gray-400">({grants.length})</span> : null}
        </h3>

        {grants.length === 0 ? (
          <p className="text-[13px] text-gray-400 py-6 text-center">
            Nobody but the super admin can open /dashboard yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {["Email", "Note", "Granted by", "Granted", ""].map((h) => (
                    <th
                      key={h}
                      className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 border-b border-gray-200 whitespace-nowrap"
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
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">{g.notes || "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">{g.granted_by || "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500 whitespace-nowrap">
                      {fmtDate(g.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => revokeDashboardAccess(g.id),
                            `Removed ${g.email} from /dashboard.`,
                          )
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
