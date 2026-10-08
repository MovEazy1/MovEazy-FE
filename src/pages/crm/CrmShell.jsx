/**
 * CRM shell — the rail, the access gate, and the data every screen shares.
 *
 * Clients, requirements, inventory, engagement and shortlists are loaded once
 * here and passed down, because all four screens read the same rows and a
 * per-screen fetch would mean the list flickering every time you switch tabs.
 *
 * How it opens fast:
 *   - the screen you opened shows as soon as the data IT reads is in
 *     (NEEDS below) — Team or Settings don't wait for 3,000 listings; the rest
 *     loads right after, so switching tabs stays instant;
 *   - the last copy is kept on this device for 7 days (lib/localCache.js): a
 *     returning agent sees it at once, under a thin progress line, while the
 *     fresh copy loads. Dropped on sign-out and when access is taken away.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCrmAccess } from "../../hooks/useCrmAccess";
import { SCOPES } from "../../lib/adminScopes";
import {
  fetchClients, fetchClientRequirements, fetchEngagement, fetchShortlists, fetchLastTouch, fetchLeadActivity,
  fetchClientOwnAnswers,
} from "../../lib/crmClients";
import { DEFAULT_CRM_SETTINGS, fetchCrmSettings } from "../../lib/crmSettings";
import { fetchPropertyInterest } from "../../lib/crmPropertyInterest";
import { fetchShareChannels } from "../../lib/marketing";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { C, CrmStyles, Empty, Loading } from "./crmUi";
import TopProgress from "../../components/TopProgress";
import { DAY_MS, dropCache, readCache, writeCache } from "../../lib/localCache";
import { prefetchWhenIdle } from "../../lib/prefetch";

const CrmContext = createContext(null);
export const useCrm = () => useContext(CrmContext);

const RAIL = [
  { to: "/crm/clients",    code: "CL", label: "Clients" },
  // Before Pipeline: it is the tab with work waiting on somebody, and a queue
  // nobody walks past is a queue nobody clears.
  { to: "/crm/notifications", code: "NF", label: "Notifications" },
  { to: "/crm/pipeline",   code: "PI", label: "Pipeline" },
  { to: "/crm/properties", code: "PR", label: "Properties" },
  { to: "/crm/brokers",    code: "BR", label: "Brokers" },
  // Tenants partner brokers brought — theirs, never in Clients.
  { to: "/crm/broker-leads", code: "BL", label: "Broker leads" },
  // Owners' buildings with a QR: assign the partner, work the visit requests.
  { to: "/crm/owner-qr", code: "QR", label: "Owner QR" },
  // The owner app's queue: repairs, service bookings, designer calls, owners.
  { to: "/crm/ops",        code: "IO", label: "Inventory Ops" },
  { to: "/crm/visits",     code: "VS", label: "Visits" },
  { to: "/crm/payments",   code: "PY", label: "Payments" },
  // Partners and owners in their apps: time spent, last sign-in, every button pressed.
  { to: "/crm/app-analytics", code: "AN", label: "App analytics", scope: SCOPES.ANALYTICS_READ },
  { to: "/crm/team",       code: "TM", label: "Team", scope: SCOPES.ROLES_WRITE },
  { to: "/crm/settings",   code: "ST", label: "Settings" },
];

/** One retry without the optional columns — see lib/inventory.js for why. */
/**
 * One retry without a column a pending migration hasn't added yet.
 *
 * PostgREST rejects a whole select over one unknown name, so asking for
 * `maintenance` before its migration runs would blank every CRM screen that
 * reads inventory — not merely hide that one field. Measured on the public
 * map: 54 listings became 0.
 */
const OPTIONAL_INVENTORY_COLS = ["maintenance", "floor_number", "total_floors", "building_id", "unit_no", "unit_order", "sold_out_at", "sold_out_by"];

const isMissingColumn = (error) =>
  error?.code === "42703" ||
  error?.code === "PGRST204" ||
  /column .* does not exist/i.test(error?.message || "") ||
  /could not find the '.*' column/i.test(error?.message || "");

