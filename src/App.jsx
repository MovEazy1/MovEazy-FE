import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import { VisitCartProvider } from "./context/VisitCartContext";
import ErrorBoundary from "./components/ErrorBoundary";
import RequirePhoneModal from "./components/RequirePhoneModal";
import RequirePhoneForListing from "./components/RequirePhoneForListing";
import { useSessionTracking } from "./hooks/useSessionTracking";

// Lazy like every page: the tenant home pulls in the map, the swipe deck and
// the landing kit, and the CRM, owner and partner apps were downloading all of
// it before their own code could even start.
const ForkHome = lazy(() => import("./pages/ForkHome"));
const Profile = lazy(() => import("./pages/Profile"));
const SupabaseLogin = lazy(() => import("./pages/SupabaseLogin"));
/**
 * Self-serve browsing is off for launch.
 *
 * The map and the list let someone page through the whole inventory on their
 * own, which is the opposite of what we are selling: a seeker tells us what
 * they want, sees the five best homes for it, and then our team goes and finds
 * the rest across every portal there is. Leaving an "explore 400 flats" surface
 * next to that turns a concierge into a search box.
 *
 * So the browse routes are switched off here rather than deleted — MapView.jsx,
 * MapPage.jsx and Listings.jsx are untouched on disk, and turning them back on
 * is uncommenting these two lines and the two routes below. Everything that
 * used to link into them now lands on /matches (the five) or /property/:id (one
 * specific home), so no link in the wild — or in a customer's WhatsApp — breaks.
 *
 * const MapPage = lazy(() => import("./pages/MapPage"));
 */
const PropertyPage = lazy(() => import("./pages/PropertyPage"));
const CuratedProperties = lazy(() => import("./pages/CuratedProperties"));
const TopMatches = lazy(() => import("./pages/TopMatches"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const About = lazy(() => import("./pages/About"));
const Terms = lazy(() => import("./pages/Terms"));
const Storefront = lazy(() => import("./pages/Storefront"));
const CuratedSwipe = lazy(() => import("./pages/CuratedSwipe"));
const BuildingPage = lazy(() => import("./pages/BuildingPage"));
const TenantPreview = lazy(() => import("./pages/tenant/TenantPreview"));
const TenantProfilePage = lazy(() => import("./pages/tenant/TenantProfilePage"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ListMyFlat = lazy(() => import("./pages/ListMyFlat"));
const AdminDatabase = lazy(() => import("./pages/AdminDatabase"));
const Visits = lazy(() => import("./pages/Visits"));
const Shortlists = lazy(() => import("./pages/Shortlists"));
const RentManagement = lazy(() => import("./pages/RentManagement"));
const MyProperties = lazy(() => import("./pages/MyProperties"));
const SuperAdminPanel = lazy(() => import("./pages/SuperAdminPanel"));
const AnalyticsDashboard = lazy(() => import("./pages/AnalyticsDashboard"));
const OpsDashboard = lazy(() => import("./pages/OpsDashboard"));
const MarketingShell = lazy(() => import("./pages/marketing/MarketingShell"));
const MarketingIndex = lazy(() =>
  import("./pages/marketing/MarketingShell").then((m) => ({ default: m.MarketingIndex })),
);
const MarketingChannel = lazy(() => import("./pages/marketing/MarketingChannel"));
const CrmShell = lazy(() => import("./pages/crm/CrmShell"));
const CrmAppAnalyticsPage = lazy(() => import("./pages/crm/CrmAppAnalyticsPage"));
const CrmClientsPage = lazy(() => import("./pages/crm/CrmClientsPage"));
const CrmPipelinePage = lazy(() => import("./pages/crm/CrmPipelinePage"));
const CrmPropertiesPage = lazy(() => import("./pages/crm/CrmPropertiesPage"));
const CrmPropertyForm = lazy(() => import("./pages/crm/CrmPropertyForm"));
const CrmBrokersPage = lazy(() => import("./pages/crm/CrmBrokersPage"));
const CrmBrokerLeadsPage = lazy(() => import("./pages/crm/CrmBrokerLeadsPage"));
const CrmBuildingsPage = lazy(() => import("./pages/crm/CrmBuildingsPage"));
const CrmBuildingEditor = lazy(() => import("./pages/crm/CrmBuildingEditor"));
const CrmVisitsPage = lazy(() => import("./pages/crm/CrmVisitsPage"));
const CrmNotificationsPage = lazy(() => import("./pages/crm/CrmNotificationsPage"));
const CrmTeamPage = lazy(() => import("./pages/crm/CrmTeamPage"));
const CrmPaymentsPage = lazy(() => import("./pages/crm/CrmPaymentsPage"));
const CrmSettingsPage = lazy(() => import("./pages/crm/CrmSettingsPage"));
// The broker app. Its own route tree: at /partners here, and at the root of
// partners.moveazy.co.in (same deployment, same bundle — see lib/partners.js).
const PartnerApp = lazy(() => import("./pages/partners/PartnerApp"));
// The owner app: /owners here, the root of owners.moveazy.co.in.
const OwnerApp = lazy(() => import("./pages/owners/OwnerApp"));
const CrmInventoryOpsPage = lazy(() => import("./pages/crm/CrmInventoryOpsPage"));
/**
 * The CRM page being opened, fetched at start-up beside sign-in and the CRM's
 * data. As a lazy route it only began downloading once the workspace had
 * finished loading — one more wait, every time the CRM was opened. The same
 * import() as the lazy page above, so the same file, fetched once.
 */
function prefetchCrmPage(path) {
  const [, , seg = "", rest = ""] = path.split("/");
  const page = {
    "": () => import("./pages/crm/CrmClientsPage"),
    clients: () => import("./pages/crm/CrmClientsPage"),
    pipeline: () => import("./pages/crm/CrmPipelinePage"),
    properties: () => (rest ? import("./pages/crm/CrmPropertyForm") : import("./pages/crm/CrmPropertiesPage")),
    brokers: () => import("./pages/crm/CrmBrokersPage"),
    "broker-leads": () => import("./pages/crm/CrmBrokerLeadsPage"),
    "owner-qr": () => import("./pages/crm/CrmBuildingsPage"),
    buildings: () => import("./pages/crm/CrmBuildingEditor"),
    ops: () => import("./pages/crm/CrmInventoryOpsPage"),
    visits: () => import("./pages/crm/CrmVisitsPage"),
    notifications: () => import("./pages/crm/CrmNotificationsPage"),
    payments: () => import("./pages/crm/CrmPaymentsPage"),
    "app-analytics": () => import("./pages/crm/CrmAppAnalyticsPage"),
    team: () => import("./pages/crm/CrmTeamPage"),
    settings: () => import("./pages/crm/CrmSettingsPage"),
  }[seg];
  import("./pages/crm/CrmShell").catch(() => {});
  page?.().catch(() => {});
}
if (typeof window !== "undefined" && /^\/crm(\/|$)/.test(window.location.pathname)) prefetchCrmPage(window.location.pathname);

const IS_OWNER_HOST = typeof window !== "undefined" && /^owners?\./i.test(window.location.hostname);
const IS_PARTNER_HOST = typeof window !== "undefined" && /^partners\./i.test(window.location.hostname);
// tenant.moveazy.co.in: the whole site, but its front door is the tenant app.
const IS_TENANT_HOST = typeof window !== "undefined" && /^tenants?\./i.test(window.location.hostname);

function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
        fontSize: 16,
        color: "#64748b",
      }}
    >
      Loading…
    </div>
  );
}

