/**
 * The /marketing shell: who you are, which dashboards you hold, and the rail
 * between them.
 *
 * Access is per-email and per-channel, granted from the Marketing tab of
 * /superadmin. Someone who holds one channel sees exactly one tab here and gets
 * a refusal on anyone else's URL. That refusal is cosmetic — the reporting
 * functions in Postgres return nothing for a channel you do not hold, so typing
 * a different slug into the address bar gets an empty dashboard even with this
 * file patched out.
 */
import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import MovEazyNav from "../../components/layout/MovEazyNav";
import { fetchMyChannels, isMissingMigration } from "../../lib/marketing";
import { PAGE_BG, FONT, Notice } from "./marketingUi";

/** Channels the signed-in email may open, shared with every child route. */
export const useMarketing = () => useOutletContext();

function Frame({ children }) {
  return (
    <div style={{ background: PAGE_BG, minHeight: "100dvh", fontFamily: FONT }}>
      <MovEazyNav active="" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

export default function MarketingShell() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setChannels(await fetchMyChannels());
      setError(null);
    } catch (e) {
      setChannels([]);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  if (authLoading || loading) {
    return (
      <Frame>
        <p className="text-[13px] text-gray-500">Loading…</p>
      </Frame>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (error && isMissingMigration(error)) {
    return (
      <Frame>
        <h1 className="text-[24px] font-extrabold text-gray-900 mb-3">Marketing</h1>
        <Notice>
          The marketing tables aren&apos;t in this Supabase project yet. Run{" "}
          <code>MovEazy-BE/supabase/marketing_schema.sql</code> in the SQL editor, then reload.
        </Notice>
      </Frame>
    );
  }

  if (!channels.length) {
    return (
      <Frame>
        <div className="max-w-xl">
          <h1 className="text-[24px] font-extrabold text-gray-900 mb-2">No dashboard for this account</h1>
          <p className="text-[13px] text-gray-500">
            Marketing dashboards are granted per email. You are signed in as{" "}
            <span className="font-bold text-gray-700">{user.email}</span> — ask the MovEazy team to
            grant this address a channel, or sign in with the address it was granted to.
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <div style={{ background: PAGE_BG, minHeight: "100dvh", fontFamily: FONT }}>
      <MovEazyNav active="" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {channels.length > 1 && (
          <nav className="flex gap-2 overflow-x-auto pb-1 mb-5">
            {channels.map((c) => (
              <NavLink
                key={c.slug}
                to={`/marketing/${c.slug}`}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap border transition ${
                    isActive
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`
                }
              >
                {c.label}
                {!c.active && <span className="ml-1.5 opacity-60">paused</span>}
              </NavLink>
            ))}
          </nav>
        )}

        <Outlet context={{ channels, reloadChannels: load, user }} />
      </main>
    </div>
  );
}

/**
 * /marketing itself. Sends you to the one place you can actually go: the
 * roll-up if you hold it, your only channel if you hold exactly one, and a
 * picker otherwise.
 */
export function MarketingIndex() {
  const { channels } = useMarketing();
  const overview = channels.find((c) => c.is_overview);
  const target = overview || (channels.length === 1 ? channels[0] : null);

  if (target) return <Navigate to={`/marketing/${target.slug}`} replace />;

  return (
    <>
      <h1 className="text-[24px] font-extrabold text-gray-900 mb-1">Your dashboards</h1>
      <p className="text-[13px] text-gray-500 mb-5">Pick a channel.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {channels.map((c) => (
          <NavLink
            key={c.slug}
            to={`/marketing/${c.slug}`}
            className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-400 transition"
          >
            <p className="text-[15px] font-extrabold text-gray-900">{c.label}</p>
            <p className="text-[12px] text-gray-500 mt-1">{c.description || `/marketing/${c.slug}`}</p>
          </NavLink>
        ))}
      </div>
    </>
  );
}
