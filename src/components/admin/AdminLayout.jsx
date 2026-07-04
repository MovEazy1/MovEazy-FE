import { Link } from "react-router-dom";

const INK = "#0f172a";
const SIDEBAR = "#111827";
const PAPER = "#f1f5f9";
const LINE = "#e2e8f0";
const MUTED = "#64748b";
const ACCENT = "#2563eb";
const ACCENT_SOFT = "#dbeafe";

function NavItem({ icon, label, badge, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 14px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        background: active ? ACCENT : "transparent",
        color: active ? "#fff" : "#cbd5e1",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        transition: "background 0.15s",
      }}
    >
      <span style={{ display: "flex", opacity: active ? 1 : 0.75 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 999,
            background: active ? "rgba(255,255,255,0.2)" : "#374151",
            color: active ? "#fff" : "#fbbf24",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  listings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  listing_dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
    </svg>
  ),
  operations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  plan_analytics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  site: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  access: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
};

export const ADMIN_NAV = [
  { id: "overview", label: "Overview" },
  { id: "operations", label: "Leads & queue", badgeKey: "unread" },
  { id: "users", label: "Users" },
  { id: "listings", label: "Listings" },
  { id: "listing_dashboard", label: "Listing cards" },
  { id: "plan_analytics", label: "Analytics" },
  { id: "site", label: "Site & contact" },
  { id: "agents", label: "Agents directory" },
  { id: "access", label: "Admin access" },
];

export default function AdminLayout({
  user,
  section,
  onSectionChange,
  onLogout,
  onRefresh,
  onOpenCrm,
  badges = {},
  isMobile,
  children,
}) {
  const activeLabel = ADMIN_NAV.find((n) => n.id === section)?.label ?? "Admin";

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: PAPER, fontFamily: "Inter, system-ui, sans-serif" }}>
      {!isMobile ? (
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            background: SIDEBAR,
            display: "flex",
            flexDirection: "column",
            padding: "20px 12px",
          }}
        >
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 24px", textDecoration: "none" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1.5px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                color: "#fff",
              }}
            >
              MZ
            </div>
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 600, color: "#fff" }}>Moveazy</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Admin console</div>
            </div>
          </Link>

          <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            {ADMIN_NAV.map((item) => (
              <NavItem
                key={item.id}
                icon={ICONS[item.id]}
                label={item.label}
                badge={item.badgeKey ? badges[item.badgeKey] : null}
                active={section === item.id}
                onClick={() => onSectionChange(item.id)}
              />
            ))}
          </nav>

          <div style={{ borderTop: "1px solid #374151", paddingTop: 14, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "#94a3b8", padding: "0 8px 10px", wordBreak: "break-all" }}>
              {user?.name || user?.email || "Admin"}
            </div>
            <button
              type="button"
              onClick={onLogout}
              style={{
                width: "100%",
                padding: "9px 14px",
                borderRadius: 8,
                border: "none",
                background: "#7f1d1d",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
      ) : null}

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            background: "#fff",
            borderBottom: `1px solid ${LINE}`,
            padding: isMobile ? "12px 14px" : "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: INK, fontFamily: "Georgia, serif" }}>
              {activeLabel}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{user?.email}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isMobile ? (
              <select
                value={section}
                onChange={(e) => onSectionChange(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13 }}
              >
                {ADMIN_NAV.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={onOpenCrm}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Staff CRM
            </button>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${LINE}`, background: ACCENT_SOFT, color: ACCENT, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Refresh
              </button>
            ) : null}
            {isMobile ? (
              <button
                type="button"
                onClick={onLogout}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#7f1d1d", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Sign out
              </button>
            ) : null}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 12 : "20px 24px" }}>{children}</div>
      </main>
    </div>
  );
}