/**
 * Everything that used to open the map still opens something.
 *
 * Two shapes arrive here. `/map?listingId=MZ-123` is one specific home — every
 * share link we have ever sent forwards to it — and that becomes /property/:id,
 * carrying its UTM parameters and `mz_s` token across so the open still
 * attributes. A bare `/map` was "let me browse", and that becomes the five
 * matches, which is the answer we now give to that question.
 */
function MapRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const listingId = String(params.get("listingId") || "").trim();
  if (!listingId) return <Navigate to="/matches" replace state={location.state} />;
  params.delete("listingId");
  const qs = params.toString();
  return (
    <Navigate
      to={`/property/${encodeURIComponent(listingId)}${qs ? `?${qs}` : ""}`}
      replace
      state={location.state}
    />
  );
}

function ProfileRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth?next=/profile" replace />;
  return children;
}

function SessionTrackerComponent() {
  useSessionTracking();
  return (
    <>
      {/* A signed-out visitor whose session opened directly on a property
          (a shared /p/:id link) must sign in before seeing it. If they do,
          the phone gate below picks up next for an account with none on file. */}
      <RequirePhoneForListing />
      {/* Sits above every route: a signed-in account with no mobile number
          saved is asked for one before it can use the app. */}
      <RequirePhoneModal />
      <AppRoutes />
    </>
  );
}