async function fetchInventory() {
  if (!isSupabaseConfigured || !supabase) return [];
  const cols =
    "property_id,posted_by,poster_name,poster_email,phone,city,area,nearby_areas,full_address,landmark," +
    "rent,deposit,maintenance,available_from,flat_type,bedrooms,bathrooms,floor_number,total_floors,furnishing,max_flatmates,gender_pref,occupants_allowed," +
    "amenities,house_rules,lifestyle,title,description,images,cover_image_url,status,is_verified," +
    "source,source_url,created_at,building_id,unit_no,unit_order,sold_out_at,sold_out_by";

  // Through inventory_full(): the poster's contact columns aren't readable off
  // the table by a signed-in account, staff included (lib/inventory.js).
  const run = (c) =>
    supabase.rpc("inventory_full").select(c).order("created_at", { ascending: false }).limit(3000);

  let { data, error } = await run(cols);
  if (error && isMissingColumn(error)) {
    console.warn(`[crm] inventory: ${error.message} — retrying without it. Run the pending migration.`);
    const trimmed = cols
      .split(",")
      .map((c) => c.trim())
      .filter((c) => !OPTIONAL_INVENTORY_COLS.includes(c))
      .join(",");
    ({ data, error } = await run(trimmed));
  }
  if (error) {
    console.warn(`[crm] inventory: ${error.message}`);
    return [];
  }
  return data ?? [];
}

