import { useCallback, useEffect, useState } from "react";
import {
  addAdminAllowlistEmail,
  fetchAdminAllowlist,
  getEnvAdminEmails,
  normalizeAdminEmail,
  removeAdminAllowlistEmail,
} from "../../lib/adminAccess";
import { isSupabaseConfigured } from "../../lib/supabase";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminAccessPanel({ currentEmail, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const envEmails = getEnvAdminEmails();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminAllowlist({ force: true });
      setRows(data);
    } catch (e) {
      setError(e?.message || "Could not load admin allowlist.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onAdd = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    const email = normalizeAdminEmail(newEmail);
    if (!email) {
      setError("Enter a Gmail address.");
      return;
    }
    setBusy(true);
    try {
      await addAdminAllowlistEmail(email, newNotes);
      setNewEmail("");
      setNewNotes("");
      setInfo(`Added ${email} to the admin allowlist.`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Could not add email.");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (row) => {
    const email = normalizeAdminEmail(row.email);
    if (normalizeAdminEmail(currentEmail) === email) {
      setError("You cannot remove your own admin access while signed in.");
      return;
    }
    if (!window.confirm(`Remove ${email} from the admin allowlist?`)) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await removeAdminAllowlistEmail(row.id);
      setInfo(`Removed ${email}.`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err?.message || "Could not remove email.");
    } finally {
      setBusy(false);
    }
  };

  const card = {
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    padding: 20,
    marginBottom: 16,
  };

  return (
    <div>
      <div style={card}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Who can access /admin</h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#64748b", lineHeight: 1.55, maxWidth: 640 }}>
          Only emails on this allowlist (plus bootstrap addresses in <code style={{ fontSize: 12 }}>VITE_ADMIN_EMAILS</code>)
          can open the admin dashboard. Manage the list below after running{" "}
          <code style={{ fontSize: 12 }}>fe/supabase/admin_schema.sql</code> in Supabase.
        </p>

        {!isSupabaseConfigured ? (
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: 12, fontSize: 13, color: "#92400e" }}>
            Supabase is not configured — only env bootstrap emails can access admin until you add{" "}
            <code>VITE_SUPABASE_URL</code> and run the admin schema.
          </div>
        ) : null}

        {error ? (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 12, fontSize: 13, color: "#991b1b", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}
        {info ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 12, fontSize: 13, color: "#166534", marginBottom: 12 }}>
            {info}
          </div>
        ) : null}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Env bootstrap (always allowed)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {envEmails.map((email) => (
              <span
                key={email}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  border: "1px solid #bfdbfe",
                }}
              >
                {email}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={onAdd} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 20 }}>
          <input
            type="email"
            required
            placeholder="admin@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={busy || !isSupabaseConfigured}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
          />
          <input
            type="text"
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            disabled={busy || !isSupabaseConfigured}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? "wait" : "pointer",
              opacity: busy || !isSupabaseConfigured ? 0.6 : 1,
            }}
          >
            Add email
          </button>
        </form>

        {loading ? (
          <div style={{ fontSize: 14, color: "#64748b" }}>Loading allowlist…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Email", "Notes", "Added", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: "#475569",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: "#94a3b8" }}>
                      No rows in Supabase yet — env bootstrap emails still work. Add teammates above.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isSelf = normalizeAdminEmail(row.email) === normalizeAdminEmail(currentEmail);
                    return (
                      <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>
                          {row.email}
                          {isSelf ? (
                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#2563eb" }}>YOU</span>
                          ) : null}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#64748b" }}>{row.notes || "—"}</td>
                        <td style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{fmtDate(row.created_at)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <button
                            type="button"
                            disabled={busy || isSelf}
                            onClick={() => onRemove(row)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: "1px solid #fecaca",
                              background: isSelf ? "#f8fafc" : "#fef2f2",
                              color: isSelf ? "#94a3b8" : "#dc2626",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: isSelf ? "not-allowed" : "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
