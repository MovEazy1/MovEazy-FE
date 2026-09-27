/**
 * Brokers → MovEazy partners: who has signed up to the broker app, whether
 * they are let in, and who holds Premium.
 *
 * Auto-approve starts ticked, so an invited broker is in the moment they sign
 * in and give a number. Untick it and new sign-ups queue here as pending. Every
 * decision is made by partner_admin_* in partner_schema.sql, which checks the
 * partners.manage scope itself; the disabled buttons here are only courtesy.
 *
 * Premium is granted by hand until the payment gateway lands. It writes the
 * same entitlement row the gateway will, so switching over changes nothing here.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, C, Chip, Empty, Toast, shortDate } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { whatsappUrl } from "../../lib/crmSettings";
import { formatForDisplay } from "../../lib/mobile";
import {
  adminGrantPremium, adminListPartners, adminSetAutoApprove, adminSetStatus, fetchProgramSettings, friendlyError,
} from "../../lib/partners";

const STATUS_TONE = { pending: C.gold, approved: C.accent, suspended: C.coral };

export default function CrmPartnersSection({ access }) {
  const canManage = access.has(SCOPES.PARTNERS_MANAGE);
  const [rows, setRows] = useState(null);
  const [settings, setSettings] = useState(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  const showToast = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([adminListPartners(), fetchProgramSettings()]);
      setRows(list);
      setSettings(s);
      setError("");
    } catch (e) {
      setRows([]);
      setError(friendlyError(e, "Could not load partners."));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn, ok) => {
    setBusy(key);
    try {
      await fn();
      await load();
      showToast(ok);
    } catch (e) {
      showToast(friendlyError(e), "error");
    } finally {
      setBusy("");
    }
  };

  const counts = useMemo(() => {
    const c = { "": rows?.length ?? 0, pending: 0, approved: 0, suspended: 0, premium: 0 };
    for (const r of rows ?? []) { c[r.status] += 1; if (r.premium_until) c.premium += 1; }
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (filter === "premium" ? !r.premium_until : filter && r.status !== filter) return false;
      return !needle || [r.name, r.phone, r.email, r.agency].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, filter, q]);

  const partnerUrl = "https://partners.moveazy.co.in";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "12px", borderBottom: `1px solid ${C.line}`, background: C.surface, flex: "none", display: "grid", gap: 10 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: canManage ? "pointer" : "default" }}>
          <input
            type="checkbox"
            style={{ width: 16, height: 16, marginTop: 2 }}
            checked={settings?.auto_approve ?? true}
            disabled={!canManage || !settings || busy === "auto"}
            onChange={(e) => {
              const on = e.target.checked;
              act("auto", () => adminSetAutoApprove(on), on ? "New partners are approved automatically" : "New partners now wait for approval");
            }}
          />
          <span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Automatic approval</span>
            <span className="crm-mute" style={{ display: "block", fontSize: 11.5, lineHeight: 1.5 }}>
              Ticked: a broker is let in as soon as they sign in with Google and verify their mobile. Unticked: they
              see a pending screen until someone here approves them.
              {settings?.updated_by ? ` Last changed by ${settings.updated_by} on ${shortDate(settings.updated_at)}.` : ""}
              {!canManage && " You need the partners.manage permission to change this."}
            </span>
          </span>
        </label>
        <span className="crm-mute" style={{ fontSize: 11.5 }}>
          Partner app: <a href={partnerUrl} target="_blank" rel="noreferrer" style={{ color: C.accent }}>{partnerUrl.replace("https://", "")}</a>
          {" "}(also at moveazy.co.in/partners). Premium is granted by hand here until online payment is live.
        </span>
      </div>

      <div style={{ padding: "10px 12px", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
        <input className="crm-input" style={{ maxWidth: 260 }} placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        {[["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["suspended", "Suspended"], ["premium", "Premium"]].map(([k, label]) => (
          <Chip key={k || "all"} on={filter === k} onClick={() => setFilter(k)}>{label} · {counts[k]}</Chip>
        ))}
        <Btn sm onClick={load}>Refresh</Btn>
      </div>

      <div className="crm-scroll" style={{ flex: 1 }}>
        {rows === null ? <Empty>Loading partners…</Empty> : error ? <Empty>{error}</Empty> : shown.length === 0 ? (
          <Empty>{rows.length ? "Nobody matches that." : "No broker has signed up to the partner app yet."}</Empty>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Partner</th><th>Mobile</th><th>Status</th><th>Joined</th><th>Listings</th><th>Groups</th><th>Premium</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.user_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name || "—"}</div>
                    <div className="crm-mute" style={{ fontSize: 11 }}>{[r.agency, r.email].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="crm-num">
                    {r.phone ? <a href={whatsappUrl(r.phone, `Hi ${r.name?.split(" ")[0] || ""}, this is MovEazy about the partner app.`)}
                      target="_blank" rel="noreferrer" style={{ color: C.text }}>{formatForDisplay(r.phone)}</a> : "—"}
                  </td>
                  <td>
                    <span style={{ color: STATUS_TONE[r.status], fontWeight: 700, textTransform: "capitalize" }}>{r.status}</span>
                    {r.approved_by === "auto" && <div className="crm-mute" style={{ fontSize: 10.5 }}>auto-approved</div>}
                  </td>
                  <td className="crm-mute crm-num">{shortDate(r.created_at)}</td>
                  <td className="crm-num">{r.listing_count}</td>
                  <td className="crm-num">{r.group_count}</td>
                  <td className="crm-num">{r.premium_until ? `until ${shortDate(r.premium_until)}` : <span className="crm-mute">—</span>}</td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {r.status !== "approved" && (
                        <Btn sm variant="primary" disabled={!canManage || !!busy}
                          onClick={() => act(r.user_id, () => adminSetStatus(r.user_id, "approved"), `${r.name} approved`)}>
                          {r.status === "suspended" ? "Reinstate" : "Approve"}
                        </Btn>
                      )}
                      {r.status !== "suspended" && (
                        <Btn sm disabled={!canManage || !!busy}
                          onClick={() => window.confirm(`Suspend ${r.name}? They lose access to the partner app immediately.`)
                            && act(r.user_id, () => adminSetStatus(r.user_id, "suspended"), `${r.name} suspended`)}>
                          Suspend
                        </Btn>
                      )}
                      <Btn sm disabled={!canManage || !!busy}
                        onClick={() => act(r.user_id, () => adminGrantPremium(r.user_id, 1), `Premium +1 month for ${r.name}`)}>
                        {r.premium_until ? "+1 month" : "Give Premium"}
                      </Btn>
                      {r.premium_until && (
                        <Btn sm disabled={!canManage || !!busy}
                          onClick={() => window.confirm(`End ${r.name}'s Premium now?`)
                            && act(r.user_id, () => adminGrantPremium(r.user_id, 0), "Premium ended")}>
                          End Premium
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