function Gate({ children }) {
  const { loading, isStaff } = useCrmAccess();
  const { user, loading: authLoading } = useAuth();

  if (loading || authLoading) {
    return (
      <div className="crm" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <CrmStyles />
        <Loading label="Checking access…" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth?next=/crm" replace />;

  if (!isStaff) {
    return (
      <div className="crm" style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 24 }}>
        <CrmStyles />
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>Not your door</h1>
          <p style={{ color: C.textDim, fontSize: 14, margin: "0 0 18px" }}>
            The CRM is for MovEazy staff. You're signed in as{" "}
            <span style={{ color: C.text }}>{user.email}</span>, which isn't on the team list.
          </p>
          <Link to="/" className="crm-btn crm-btn--primary" style={{ textDecoration: "none" }}>
            Back to MovEazy
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

function Rail({ access }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="CRM sections"
      style={{
        width: 56, flex: "none", background: C.surface, borderRight: `1px solid ${C.line}`,
        padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}
    >
      {RAIL.filter((r) => !r.scope || access.has(r.scope)).map((r) => (
        <NavLink
          key={r.to}
          to={r.to}
          title={r.label}
          aria-label={r.label}
          className={pathname.startsWith(r.to) ? "crm-rail-item crm-rail-item--on" : "crm-rail-item"}
          style={{ textDecoration: "none" }}
        >
          {r.code}
        </NavLink>
      ))}
      <div style={{ flex: 1 }} />
      <Link to="/" title="Back to site" aria-label="Back to site" className="crm-rail-item" style={{ textDecoration: "none" }}>
        ←
      </Link>
    </nav>
  );
}

/** Everything the shell loads, and how. */
const LOADERS = {
  clients: fetchClients,
  requirements: fetchClientRequirements,
  inventory: fetchInventory,
  engagement: fetchEngagement,
  shortlists: fetchShortlists,
  touches: fetchLastTouch,
  settings: fetchCrmSettings,
  // May legitimately come back empty: [] on a project without the marketing
  // migration, and the share menu then degrades to the plain per-platform link.
  marketingChannels: fetchShareChannels,
  ownAnswers: fetchClientOwnAnswers,
  // [] until crm_client_property_interest.sql is run.
  interest: fetchPropertyInterest,
  leads: fetchLeadActivity,
};
const ALL = Object.keys(LOADERS);

/**
 * What each screen reads from the shared data — it opens once these are in.
 * A screen not listed waits for everything (the safe default for a new one).
 */
const NEEDS = {
  clients: ALL,
  pipeline: ["clients", "requirements", "engagement", "touches"],
  properties: ["inventory", "requirements", "clients", "marketingChannels"],
  brokers: ["inventory", "clients", "requirements"],
  "broker-leads": [],
  "owner-qr": [],
  buildings: ["inventory"],
  ops: ["inventory"],
  visits: ["clients", "inventory", "requirements", "settings"],
  notifications: ["inventory", "clients"],
  payments: ["clients"],
  "app-analytics": [],
  team: [],
  settings: ["settings", "clients", "requirements", "inventory"],
};
export function needsFor(pathname) {
  const seg = String(pathname || "").split("/")[2] || "clients";
  return NEEDS[seg] ?? ALL;
}

/** What a screen sees for data still on its way: empty, never undefined. */
const PENDING = Object.fromEntries(ALL.map((k) => [k, k === "settings" ? { ...DEFAULT_CRM_SETTINGS } : []]));

const CACHE_NAME = "crm";
const CACHE_MAX_AGE = 7 * DAY_MS;

export default function CrmShell() {
  const access = useCrmAccess();
  const { user } = useAuth();
  const { pathname } = useLocation();

  /** key -> rows. A key is absent until its first answer (or the saved copy) is in. */
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  /** Showing the saved copy while the fresh one loads. */
  const [refreshing, setRefreshing] = useState(false);
  const round = useRef(0);

  const load = useCallback(async ({ first = [] } = {}) => {
    const mine = ++round.current;
    const fetchKey = async (k) => {
      try {
        const rows = await LOADERS[k]();
        if (round.current === mine) setData((d) => ({ ...d, [k]: rows }));
        return [k, rows];
      } catch (e) {
        if (round.current === mine) setError(e?.message || "Could not load the CRM.");
        throw e;
      }
    };
    try {
      // The open screen's data first; the rest once it is in, so it doesn't
      // compete for the connection with what is on screen.
      const head = first.filter((k) => LOADERS[k]);
      const tail = ALL.filter((k) => !head.includes(k));
      const got = await Promise.all(head.map(fetchKey));
      got.push(...(await Promise.all(tail.map(fetchKey))));
      if (round.current !== mine) return;
      setError("");
      writeCache(user?.uid, CACHE_NAME, Object.fromEntries(got));
    } catch {
      /* error already set */
    } finally {
      if (round.current === mine) setRefreshing(false);
    }
  }, [user?.uid]);

  // Open: the saved copy if there is one, then the fresh data either way.
  const opened = useRef(false);
  useEffect(() => {
    if (access.loading || !access.isStaff || opened.current) return;
    opened.current = true;
    (async () => {
      const saved = await readCache(user?.uid, CACHE_NAME, CACHE_MAX_AGE);
      if (saved && ALL.every((k) => k in saved)) {
        setData((d) => ({ ...saved, ...d }));
        setRefreshing(true);
      }
      load({ first: needsFor(window.location.pathname) });
    })();
  }, [access.loading, access.isStaff, load, user?.uid]);

  // No longer staff: nothing of the CRM stays on this device.
  useEffect(() => {
    if (!access.loading && !access.isStaff && user?.uid) dropCache(user.uid, CACHE_NAME);
  }, [access.loading, access.isStaff, user?.uid]);

  // The CRM screens agents move between, fetched while the browser is idle.
  useEffect(() => prefetchWhenIdle([
    () => import("./CrmClientsPage"), () => import("./CrmPropertiesPage"), () => import("./CrmPipelinePage"),
    () => import("./CrmVisitsPage"), () => import("./CrmNotificationsPage"),
  ], { delay: 4000 }), []);

  /** Patch one client in place — avoids refetching 4000 rows after a chip tap. */
  const patchClient = useCallback((updated) => {
    setData((d) =>
      d.clients ? { ...d, clients: d.clients.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)) } : d,
    );
  }, []);

  const reload = useCallback(() => load(), [load]);
  const ready = needsFor(pathname).every((k) => k in data);

  const value = useMemo(
    () => ({ ...PENDING, ...data, access, user, reload, patchClient, setData }),
    [data, access, user, reload, patchClient],
  );

  return (
    <Gate>
      <div className="crm" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <CrmStyles />
        <TopProgress active={refreshing} color={C.accent} />
        <Rail access={access} />
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {!ready && !error && <Loading label="Loading the workspace…" />}
          {!ready && error && <Empty>{error}</Empty>}
          {ready && (
            <CrmContext.Provider value={value}>
              <Outlet />
            </CrmContext.Provider>
          )}
        </main>
      </div>
    </Gate>
  );
}
