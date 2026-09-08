import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import { VisitCartProvider } from "./context/VisitCartContext";
import ForkHome from "./pages/ForkHome";
import ErrorBoundary from "./components/ErrorBoundary";
import RequirePhoneModal from "./components/RequirePhoneModal";
import { useSessionTracking } from "./hooks/useSessionTracking";

const Profile = lazy(() => import("./pages/Profile"));
const SupabaseLogin = lazy(() => import("./pages/SupabaseLogin"));
const BrokerDashboard = lazy(() => import("./pages/BrokerDashboard"));
const MapPage = lazy(() => import("./pages/MapPage"));
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
const CrmShell = lazy(() => import("./pages/crm/CrmShell"));
const CrmClientsPage = lazy(() => import("./pages/crm/CrmClientsPage"));
const CrmPipelinePage = lazy(() => import("./pages/crm/CrmPipelinePage"));
const CrmPropertiesPage = lazy(() => import("./pages/crm/CrmPropertiesPage"));
const CrmPropertyForm = lazy(() => import("./pages/crm/CrmPropertyForm"));
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

/** Keeps every existing link and bookmark to /recommendations working. */
function RecommendationsRedirect() {
  const { state } = useLocation();
  return <Navigate to="/map" replace state={state} />;
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
        <Route path="/map" element={<MapPage />} />
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
        {/* One browsing surface. /recommendations had a second map and a second
            listing detail view of its own, so every improvement reached only one
            of the two paths a seeker could arrive by. Ranking now lives in the
            map; the old URL keeps working and carries its preferences over. */}
        <Route path="/recommendations" element={<RecommendationsRedirect />} />
        <Route path="/register-broker" element={<BrokerRegister />} />
        <Route path="/my-properties" element={<MyProperties />} />
        <Route path="/superadmin" element={<SuperAdminPanel />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        {/* Internal CRM. Access is gated inside CrmShell (staff roles), not here. */}
        <Route path="/crm" element={<CrmShell />}>
          <Route index element={<Navigate to="/crm/clients" replace />} />
          <Route path="clients" element={<CrmClientsPage />} />
          <Route path="pipeline" element={<CrmPipelinePage />} />
          <Route path="properties" element={<CrmPropertiesPage />} />
          <Route path="properties/new" element={<CrmPropertyForm />} />
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
