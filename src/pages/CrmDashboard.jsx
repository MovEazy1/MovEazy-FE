import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  addCrmTaskData,
  addNotificationData,
  createCrmLeadData,
  getAdminNotificationsData,
  getAllUsersData,
  getConsultantNotificationsData,
  getCrmLeadsForStaff,
  getCrmTasksForStaff,
  markNotificationReadData,
  setCrmTaskCompletedData,
  updateCrmLeadData,
} from "../lib/firestoreStore";
import { isConsultantRole, isCrmElevatedRole, isStaffRole, normalizeStaffRole } from "../lib/accessControl";
import { mapHeadersRowToCrmLead, parsePastedGrid } from "../lib/crmSheetMapping";

const STATUS_OPTIONS = ["new", "contacted", "not_visited", "visited", "follow_up", "won", "lost", "on_hold"];
const VISIT_OPTIONS = ["not_visited", "visited"];

function formatTs(ts) {
  if (ts?.toDate) return ts.toDate().toLocaleString();
  if (ts?.toMillis) return new Date(ts.toMillis()).toLocaleString();
  if (typeof ts === "string") return new Date(ts).toLocaleString();
  return "—";
}

function digitsForWa(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `91${d}`;
  return d;
}

export default function CrmDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("leads");
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [tick, setTick] = useState(0);
  const [savingId, setSavingId] = useState(null);
  const [msg, setMsg] = useState("");

  const isElevated = isCrmElevatedRole(user?.role);
  const isConsultant = isConsultantRole(user?.role);
  const isFullAdmin = user?.role === "admin";

  const [newLead, setNewLead] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    assigneeEmail: "",
    assigneeName: "",
    requirements: "",
    visitStatus: "not_visited",
    status: "new",
    nextFollowUpAt: "",
    budgetMin: "",
    budgetMax: "",
    preferredAreas: "",
    moveTimeline: "",
    sourceChannel: "",
    externalRef: "",
    alternatePhone: "",
    customerCompany: "",
  });

  const [taskDraft, setTaskDraft] = useState({ leadId: "", title: "", dueAt: "", assigneeEmail: "" });
  const [staffAssignees, setStaffAssignees] = useState([]);
  const [importPaste, setImportPaste] = useState("");
  const [importSheetMeta, setImportSheetMeta] = useState("All Leads");
  const [importFileMeta, setImportFileMeta] = useState("Master Data - movEAZY.xlsx");
  const [importAssigneeEmail, setImportAssigneeEmail] = useState("");
  const [importing, setImporting] = useState(false);

  const load = async () => {
    if (!isFirebaseConfigured || !user) return;
    try {
      const [l, t] = await Promise.all([getCrmLeadsForStaff(user), getCrmTasksForStaff(user)]);
      setLeads(l);
      setTasks(t);
      if (isConsultant || normalizeStaffRole(user?.role) === "sub_admin") {
        setNotifs(await getConsultantNotificationsData(user.email));
      } else if (isElevated) {
        setNotifs(await getAdminNotificationsData());
      } else {
        setNotifs([]);
      }
    } catch (e) {
      setMsg(String(e?.message || e || "Load failed"));
    }
  };

  useEffect(() => {
    load();
  }, [user, tick]);

  useEffect(() => {
    if (!isFirebaseConfigured || !isFullAdmin || !user) return;
    (async () => {
      try {
        const all = await getAllUsersData();
        const pick = all.filter((u) => ["sub_admin", "consultant"].includes(normalizeStaffRole(u.role)) && u.email);
        setStaffAssignees(pick);
      } catch {
        setStaffAssignees([]);
      }
    })();
  }, [isFullAdmin, user]);

  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);

  const saveLeadPatch = async (id, patch) => {
    setSavingId(id);
    setMsg("");
    try {
      await updateCrmLeadData(id, patch, user);
      setTick((x) => x + 1);
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setSavingId(null);
    }
  };

  const runSheetImport = async () => {
    if (!isFullAdmin || importing) return;
    const em = importAssigneeEmail.trim().toLowerCase();
    if (!em) {
      setMsg("Choose a default assignee for imported leads.");
      return;
    }
    const grid = parsePastedGrid(importPaste);
    if (grid.length < 2) {
      setMsg("Paste a header row plus at least one data row (tab-separated from Excel).");
      return;
    }
    const headers = grid[0];
    const assigneeRow = staffAssignees.find((s) => String(s.email || "").toLowerCase().trim() === em);
    setImporting(true);
    setMsg("");
    let n = 0;
    try {
      for (let r = 1; r < grid.length; r++) {
        const mapped = mapHeadersRowToCrmLead(headers, grid[r], {
          sheetName: importSheetMeta,
          sourceFile: importFileMeta,
        });
        if (!mapped.customerName && !mapped.customerPhone) continue;
        await createCrmLeadData(
          {
            ...mapped,
            assigneeEmail: em,
            assigneeName: assigneeRow?.name || mapped.assigneeName || "",
            customerEmail: mapped.customerEmail || "",
          },
          user
        );
        n += 1;
      }
      setMsg(`Imported ${n} lead(s).`);
      setImportPaste("");
      setTick((x) => x + 1);
    } catch (err) {
      setMsg(String(err?.message || err));
    } finally {
      setImporting(false);
    }
  };

  const createLead = async (e) => {
    e.preventDefault();
    if (!isElevated) return;
    setMsg("");
    try {
      await createCrmLeadData(newLead, user);
      setNewLead({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        assigneeEmail: "",
        assigneeName: "",
        requirements: "",
        visitStatus: "not_visited",
        status: "new",
        nextFollowUpAt: "",
        budgetMin: "",
        budgetMax: "",
        preferredAreas: "",
        moveTimeline: "",
        sourceChannel: "",
        externalRef: "",
        alternatePhone: "",
        customerCompany: "",
      });
      setTick((x) => x + 1);
      setMsg("Lead created.");
    } catch (err) {
      setMsg(String(err?.message || err));
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!isElevated) return;
    if (!taskDraft.leadId || !taskDraft.assigneeEmail) {
      setMsg("Pick a lead and assignee email for the task.");
      return;
    }
    setMsg("");
    try {
      const due = taskDraft.dueAt ? new Date(taskDraft.dueAt) : null;
      await addCrmTaskData(
        {
          leadId: taskDraft.leadId,
          title: taskDraft.title || "Follow up call",
          dueAt: due,
          assigneeEmail: taskDraft.assigneeEmail,
        },
        user
      );
      const assignee = taskDraft.assigneeEmail.trim().toLowerCase();
      const taskTitle = taskDraft.title || "Follow up";
      await addNotificationData({
        audience: "consultant",
        targetEmail: assignee,
        title: "CRM follow-up task",
        body: `New task: ${taskTitle} (lead #${taskDraft.leadId.slice(0, 8)}…).`,
        type: "crm_task",
        meta: { leadId: taskDraft.leadId, taskTitle },
      });
      await addNotificationData({
        audience: "admin",
        targetEmail: "",
        title: "CRM follow-up scheduled",
        body: `${assignee} · ${taskTitle} · lead #${taskDraft.leadId.slice(0, 8)}…`,
        type: "crm_task",
        meta: { leadId: taskDraft.leadId, taskTitle, assigneeEmail: assignee },
      });
      setTaskDraft({ leadId: "", title: "", dueAt: "", assigneeEmail: "" });
      setTick((x) => x + 1);
      setMsg("Task added and consultant notified in-app.");
    } catch (err) {
      setMsg(String(err?.message || err));
    }
  };

  const toggleTask = async (task) => {
    try {
      await setCrmTaskCompletedData(task.id, !task.completed, user);
      setTick((x) => x + 1);
    } catch (e) {
      setMsg(String(e?.message || e));
    }
  };

  const markRead = async (n) => {
    try {
      await markNotificationReadData(n.id);
      setTick((x) => x + 1);
    } catch (e) {
      setMsg(String(e?.message || e));
    }
  };

  if (!user || !isStaffRole(user?.role)) {
    return (
      <PageShell variant="marketing" overlayOnly className="bg-slate-100">
        <div style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "#64748b" }}>This area is for staff only.</p>
          <button type="button" onClick={() => navigate("/login")} style={{ marginTop: 16, padding: "10px 20px", fontWeight: 700 }}>
            Sign in
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell variant="marketing" overlayOnly className="bg-slate-100 min-h-screen">
      <div style={{ background: "#000", color: "#e5e5e5", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          Mov<span style={{ color: "#ff3131" }}>EAZY</span> · Staff CRM
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {isFullAdmin ? (
            <button type="button" onClick={() => navigate("/admin")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #52525b", background: "#262626", color: "#fafafa", fontWeight: 700, fontSize: 12 }}>
              Admin
            </button>
          ) : null}
          <button type="button" onClick={() => navigate("/map")} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #52525b", background: "#262626", color: "#fafafa", fontWeight: 700, fontSize: 12 }}>
            Map
          </button>
          <button type="button" onClick={() => { logout(); navigate("/login"); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #991b1b", background: "#450a0a", color: "#fecaca", fontWeight: 700, fontSize: 12 }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 48px" }}>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
          Track customers, visit status, requirements, and consultant follow-ups. Alerts use the in-app notification feed; use{" "}
          <strong>WhatsApp</strong> for instant pings (opens wa.me with a prefilled message). Customers never see this page — deploy latest{" "}
          <strong>Firestore rules</strong> so `crmLeads` / `crmTasks` stay staff-only.
        </p>

        {msg ? (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#fef9c3", color: "#854d0e", fontSize: 13 }}>{msg}</div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            ["leads", `Leads (${leads.length})`],
            ["tasks", `Follow-ups (${openTasks.length} open)`],
            ...(isConsultant || isElevated ? [["alerts", `Alerts (${notifs.filter((n) => !n.read).length} unread)`]] : []),
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${tab === id ? "#1e3a8a" : "#cbd5e1"}`,
                background: tab === id ? "#1e3a8a" : "#fff",
                color: tab === id ? "#fff" : "#334155",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "leads" && isElevated ? (
          <form onSubmit={createLead} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 20, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <div style={{ gridColumn: "1 / -1", fontWeight: 800, color: "#0f172a" }}>Add lead (admin / sub-admin)</div>
            <input required placeholder="Customer name" value={newLead.customerName} onChange={(e) => setNewLead((p) => ({ ...p, customerName: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input required type="email" placeholder="Customer email" value={newLead.customerEmail} onChange={(e) => setNewLead((p) => ({ ...p, customerEmail: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Customer phone" value={newLead.customerPhone} onChange={(e) => setNewLead((p) => ({ ...p, customerPhone: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Alt. phone" value={newLead.alternatePhone} onChange={(e) => setNewLead((p) => ({ ...p, alternatePhone: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Company / org" value={newLead.customerCompany} onChange={(e) => setNewLead((p) => ({ ...p, customerCompany: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            {isFullAdmin && staffAssignees.length ? (
              <select
                required
                value={newLead.assigneeEmail}
                onChange={(e) => {
                  const em = e.target.value.toLowerCase().trim();
                  const row = staffAssignees.find((s) => String(s.email || "").toLowerCase().trim() === em);
                  setNewLead((p) => ({ ...p, assigneeEmail: em, assigneeName: row?.name || "" }));
                }}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
              >
                <option value="">Assign to staff…</option>
                {staffAssignees.map((s) => (
                  <option key={s.uid} value={String(s.email || "").toLowerCase()}>
                    {(s.name || s.email) + ` (${normalizeStaffRole(s.role)})`}
                  </option>
                ))}
              </select>
            ) : (
              <input required type="email" placeholder="Assignee email (sub-admin / consultant)" value={newLead.assigneeEmail} onChange={(e) => setNewLead((p) => ({ ...p, assigneeEmail: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            )}
            <input placeholder="Assignee display name (optional if picked from list)" value={newLead.assigneeName} onChange={(e) => setNewLead((p) => ({ ...p, assigneeName: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Budget min (₹)" inputMode="numeric" value={newLead.budgetMin} onChange={(e) => setNewLead((p) => ({ ...p, budgetMin: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Budget max (₹)" inputMode="numeric" value={newLead.budgetMax} onChange={(e) => setNewLead((p) => ({ ...p, budgetMax: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Preferred areas" value={newLead.preferredAreas} onChange={(e) => setNewLead((p) => ({ ...p, preferredAreas: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Move timeline (e.g. 30 days)" value={newLead.moveTimeline} onChange={(e) => setNewLead((p) => ({ ...p, moveTimeline: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="Source (Base44, walk-in, referral…)" value={newLead.sourceChannel} onChange={(e) => setNewLead((p) => ({ ...p, sourceChannel: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <input placeholder="External ref / Base44 id" value={newLead.externalRef} onChange={(e) => setNewLead((p) => ({ ...p, externalRef: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <select value={newLead.visitStatus} onChange={(e) => setNewLead((p) => ({ ...p, visitStatus: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}>
              {VISIT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v === "not_visited" ? "Not visited" : "Visited"}
                </option>
              ))}
            </select>
            <select value={newLead.status} onChange={(e) => setNewLead((p) => ({ ...p, status: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}>
              {STATUS_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input type="datetime-local" value={newLead.nextFollowUpAt} onChange={(e) => setNewLead((p) => ({ ...p, nextFollowUpAt: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <textarea placeholder="Requirements (BHK, budget, area…)" value={newLead.requirements} onChange={(e) => setNewLead((p) => ({ ...p, requirements: e.target.value }))} style={{ gridColumn: "1 / -1", minHeight: 72, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
            <button type="submit" style={{ gridColumn: "1 / -1", padding: "10px 16px", borderRadius: 10, background: "#16a34a", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}>
              Save lead
            </button>
          </form>
        ) : null}

        {tab === "leads" && isFullAdmin ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Bulk import (Excel copy → paste)</div>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10, lineHeight: 1.45 }}>
              Copy rows from <strong>Kuldeep Ops</strong> or <strong>Master Data</strong> (include the header row). Headers are mapped in code; unknown columns go to{" "}
              <code style={{ fontSize: 12 }}>extraFields</code>. Each imported row needs a staff assignee.
            </p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", marginBottom: 10 }}>
              <input placeholder="Sheet name (e.g. All Leads)" value={importSheetMeta} onChange={(e) => setImportSheetMeta(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              <input placeholder="Source file label" value={importFileMeta} onChange={(e) => setImportFileMeta(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              {staffAssignees.length ? (
                <select
                  required
                  value={importAssigneeEmail}
                  onChange={(e) => setImportAssigneeEmail(e.target.value.toLowerCase().trim())}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                >
                  <option value="">Default assignee…</option>
                  {staffAssignees.map((s) => (
                    <option key={s.uid} value={String(s.email || "").toLowerCase()}>
                      {(s.name || s.email) + ` (${normalizeStaffRole(s.role)})`}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="email" placeholder="Default assignee email" value={importAssigneeEmail} onChange={(e) => setImportAssigneeEmail(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
              )}
            </div>
            <textarea
              value={importPaste}
              onChange={(e) => setImportPaste(e.target.value)}
              placeholder="Paste TSV from Excel (header row + data)…"
              rows={8}
              style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 10 }}
            />
            <button
              type="button"
              disabled={importing}
              onClick={runSheetImport}
              style={{ padding: "10px 16px", borderRadius: 10, background: "#7c3aed", color: "#fff", fontWeight: 800, border: "none", cursor: importing ? "wait" : "pointer" }}
            >
              {importing ? "Importing…" : "Import pasted rows"}
            </button>
          </div>
        ) : null}

        {tab === "leads" ? (
          <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#f8fafc", color: "#64748b" }}>
                  <th style={{ padding: 10 }}>Customer</th>
                  <th style={{ padding: 10 }}>Assignee</th>
                  <th style={{ padding: 10 }}>Visit</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>Next follow-up</th>
                  <th style={{ padding: 10 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((row) => (
                  <LeadRow
                    key={row.id}
                    row={row}
                    isElevated={isElevated}
                    isFullAdmin={isFullAdmin}
                    staffAssignees={staffAssignees}
                    savingId={savingId}
                    onPatch={saveLeadPatch}
                  />
                ))}
              </tbody>
            </table>
            {leads.length === 0 ? (
              <div style={{ padding: 24, color: "#64748b", textAlign: "center" }}>
                {isElevated ? "No leads yet — add one above, or assign an existing lead to this account." : "No leads assigned to you yet."}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "tasks" ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
            {isElevated ? (
              <form onSubmit={addTask} style={{ display: "grid", gap: 10, marginBottom: 20, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                <div style={{ gridColumn: "1 / -1", fontWeight: 800 }}>Schedule follow-up (admin / sub-admin)</div>
                <select required value={taskDraft.leadId} onChange={(e) => setTaskDraft((p) => ({ ...p, leadId: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}>
                  <option value="">Select lead…</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.customerName} — {l.customerEmail}
                    </option>
                  ))}
                </select>
                <input placeholder="Task title" value={taskDraft.title} onChange={(e) => setTaskDraft((p) => ({ ...p, title: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                <input type="datetime-local" value={taskDraft.dueAt} onChange={(e) => setTaskDraft((p) => ({ ...p, dueAt: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                {isFullAdmin && staffAssignees.length ? (
                  <select
                    required
                    value={taskDraft.assigneeEmail}
                    onChange={(e) => setTaskDraft((p) => ({ ...p, assigneeEmail: e.target.value.toLowerCase().trim() }))}
                    style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="">Assign task to…</option>
                    {staffAssignees.map((s) => (
                      <option key={s.uid} value={String(s.email || "").toLowerCase()}>
                        {(s.name || s.email) + ` (${normalizeStaffRole(s.role)})`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input required type="email" placeholder="Assignee email" value={taskDraft.assigneeEmail} onChange={(e) => setTaskDraft((p) => ({ ...p, assigneeEmail: e.target.value }))} style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }} />
                )}
                <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, background: "#1e3a8a", color: "#fff", fontWeight: 800, border: "none", cursor: "pointer" }}>
                  Add task + notify
                </button>
              </form>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tasks.map((t) => (
                <div key={t.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", opacity: t.completed ? 0.65 : 1 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Lead: {t.leadId?.slice(0, 8)}… · Due: {formatTs(t.dueAt)} · Assignee: {t.assigneeEmail}
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, cursor: "pointer" }}>
                    <input type="checkbox" checked={Boolean(t.completed)} onChange={() => toggleTask(t)} />
                    Done
                  </label>
                </div>
              ))}
              {tasks.length === 0 ? <div style={{ color: "#64748b" }}>No tasks.</div> : null}
            </div>
          </div>
        ) : null}

        {tab === "alerts" && (isConsultant || isElevated) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notifs.map((n) => (
              <div key={n.id} style={{ border: n.read ? "1px solid #e2e8f0" : "2px solid #2563eb", borderRadius: 12, padding: 14, background: "#fff" }}>
                <div style={{ fontWeight: 800 }}>{n.title}</div>
                <div style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>{n.body}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{formatTs(n.createdAt)}</div>
                {!n.read ? (
                  <button type="button" onClick={() => markRead(n)} style={{ marginTop: 10, padding: "6px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer" }}>
                    Mark done (read)
                  </button>
                ) : null}
              </div>
            ))}
            {notifs.length === 0 ? <div style={{ color: "#64748b" }}>No alerts.</div> : null}
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function stringifyExtraFields(obj) {
  try {
    const o = obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    return JSON.stringify(o, null, 2);
  } catch {
    return "{}";
  }
}

function toDatetimeLocalValue(ts) {
  let d = null;
  if (ts?.toDate) d = ts.toDate();
  else if (typeof ts?.seconds === "number") d = new Date(ts.seconds * 1000);
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function LeadRow({ row, isElevated, isFullAdmin, staffAssignees = [], savingId, onPatch }) {
  const [visitStatus, setVisitStatus] = useState(row.visitStatus || "not_visited");
  const [status, setStatus] = useState(row.status || "new");
  const [requirements, setRequirements] = useState(row.requirements || "");
  const [consultantNotes, setConsultantNotes] = useState(row.consultantNotes || "");
  const [adminNotes, setAdminNotes] = useState(row.adminNotes || "");
  const [listingTitle, setListingTitle] = useState(row.listingVisitedTitle || "");
  const [nextFollowUp, setNextFollowUp] = useState(() => toDatetimeLocalValue(row.nextFollowUpAt));
  const [assigneeEmail, setAssigneeEmail] = useState(String(row.assigneeEmail || "").toLowerCase().trim());
  const [assigneeName, setAssigneeName] = useState(row.assigneeName || "");
  const [budgetMin, setBudgetMin] = useState(row.budgetMin != null && row.budgetMin !== "" ? String(row.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState(row.budgetMax != null && row.budgetMax !== "" ? String(row.budgetMax) : "");
  const [preferredAreas, setPreferredAreas] = useState(row.preferredAreas || "");
  const [moveTimeline, setMoveTimeline] = useState(row.moveTimeline || "");
  const [sourceChannel, setSourceChannel] = useState(row.sourceChannel || "");
  const [externalRef, setExternalRef] = useState(row.externalRef || "");
  const [alternatePhone, setAlternatePhone] = useState(row.alternatePhone || "");
  const [customerCompany, setCustomerCompany] = useState(row.customerCompany || "");
  const [extraFieldsJson, setExtraFieldsJson] = useState(() => stringifyExtraFields(row.extraFields));

  useEffect(() => {
    setVisitStatus(row.visitStatus || "not_visited");
    setStatus(row.status || "new");
    setRequirements(row.requirements || "");
    setConsultantNotes(row.consultantNotes || "");
    setAdminNotes(row.adminNotes || "");
    setListingTitle(row.listingVisitedTitle || "");
    setNextFollowUp(toDatetimeLocalValue(row.nextFollowUpAt));
    setAssigneeEmail(String(row.assigneeEmail || "").toLowerCase().trim());
    setAssigneeName(row.assigneeName || "");
    setBudgetMin(row.budgetMin != null && row.budgetMin !== "" ? String(row.budgetMin) : "");
    setBudgetMax(row.budgetMax != null && row.budgetMax !== "" ? String(row.budgetMax) : "");
    setPreferredAreas(row.preferredAreas || "");
    setMoveTimeline(row.moveTimeline || "");
    setSourceChannel(row.sourceChannel || "");
    setExternalRef(row.externalRef || "");
    setAlternatePhone(row.alternatePhone || "");
    setCustomerCompany(row.customerCompany || "");
    setExtraFieldsJson(stringifyExtraFields(row.extraFields));
  }, [row]);

  const wa = digitsForWa(row.customerPhone);
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${row.customerName || "there"}, this is MovEazy follow-up regarding your home search.`)}`
    : "";

  return (
    <Fragment>
    <tr style={{ borderTop: "1px solid #f1f5f9", verticalAlign: "top" }}>
      <td style={{ padding: 10 }}>
        <div style={{ fontWeight: 700 }}>{row.customerName}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{row.customerEmail}</div>
        <div style={{ fontSize: 12 }}>{row.customerPhone || "—"}</div>
        {alternatePhone ? <div style={{ fontSize: 11, color: "#64748b" }}>Alt: {alternatePhone}</div> : null}
        {customerCompany ? <div style={{ fontSize: 11, color: "#64748b" }}>{customerCompany}</div> : null}
      </td>
      <td style={{ padding: 10, fontSize: 12 }}>
        {isFullAdmin && staffAssignees.length ? (
          <select
            value={assigneeEmail}
            onChange={(e) => {
              const em = e.target.value.toLowerCase().trim();
              const found = staffAssignees.find((s) => String(s.email || "").toLowerCase().trim() === em);
              setAssigneeEmail(em);
              if (found?.name) setAssigneeName(found.name);
            }}
            style={{ width: "100%", marginBottom: 8, padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            {assigneeEmail &&
            !staffAssignees.some((s) => String(s.email || "").toLowerCase().trim() === assigneeEmail) ? (
              <option value={assigneeEmail}>Current: {assigneeEmail}</option>
            ) : null}
            {staffAssignees.map((s) => (
              <option key={s.uid} value={String(s.email || "").toLowerCase()}>
                {(s.name || s.email) + ` (${normalizeStaffRole(s.role)})`}
              </option>
            ))}
          </select>
        ) : (
          <>
            <div style={{ fontWeight: 600 }}>{assigneeName || row.assigneeName || "—"}</div>
            <div style={{ wordBreak: "break-all", color: "#64748b" }}>{assigneeEmail || row.assigneeEmail || "—"}</div>
          </>
        )}
        {isFullAdmin ? (
          <input
            value={assigneeName}
            onChange={(e) => setAssigneeName(e.target.value)}
            placeholder="Display name override"
            style={{ width: "100%", marginTop: 8, padding: 6, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 }}
          />
        ) : null}
      </td>
      <td style={{ padding: 10 }}>
        <select value={visitStatus} onChange={(e) => setVisitStatus(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}>
          {VISIT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v === "not_visited" ? "Not visited" : "Visited"}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: 10 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}>
          {STATUS_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: 10 }}>
        <input type="datetime-local" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }} />
      </td>
      <td style={{ padding: 10, minWidth: 140 }}>
        <button
          type="button"
          disabled={savingId === row.id}
          onClick={() => {
            const bm = budgetMin.trim() === "" ? null : Number(budgetMin);
            const bx = budgetMax.trim() === "" ? null : Number(budgetMax);
            /** @type {Record<string, unknown>} */
            const patch = {
              visitStatus,
              status,
              requirements,
              consultantNotes,
              adminNotes: isElevated ? adminNotes : undefined,
              listingVisitedTitle: listingTitle,
              nextFollowUpAt: nextFollowUp ? new Date(nextFollowUp) : null,
              budgetMin: Number.isFinite(bm) && bm > 0 ? bm : null,
              budgetMax: Number.isFinite(bx) && bx > 0 ? bx : null,
              preferredAreas,
              moveTimeline,
              sourceChannel,
              externalRef,
              alternatePhone,
              customerCompany,
              ...(isFullAdmin && assigneeEmail
                ? { assigneeEmail: assigneeEmail.toLowerCase().trim(), assigneeName: assigneeName.trim() }
                : {}),
            };
            if (isElevated) {
              try {
                const parsed = JSON.parse(extraFieldsJson);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) patch.extraFields = parsed;
              } catch {
                /* keep previous extraFields */
              }
            }
            onPatch(row.id, patch);
          }}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1e3a8a", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", marginBottom: 6 }}
        >
          Save row
        </button>
        {waHref ? (
          <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "8px 10px", borderRadius: 8, background: "#22c55e", color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
            WhatsApp
          </a>
        ) : (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Add phone for WhatsApp</span>
        )}
      </td>
    </tr>
    <tr style={{ background: "#fafafa", borderTop: "1px solid #f1f5f9" }}>
      <td colSpan={6} style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Requirements &amp; notes</div>
        <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Customer requirements (BHK, budget, localities…)" rows={2} style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
        <textarea value={consultantNotes} onChange={(e) => setConsultantNotes(e.target.value)} placeholder="Consultant follow-up notes" rows={2} style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
        {isElevated ? (
          <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Admin-only notes" rows={2} style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid #fecaca", fontSize: 13 }} />
        ) : null}
        <input value={listingTitle} onChange={(e) => setListingTitle(e.target.value)} placeholder="Property visited (title)" style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
      </td>
    </tr>
    <tr style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
      <td colSpan={6} style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Budget, areas &amp; import IDs (Base44 / sheets)</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="Budget min ₹" inputMode="numeric" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="Budget max ₹" inputMode="numeric" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <input value={moveTimeline} onChange={(e) => setMoveTimeline(e.target.value)} placeholder="Move timeline" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <input value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)} placeholder="Source channel" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="External / Base44 ref" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <input value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} placeholder="Alternate phone" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
          <input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="Company" style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
        </div>
        <textarea value={preferredAreas} onChange={(e) => setPreferredAreas(e.target.value)} placeholder="Preferred areas (comma-separated or free text)" rows={2} style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }} />
      </td>
    </tr>
    <tr style={{ background: "#faf5ff", borderTop: "1px solid #e9d5ff" }}>
      <td colSpan={6} style={{ padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#5b21b6", marginBottom: 6 }}>extraFields (imported / legacy columns)</div>
        {isElevated ? (
          <textarea
            value={extraFieldsJson}
            onChange={(e) => setExtraFieldsJson(e.target.value)}
            rows={6}
            spellCheck={false}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: 8, borderRadius: 8, border: "1px solid #c4b5fd", background: "#fff" }}
          />
        ) : (
          <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#475569" }}>{extraFieldsJson}</pre>
        )}
      </td>
    </tr>
    </Fragment>
  );
}
