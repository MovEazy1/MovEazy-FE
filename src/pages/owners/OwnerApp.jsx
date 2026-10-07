/**
 * MovEazy Owners — the owner app.
 *
 * Served at owners.moveazy.co.in (root) and at moveazy.co.in/owners, from the
 * same bundle as the customer site and the broker partner app.
 *
 * The gate, in order:
 *   signed out          → sign in with Google
 *   no mobile on file   → the site-wide RequirePhoneModal asks for it
 *   every open          → owner_register(): creates the account (auto-approved
 *                         while the CRM switch is on), refreshes the number,
 *                         and links flats the owner has posted as the owner
 *   pending / suspended → a holding screen
 *   approved            → the app
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Clock, ShieldOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  fetchOwnerMe, fetchOwnerProperties, fetchOwnerTenants, fetchRatings, fetchRequests, friendlyError, op, registerOwner,
  teamWa,
} from "../../lib/owners";
import { fetchMyBuildings } from "../../lib/buildings";
import { BottomNav, Loading, OwnerStyles, ToastHost, WhatsAppIcon } from "./ownerUi";
import { hasStoredSession } from "../../lib/supabase";
import { prefetchWhenIdle } from "../../lib/prefetch";
import { DAY_MS, readCache, writeCache } from "../../lib/localCache";
import TopProgress from "../../components/TopProgress";

// What the owner saw last time stays on the device for 30 days, so the app
// opens on it at once and refreshes underneath (lib/localCache.js).
const SAVED_FOR = 30 * DAY_MS;

// The signed-out landing page is the bulk of this file's weight, and a signed-in
// owner never sees it. Loaded on demand — and straight away when nobody is
// signed in on this device, so a visitor doesn't wait for it.
const loadOwnerLanding = () => import("./OwnerLanding");
const OwnerLanding = lazy(loadOwnerLanding);
if (typeof window !== "undefined" && !hasStoredSession()) loadOwnerLanding().catch(() => {});

const OwnerHome = lazy(() => import("./OwnerHome"));
const PropertiesList = lazy(() => import("./PropertiesList"));
const PropertyForm = lazy(() => import("./PropertyForm"));
const PropertyDetail = lazy(() => import("./PropertyDetail"));
const FindTenant = lazy(() => import("./FindTenant"));
const TenantsList = lazy(() => import("./TenantsList"));
const TenantForm = lazy(() => import("./TenantForm"));
const TenantProfile = lazy(() => import("./TenantProfile"));
const ServicesHome = lazy(() => import("./ServicesHome"));
const RepairsList = lazy(() => import("./RepairsList"));
const NewRepair = lazy(() => import("./NewRepair"));
const RequestDetail = lazy(() => import("./RequestDetail"));
const IncreaseRent = lazy(() => import("./IncreaseRent"));
const DesignerCall = lazy(() => import("./DesignerCall"));
const DocumentsPage = lazy(() => import("./DocumentsPage"));
const NotificationsPage = lazy(() => import("./NotificationsPage"));
const MorePage = lazy(() => import("./MorePage"));
const BuildingForm = lazy(() => import("./BuildingForm"));
const BuildingDetail = lazy(() => import("./BuildingDetail"));
const RentDashboard = lazy(() => import("./RentDashboard"));
const FlatLeads = lazy(() => import("./FlatLeads"));

export const OwnerContext = createContext(null);
export const useOwner = () => useContext(OwnerContext);

const UI_KEY = "mz_owner_ui";
function readUi() {
  try { return JSON.parse(sessionStorage.getItem(UI_KEY) || "null") || {}; } catch { return {}; }
}

function Holding({ icon, title, children }) {
  return (
    <div className="oz-center">
      <div style={{ maxWidth: 380 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--champ2)", color: "var(--deep)", display: "grid",
          placeItems: "center", margin: "0 auto 16px" }}>{icon}</div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{title}</h1>
        <div style={{ color: "var(--dim)", fontSize: 15, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
}

function OwnerWorkspace({ me, reloadMe }) {
  // The screens an owner opens next, fetched while the phone is idle.
  useEffect(() => prefetchWhenIdle([
    () => import("./OwnerHome"), () => import("./PropertiesList"), () => import("./PropertyDetail"),
    () => import("./FindTenant"), () => import("./MorePage"),
  ]), []);
  const [properties, setProperties] = useState(null);
  const [propError, setPropError] = useState("");
  const [tenants, setTenants] = useState([]);
  const [ratings, setRatings] = useState({});
  const [requests, setRequests] = useState([]);
  const [buildings, setBuildings] = useState(null);
  const [ui, setUiState] = useState(() => ({ occ: "all", q: "", sort: "recent", area: "", type: "", ...readUi() }));

  const setUi = useCallback((patch) => {
    setUiState((cur) => {
      const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
      try { sessionStorage.setItem(UI_KEY, JSON.stringify(next)); } catch { /* private tab */ }
      return next;
    });
  }, []);

  // Which lists have their fresh copy already — a saved copy never overwrites those.
  const fresh = useRef(new Set());
  const reloadProperties = useCallback(async () => {
    try {
      setProperties(await fetchOwnerProperties());
      fresh.current.add("properties");
      setPropError("");
    } catch (e) {
      setPropError(friendlyError(e, "Could not load your properties."));
      setProperties((cur) => cur ?? []);
    }
  }, []);
  const reloadTenants = useCallback(async () => {
    try { setTenants(await fetchOwnerTenants()); fresh.current.add("tenants"); } catch { /* keep */ }
  }, []);
  const reloadRequests = useCallback(async () => {
    try { setRequests(await fetchRequests()); fresh.current.add("requests"); } catch { /* keep */ }
  }, []);
  const reloadBuildings = useCallback(async () => {
    try { setBuildings(await fetchMyBuildings()); fresh.current.add("buildings"); } catch { setBuildings((cur) => cur ?? []); }
  }, []);

  const { user } = useAuth();
  const uid = user?.uid;
  const [refreshing, setRefreshing] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let alive = true;
    readCache(uid, "owner:data", SAVED_FOR).then((d) => {
      if (!alive || !d || fresh.current.size >= 5) return;
      const f = fresh.current;
      if (!f.has("properties")) setProperties(d.properties ?? null);
      if (!f.has("tenants")) setTenants(d.tenants ?? []);
      if (!f.has("requests")) setRequests(d.requests ?? []);
      if (!f.has("buildings")) setBuildings(d.buildings ?? null);
      if (!f.has("ratings")) setRatings(d.ratings ?? {});
      setRefreshing(true);
    });
    Promise.allSettled([
      reloadProperties(), reloadTenants(), reloadRequests(), reloadBuildings(),
      fetchRatings().then((r) => { setRatings(r); fresh.current.add("ratings"); }),
    ]).then(() => {
      if (!alive) return;
      setRefreshing(false);
      setSettled(true);
    });
    return () => { alive = false; };
  }, [uid, reloadProperties, reloadTenants, reloadRequests, reloadBuildings]);

  // Keep the saved copy current with whatever the owner does, a moment after they do it.
  useEffect(() => {
    if (!settled || !uid || properties == null) return undefined;
    const t = setTimeout(() => writeCache(uid, "owner:data", { properties, tenants, ratings, requests, buildings }), 800);
    return () => clearTimeout(t);
  }, [settled, uid, properties, tenants, ratings, requests, buildings]);

  const byId = useMemo(() => new Map((properties ?? []).map((p) => [p.property_id, p])), [properties]);

  const value = useMemo(() => ({
    me, reloadMe, properties, propError, reloadProperties, byId, tenants, setTenants, reloadTenants,
    ratings, setRatings, requests, setRequests, reloadRequests, ui, setUi, buildings, reloadBuildings,
  }), [me, reloadMe, properties, propError, reloadProperties, byId, tenants, reloadTenants, ratings, requests,
    reloadRequests, ui, setUi, buildings, reloadBuildings]);

  return (
    <OwnerContext.Provider value={value}>
      <TopProgress active={refreshing} color="#0A6B4E" />
      <div className="oz-col">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route index element={<OwnerHome />} />
            <Route path="properties" element={<PropertiesList />} />
            <Route path="properties/new" element={<PropertyForm />} />
            <Route path="properties/:id" element={<PropertyDetail />} />
            <Route path="properties/:id/edit" element={<PropertyForm />} />
            <Route path="properties/:id/find-tenant" element={<FindTenant />} />
            <Route path="properties/:id/leads" element={<FlatLeads />} />
            <Route path="rent-dashboard" element={<RentDashboard />} />
            <Route path="buildings/new" element={<BuildingForm />} />
            <Route path="buildings/:id" element={<BuildingDetail />} />
            <Route path="buildings/:id/edit" element={<BuildingForm />} />
            <Route path="tenants" element={<TenantsList />} />
            <Route path="tenants/new" element={<TenantForm />} />
            <Route path="tenants/:id" element={<TenantProfile />} />
            <Route path="tenants/:id/edit" element={<TenantForm />} />
            <Route path="services" element={<ServicesHome />} />
            <Route path="repairs" element={<RepairsList />} />
            <Route path="repairs/new" element={<NewRepair />} />
            <Route path="repairs/:id" element={<RequestDetail />} />
            <Route path="increase-rent" element={<IncreaseRent />} />
            <Route path="designer-call" element={<DesignerCall />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="*" element={<Navigate to={op("/")} replace />} />
          </Routes>
        </Suspense>
        <BottomNav />
      </div>
    </OwnerContext.Provider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | need_phone | ready | error
  const [error, setError] = useState("");
  const hasPhone = Boolean(String(user?.phone || "").trim());

  // Known on this device: open on the saved account straight away; load() below confirms it.
  useEffect(() => {
    if (!user?.uid) return undefined;
    let alive = true;
    readCache(user.uid, "owner:me", SAVED_FOR).then((m) => {
      if (!alive || !m) return;
      setMe((cur) => cur ?? m);
      setState((s) => (s === "idle" || s === "loading" ? "ready" : s));
    });
    return () => { alive = false; };
  }, [user?.uid]);

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      await registerOwner(user?.name);
      const m = await fetchOwnerMe();
      setMe(m);
      writeCache(user?.uid, "owner:me", m);
      setState("ready");
    } catch (e) {
      if (e?.code === "22023" && /mobile/i.test(e?.message || "")) {
        setState("need_phone");
        return;
      }
      setError(friendlyError(e, "Could not open the owner app."));
      setState("error");
    }
  }, [user?.name, user?.uid]);

  useEffect(() => {
    if (!loading && user?.uid && hasPhone) load();
  }, [loading, user?.uid, hasPhone, load]);

  if (loading) return <Loading label="Opening MovEazy Owners…" />;
  // Signed-out visitors get the landing page; its sign-up returns here.
  if (!user) return <Suspense fallback={<Loading />}><OwnerLanding /></Suspense>;
  if (!hasPhone || state === "need_phone") {
    return <Holding icon={<Clock size={28} />} title="Verify your mobile number">One step left — add the number MovEazy can reach you on.</Holding>;
  }
  if (state === "error") {
    return (
      <Holding icon={<ShieldOff size={28} />} title="Something went wrong">
        {error}
        <div style={{ marginTop: 16 }}><button type="button" className="oz-btn oz-btn--primary" onClick={load}>Try again</button></div>
      </Holding>
    );
  }
  if (state !== "ready" || !me) return <Loading label="Opening MovEazy Owners…" />;

  const status = me.owner?.status;
  if (status === "suspended") {
    return (
      <Holding icon={<ShieldOff size={28} />} title="Access paused">
        Your owner account has been paused. Message the MovEazy team if you think this is a mistake.
        <div style={{ marginTop: 16 }}>
          <a className="oz-btn oz-btn--primary" href={teamWa(`Hi, my MovEazy owner account (${user.email}) is paused. Can you help?`)}
            target="_blank" rel="noreferrer"><WhatsAppIcon /> Message MovEazy</a>
        </div>
      </Holding>
    );
  }
  if (status !== "approved") {
    return (
      <Holding icon={<Clock size={28} />} title="Your owner account is being verified">
        Thanks, {me.owner?.name?.split(" ")[0] || "there"} — the MovEazy team is verifying your account. You'll get access as soon as it's approved.
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="oz-btn" onClick={load}>Check again</button>
          <a className="oz-btn oz-btn--primary" href={teamWa(`Hi, I've signed up as an owner on MovEazy (${user.email}). Please verify my account.`)}
            target="_blank" rel="noreferrer"><WhatsAppIcon /> Message MovEazy</a>
        </div>
      </Holding>
    );
  }
  return <OwnerWorkspace me={me} reloadMe={load} />;
}

export default function OwnerApp() {
  return (
    <div className="oz">
      <OwnerStyles />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="*" element={<Gate />} />
        </Routes>
      </Suspense>
      <ToastHost />
    </div>
  );
}
