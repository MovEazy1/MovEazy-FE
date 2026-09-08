/**
 * Team & roles — super admin only.
 *
 * The gate here isn't a scope check by choice: admin.roles.write is the one
 * permission that can never be delegated, so both this screen and the Postgres
 * policy behind admin_roles test the hardcoded super-admin email directly. Add a
 * CRM manager and they're live on their next sign-in — no deploy.
 */
import { useCallback, useEffect, useState } from "react";
import { useCrm } from "./CrmShell";
import {
  ASSIGNABLE_ROLES, SCOPE_LABELS, fetchAdminRoster, grantAdminRole,
  isSuperAdminEmail, revokeAdminRole, roleLabel, scopesForRole,
} from "../../lib/adminScopes";
import { Btn, C, Empty, Loading, Toast, shortDate } from "./crmUi";

export default function CrmTeamPage() {
  const { access } = useCrm();
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ASSIGNABLE_ROLES[0]?.id ?? "crm_manager");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(() => {
    fetchAdminRoster()
      .then(setRows)
      .catch((e) => { setRows([]); showToast(e?.message || "Could not read the team list", "error"); });
  }, []);

  useEffect(load, [load]);

  const isSuper = isSuperAdminEmail(access.email);

  if (!isSuper) {
    return <Empty>Only the super admin can manage roles.</Empty>;
  }

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await grantAdminRole(email, role, notes);
      setEmail("");
      setNotes("");
      load();
      showToast("Access granted — live on their next sign-in");
    } catch (err) {
      showToast(err?.message || "Could not grant access", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rowEmail) => {
    setBusy(true);
    try {
      await revokeAdminRole(rowEmail);
      load();
      showToast("Access removed");
    } catch (err) {
      showToast(err?.message || "Could not remove access", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, maxWidth: 820, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>Team &amp; roles</h1>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: 0, maxWidth: "62ch", lineHeight: 1.6 }}>
            Add someone by email, pick a role, done. The role decides what they see; Postgres enforces it, so
            hiding a button here isn't the only thing standing between them and your data.
          </p>
        </div>

        <form onSubmit={add} className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="crm-label">Give someone access</span>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
            <input className="crm-input" type="email" required placeholder="teammate@gmail.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="crm-input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <input className="crm-input" placeholder="Note (optional) — who they are, why"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Btn variant="primary" type="submit" disabled={busy}>Grant access</Btn>
            <span className="crm-mute" style={{ fontSize: 11.5 }}>
              {ASSIGNABLE_ROLES.find((r) => r.id === role)?.hint}
            </span>
          </div>
        </form>

        <div>
          <span className="crm-label">Who has access</span>
          <div style={{ marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
            {rows === null ? (
              <Loading />
            ) : rows.length === 0 ? (
              <Empty>Nobody yet — you're the only one in.</Empty>
            ) : (
              <table className="crm-table">
                <thead>
                  <tr><th>Email</th><th>Role</th><th>Added</th><th>Note</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.email}>
                      <td>{r.email}</td>
                      <td>{roleLabel(r.role)}</td>
                      <td className="crm-mute crm-num">{shortDate(r.created_at)}</td>
                      <td className="crm-mute">{r.notes || "—"}</td>
                      <td>
                        {isSuperAdminEmail(r.email) ? (
                          <span className="crm-mute" style={{ fontSize: 11 }}>can't be removed</span>
                        ) : (
                          <Btn sm variant="danger" disabled={busy} onClick={() => remove(r.email)}>Remove</Btn>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="crm-card">
          <span className="crm-label">What a {roleLabel(role)} can do</span>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: C.creamDim, fontSize: 12.5, lineHeight: 1.7 }}>
            {scopesForRole(role).map((s) => <li key={s}>{SCOPE_LABELS[s] ?? s}</li>)}
          </ul>
          <p className="crm-mute" style={{ fontSize: 11.5, margin: "10px 0 0", lineHeight: 1.55 }}>
            Granting and revoking roles is never on this list — it stays with the super admin account, in the
            code and in the database policy both.
          </p>
        </div>
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