function AppRoutes() {
  if (IS_OWNER_HOST) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/*" element={<OwnerApp />} />
        </Routes>
      </Suspense>
    );
  }
  if (IS_PARTNER_HOST) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/*" element={<PartnerApp />} />
        </Routes>
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={IS_TENANT_HOST ? <ForkHome tenantEntry /> : <ForkHome />} />
        <Route path="/tenant" element={<ForkHome tenantEntry />} />
        <Route path="/partners/*" element={<PartnerApp />} />
        <Route path="/owners/*" element={<OwnerApp />} />
        {/* Browsing is off — see the note by the imports.
            <Route path="/map" element={<MapPage />} /> */}
        <Route path="/map" element={<MapRedirect />} />
        <Route path="/matches" element={<TopMatches />} />
        {/* One home, at its own address: where every shared link lands. */}
        <Route path="/property/:propertyId" element={<PropertyPage />} />
        {/* A broker's storefront: what their printed QR poster opens. */}
        <Route path="/b/:code" element={<Storefront />} />
        <Route path="/building/:code" element={<BuildingPage />} />
        {/* A partner broker's curated list for their tenant (not MovEazy's /curated). */}
        <Route path="/c/:token" element={<CuratedSwipe />} />
        {/* The shortlist our team curated for one person. With a token it is the
            WhatsApp link and works signed out; without one it is the same set
            for whoever is signed in. */}
        <Route path="/curated" element={<CuratedProperties />} />
        <Route path="/curated/:token" element={<CuratedProperties />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/preview/tenant" element={<TenantPreview />} />
        <Route path="/tenant-profile" element={<TenantProfilePage />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route
          path="/list-my-flat"
          element={
            <ProfileRoute>
              <ListMyFlat />
            </ProfileRoute>
          }
        />
        <Route path="/admin" element={<AdminDatabase />} />
        {/* An old bookmark. It used to be a second browsing surface; it is now
            the same redirect the map is. */}
        <Route path="/recommendations" element={<MapRedirect />} />
        {/* Broker sign-up and the old broker CRM now live in the partner app. The
            pages stay in the tree for now; every link to them lands there. */}
        <Route path="/register-broker" element={<Navigate to="/partners" replace />} />
        <Route path="/my-properties" element={<MyProperties />} />
        <Route path="/superadmin" element={<SuperAdminPanel />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        {/* Day-on-day operating numbers. Gated per-email in Postgres
            (can_view_ops_dashboard) and granted from /superadmin — the people who
            open this are not staff, so it deliberately shows counts and no rows. */}
        <Route path="/dashboard" element={<OpsDashboard />} />
        {/* Marketing channel dashboards. Access is per-email and per-channel,
            gated inside MarketingShell and again in Postgres — the people who
            open these are channel owners, not staff. ":slug" is deliberate:
            adding a channel in /superadmin gives it a working URL with no
            deploy. */}
        <Route path="/marketing" element={<MarketingShell />}>
          <Route index element={<MarketingIndex />} />
          {/* /marketing/head included: it is a channel row like any other, flagged
              as the roll-up, so one route carries one access check. */}
          <Route path=":slug" element={<MarketingChannel />} />
        </Route>
        {/* Internal CRM. Access is gated inside CrmShell (staff roles), not here. */}
        <Route path="/crm" element={<CrmShell />}>
          <Route index element={<Navigate to="/crm/clients" replace />} />
          <Route path="clients" element={<CrmClientsPage />} />
          <Route path="pipeline" element={<CrmPipelinePage />} />
          <Route path="properties" element={<CrmPropertiesPage />} />
          <Route path="properties/new" element={<CrmPropertyForm />} />
          <Route path="properties/:propertyId/edit" element={<CrmPropertyForm />} />
          <Route path="brokers" element={<CrmBrokersPage />} />
          <Route path="broker-leads" element={<CrmBrokerLeadsPage />} />
          <Route path="owner-qr" element={<CrmBuildingsPage />} />
          <Route path="buildings/new" element={<CrmBuildingEditor />} />
          <Route path="buildings/:id" element={<CrmBuildingEditor />} />
          <Route path="ops" element={<CrmInventoryOpsPage />} />
          <Route path="visits" element={<CrmVisitsPage />} />
          <Route path="notifications" element={<CrmNotificationsPage />} />
          <Route path="payments" element={<CrmPaymentsPage />} />
          <Route path="app-analytics" element={<CrmAppAnalyticsPage />} />
          <Route path="team" element={<CrmTeamPage />} />
          <Route path="settings" element={<CrmSettingsPage />} />
        </Route>
        <Route
          path="/visits"
          element={
            <ProfileRoute>
              <Visits />
            </ProfileRoute>
          }
        />
        <Route
          path="/shortlists"
          element={
            <ProfileRoute>
              <Shortlists />
            </ProfileRoute>
          }
        />
        {/* Superseded by the owner app, which keeps the same tenants table. */}
        <Route path="/tenant-management" element={<Navigate to="/owners/tenants" replace />} />
        <Route
          path="/rent-management"
          element={
            <ProfileRoute>
              <RentManagement />
            </ProfileRoute>
          }
        />
        <Route path="/auth" element={<SupabaseLogin />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route
          path="/profile"
          element={
            <ProfileRoute>
              <Profile />
            </ProfileRoute>
          }
        />
        <Route path="/broker" element={<Navigate to="/partners" replace />} />
        {/* Legacy routes → home or profile for now */}
        <Route path="/customer" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

const strip = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const routerBasename = strip || "/";

export default function App() {
  return (
    <BrowserRouter basename={routerBasename === "/" ? undefined : routerBasename}>
      <ErrorBoundary>
        <AuthProvider>
          <LoginModalProvider>
            <VisitCartProvider>
              <SessionTrackerComponent />
            </VisitCartProvider>
          </LoginModalProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
