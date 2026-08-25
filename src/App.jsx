import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import { VisitCartProvider } from "./context/VisitCartContext";
import ForkHome from "./pages/ForkHome";
import ErrorBoundary from "./components/ErrorBoundary";

const Profile = lazy(() => import("./pages/Profile"));
const SupabaseLogin = lazy(() => import("./pages/SupabaseLogin"));
const BrokerDashboard = lazy(() => import("./pages/BrokerDashboard"));
const MapPage = lazy(() => import("./pages/MapPage"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const About = lazy(() => import("./pages/About"));
const ListMyFlat = lazy(() => import("./pages/ListMyFlat"));
const AdminDatabase = lazy(() => import("./pages/AdminDatabase"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const Visits = lazy(() => import("./pages/Visits"));
const BrokerRegister = lazy(() => import("./pages/BrokerRegister"));
const MyProperties = lazy(() => import("./pages/MyProperties"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));

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
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/register-broker" element={<BrokerRegister />} />
        <Route path="/my-properties" element={<MyProperties />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route
          path="/visits"
          element={
            <ProfileRoute>
              <Visits />
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
              <AppRoutes />
            </VisitCartProvider>
          </LoginModalProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
