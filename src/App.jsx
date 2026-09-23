import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import { VisitCartProvider } from "./context/VisitCartContext";
import ForkHome from "./pages/ForkHome";
import ErrorBoundary from "./components/ErrorBoundary";
import RequirePhoneModal from "./components/RequirePhoneModal";
import RequirePhoneForListing from "./components/RequirePhoneForListing";
import { useSessionTracking } from "./hooks/useSessionTracking";

const Profile = lazy(() => import("./pages/Profile"));
const SupabaseLogin = lazy(() => import("./pages/SupabaseLogin"));
const BrokerDashboard = lazy(() => import("./pages/BrokerDashboard"));
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
const ListMyFlat = lazy(() => import("./pages/ListMyFlat"));
const AdminDatabase = lazy(() => import("./pages/AdminDatabase"));
const Visits = lazy(() => import("./pages/Visits"));
const Shortlists = lazy(() => import("./pages/Shortlists"));
const TenantManagement = lazy(() => import("./pages/TenantManagement"));
const RentManagement = lazy(() => import("./pages/RentManagement"));
const BrokerRegister = lazy(() => import("./pages/BrokerRegister"));
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
const CrmClientsPage = lazy(() => import("./pages/crm/CrmClientsPage"));
const CrmPipelinePage = lazy(() => import("./pages/crm/CrmPipelinePage"));
const CrmPropertiesPage = lazy(() => import("./pages/crm/CrmPropertiesPage"));
const CrmPropertyForm = lazy(() => import("./pages/crm/CrmPropertyForm"));
const CrmVisitsPage = lazy(() => import("./pages/crm/CrmVisitsPage"));
const CrmTeamPage = lazy(() => import("./pages/crm/CrmTeamPage"));
const CrmPaymentsPage = lazy(() => import("./pages/crm/CrmPaymentsPage"));
const CrmSettingsPage = lazy(() => import("./pages/crm/CrmSettingsPage"));

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

function BrokerRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth?next=/broker" replace />;
  // Broker CRM is for broker accounts only — everyone else is sent to register.
  if (user.role !== "broker") return <Navigate to="/register-broker" replace />;
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
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<ForkHome />} />
        {/* Browsing is off — see the note by the imports.
            <Route path="/map" element={<MapPage />} /> */}
        <Route path="/map" element={<MapRedirect />} />
        <Route path="/matches" element={<TopMatches />} />
        {/* One home, at its own address: where every shared link lands. */}
        <Route path="/property/:propertyId" element={<PropertyPage />} />
        {/* The shortlist our team curated for one person. With a token it is the
            WhatsApp link and works signed out; without one it is the same set
            for whoever is signed in. */}
        <Route path="/curated" element={<CuratedProperties />} />
        <Route path="/curated/:token" element={<CuratedProperties />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
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
        <Route path="/register-broker" element={<BrokerRegister />} />
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
          <Route path="visits" element={<CrmVisitsPage />} />
          <Route path="payments" element={<CrmPaymentsPage />} />
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
        <Route
          path="/tenant-management"
          element={
            <ProfileRoute>
              <TenantManagement />
            </ProfileRoute>
          }
        />
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
        <Route
          path="/broker"
          element={
            <BrokerRoute>
              <BrokerDashboard />
            </BrokerRoute>
          }
        />
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
