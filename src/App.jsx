import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import ForkHome from "./pages/ForkHome";
import ErrorBoundary from "./components/ErrorBoundary";

const Profile = lazy(() => import("./pages/Profile"));
const SupabaseLogin = lazy(() => import("./pages/SupabaseLogin"));
const BrokerDashboard = lazy(() => import("./pages/BrokerDashboard"));

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
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<ForkHome />} />
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
            <AppRoutes />
          </LoginModalProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
