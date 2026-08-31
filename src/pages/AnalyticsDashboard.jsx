import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sessionTracker } from "../lib/sessionTracking";
import MovEazyNav from "../components/layout/MovEazyNav";

const colors = {
  mobile: "#3b82f6",
  tablet: "#10b981",
  desktop: "#f59e0b",
  tenant: "#8b5cf6",
  owner: "#ec4899",
  broker: "#f97316",
  null: "#6b7280",
};

function StatCard({ label, value, color = "#1f2937" }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-6">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function PieChart({ data, title }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="text-center py-8 text-gray-400">No data available</div>;
  }

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const entries = Object.entries(data);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-bold text-lg mb-4 text-gray-900">{title}</h3>
      <div className="space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-4">
            <div className="w-24">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 capitalize">{key}</span>
                <span className="text-sm font-bold text-gray-900">{value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(value / total) * 100}%`, background: colors[key] || "#6b7280" }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 min-w-12">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageViewsTable({ pages }) {
  if (!pages || pages.length === 0) {
    return <div className="text-center py-8 text-gray-400">No page views data available</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-bold text-lg text-gray-900">Most Popular Pages</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {pages.slice(0, 10).map((item, idx) => (
          <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.page || "/"}</p>
            </div>
            <div className="ml-4 flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{item.views}</p>
                <p className="text-xs text-gray-500">views</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionsTable({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return <div className="text-center py-8 text-gray-400">No recent sessions</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-bold text-lg text-gray-900">Recent Sessions</h3>
      </div>
      <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
        {sessions.slice(-10).reverse().map((session, idx) => (
          <div key={idx} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {session.userRole ? session.userRole.charAt(0).toUpperCase() + session.userRole.slice(1) : "Visitor"}
                </p>
                <p className="text-xs text-gray-500">{new Date(session.startTime).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <span
                  className="inline-block px-2 py-1 rounded text-xs font-semibold text-white"
                  style={{ background: colors[session.deviceInfo.type] || "#6b7280" }}
                >
                  {session.deviceInfo.type}
                </span>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-gray-600">
              <span>⏱ {session.duration || 0}s</span>
              <span>📄 {session.pages.length} pages</span>
              <span>🖥 {session.deviceInfo.screen.width}x{session.deviceInfo.screen.height}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    // Redirect non-admins
    if (!loading && (!user || user.role !== "admin")) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const updateAnalytics = () => {
      const data = sessionTracker.getAnalytics();
      setAnalytics(data);
    };

    updateAnalytics();

    let interval;
    if (autoRefresh) {
      interval = setInterval(updateAnalytics, 5000); // Refresh every 5 seconds
    }

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time session and user analytics</p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: autoRefresh ? "#3b82f6" : "#e5e7eb",
              color: autoRefresh ? "white" : "#374151",
            }}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
        </div>

        {analytics ? (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Sessions" value={analytics.totalSessions} color="#3b82f6" />
              <StatCard
                label="Avg. Session Duration"
                value={`${analytics.averageSessionDuration}s`}
                color="#10b981"
              />
              <StatCard
                label="Most Used Device"
                value={Object.entries(analytics.deviceBreakdown)
                  .sort((a, b) => b[1] - a[1])[0][0]
                  .toUpperCase()}
                color="#f59e0b"
              />
              <StatCard
                label="Primary User Type"
                value={
                  Object.entries(analytics.roleBreakdown)
                    .sort((a, b) => b[1] - a[1])[0][0]
                    .charAt(0)
                    .toUpperCase() +
                  Object.entries(analytics.roleBreakdown)
                    .sort((a, b) => b[1] - a[1])[0][0]
                    .slice(1)
                }
                color="#8b5cf6"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <PieChart data={analytics.deviceBreakdown} title="Device Type Breakdown" />
              <PieChart data={analytics.roleBreakdown} title="User Type Breakdown" />
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <PageViewsTable pages={analytics.pageViews} />
              <SessionsTable sessions={sessionTracker.getSessionHistory()} />
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-white border border-gray-200 p-12 text-center">
            <p className="text-gray-500 mb-4">No analytics data yet</p>
            <p className="text-sm text-gray-400">
              Analytics will appear here as users interact with the platform.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
