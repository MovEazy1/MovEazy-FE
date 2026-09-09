/**
 * CRM shell — the rail, the access gate, and the data every screen shares.
 *
 * Clients, requirements, inventory, engagement and shortlists are loaded once
 * here and passed down, because all four screens read the same rows and a
 * per-screen fetch would mean the list flickering every time you switch tabs.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCrmAccess } from "../../hooks/useCrmAccess";
import { SCOPES } from "../../lib/adminScopes";
import {
  fetchClients, fetchClientRequirements, fetchEngagement, fetchShortlists, fetchLastTouch,
} from "../../lib/crmClients";
import { fetchCrmSettings } from "../../lib/crmSettings";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { C, CrmStyles, Empty, Loading } from "./crmUi";

const CrmContext = createContext(null);
export const useCrm = () => useContext(CrmContext);

const RAIL = [
  { to: "/crm/clients",    code: "CL", label: "Clients" },
  { to: "/crm/pipeline",   code: "PI", label: "Pipeline" },
  { to: "/crm/properties", code: "PR", label: "Properties" },
  { to: "/crm/payments",   code: "PY", label: "Payments" },
  { to: "/crm/team",       code: "TM", label: "Team", scope: SCOPES.ROLES_WRITE },
  { to: "/crm/settings",   code: "ST", label: "Settings" },
];

async function fetchInventory() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("inventory")
    .select(
      "property_id,posted_by,poster_name,poster_email,phone,city,area,nearby_areas,full_address,landmark," +
        "rent,deposit,available_from,flat_type,bedrooms,bathrooms,furnishing,occupants_allowed," +
        "amenities,house_rules,lifestyle,title,description,images,cover_image_url,status,is_verified," +
        "source,source_url,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(3000);
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

export default function CrmShell() {
  const access = useCrmAccess();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [clients, requirements, inventory, engagement, shortlists, touches, settings] = await Promise.all([
        fetchClients(), fetchClientRequirements(), fetchInventory(),
        fetchEngagement(), fetchShortlists(), fetchLastTouch(), fetchCrmSettings(),
      ]);
      setData({ clients, requirements, inventory, engagement, shortlists, touches, settings });
      setError("");
    } catch (e) {
      setError(e?.message || "Could not load the CRM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!access.loading && access.isStaff) load();
  }, [access.loading, access.isStaff, load]);

  /** Patch one client in place — avoids refetching 4000 rows after a chip tap. */
  const patchClient = useCallback((updated) => {
    setData((d) =>
      d ? { ...d, clients: d.clients.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)) } : d,
    );
  }, []);

  const value = useMemo(
    () => ({ ...data, access, user, reload: load, patchClient, setData }),
    [data, access, user, load, patchClient],
  );

  return (
    <Gate>
      <div className="crm" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <CrmStyles />
        <Rail access={access} />
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {loading && <Loading label="Loading the workspace…" />}
          {!loading && error && <Empty>{error}</Empty>}
          {!loading && !error && data && (
            <CrmContext.Provider value={value}>
              <Outlet />
            </CrmContext.Provider>
          )}
        </main>
      </div>
    </Gate>
  );
}
