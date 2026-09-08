/**
 * Money owed on deals we closed.
 *
 * Two roles meet on this screen. Anyone with CRM access records the brokerage,
 * the date it's expected, and — when it lands — that payment was received. Only
 * the super admin approves, and approval is the end of the line: the row stops
 * moving after that, for everyone.
 *
 * Both transitions call Postgres functions rather than updating the row, so the
 * rule holds even for someone talking to the database directly.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import {
  approvePayment, fetchNotifications, markNotificationRead, markPaymentReceived,
  paymentLabel, saveBrokerage, summarisePayments,
} from "../../lib/crmPayments";
import { isSuperAdminEmail } from "../../lib/adminScopes";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, Toast, inr, relTime, shortDate } from "./crmUi";

function Stat({ label, value, tone }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.surface, padding: "12px 14px", minWidth: 150 }}>
      <div className="crm-label">{label}</div>
      <div className="crm-num" style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: tone || C.text }}>
        {value}
      </div>
    </div>
  );
}

/** Editable brokerage cell — saves on blur, like the rest of the CRM. */
function MoneyCell({ client, canEdit, onSaved, onToast }) {
  const [amount, setAmount] = useState(client.brokerage_amount ?? "");
  const [date, setDate] = useState(client.expected_credit_date ?? "");
  const locked = client.payment_status === "approved";

  useEffect(() => {
    setAmount(client.brokerage_amount ?? "");
    setDate(client.expected_credit_date ?? "");
  }, [client.brokerage_amount, client.expected_credit_date]);

  const commit = async () => {
    const next = { brokerage_amount: amount === "" ? null : Number(amount), expected_credit_date: date || null };
    if (
      (next.brokerage_amount ?? null) === (client.brokerage_amount ?? null) &&
      (next.expected_credit_date ?? null) === (client.expected_credit_date ?? null)
    ) return;
    try {
      onSaved(await saveBrokerage(client.id, next));
    } catch (e) {
      onToast(e?.message || "Could not save", "error");
    }
  };

  if (!canEdit || locked) {
    return (
      <span className="crm-num">
        {inr(client.brokerage_amount)}
        {client.expected_credit_date ? ` · ${shortDate(client.expected_credit_date)}` : ""}
      </span>
    );
  }

  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        className="crm-input crm-num" type="number" inputMode="numeric" placeholder="Brokerage"
        value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={commit}
        style={{ width: 110 }}
      />
      <input
        className="crm-input" type="date" value={date}
        onChange={(e) => setDate(e.target.value)} onBlur={commit}
        style={{ width: 140 }}
        title="Expected credit date"
      />
    </span>
  );
}

export default function CrmPaymentsPage() {
  const crm = useCrm();
  const { clients, access } = crm;
  const navigate = useNavigate();

  const [filter, setFilter] = useState("all");
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);

  const isSuper = isSuperAdminEmail(access.email);
  const canEdit = access.has(SCOPES.CLIENTS_WRITE);
  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2800);
  };

  const loadNotes = useCallback(() => {
    fetchNotifications({ unreadOnly: true }).then(setNotes);
  }, []);
  useEffect(loadNotes, [loadNotes]);

  const closed = useMemo(
    () => clients.filter((c) => c.status === "closed_by_us"),
    [clients],
  );
  const summary = useMemo(() => summarisePayments(closed), [closed]);

  const rows = useMemo(() => {
    const list = filter === "all" ? closed : closed.filter((c) => c.payment_status === filter);
    return [...list].sort((a, b) => {
      const ad = a.expected_credit_date || "9999";
      const bd = b.expected_credit_date || "9999";
      return ad.localeCompare(bd);
    });
  }, [closed, filter]);

  const act = async (client, fn, okMessage) => {
    setBusy(client.id);
    try {
      await fn();
      await crm.reload();
      loadNotes();
      showToast(okMessage);
    } catch (e) {
      showToast(e?.message || "That didn't work", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>Closed by us — payments</h1>
          <p style={{ color: C.textDim, fontSize: 13.5, margin: 0, maxWidth: "66ch", lineHeight: 1.6 }}>
            Every deal we closed, what MovEazy is owed on it, and where that money has got to.
            {isSuper
              ? " You're the only one who can approve, and approval is final."
              : " Marking payment received sends it to the super admin to approve."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Stat label="Awaiting" value={inr(summary.awaitedTotal)} />
          <Stat label="Received, unapproved" value={inr(summary.receivedTotal)} tone={C.gold} />
          <Stat label="Approved" value={inr(summary.approvedTotal)} tone={C.accent} />
          <Stat
            label="Overdue"
            value={summary.overdue.length ? `${summary.overdue.length} deal${summary.overdue.length === 1 ? "" : "s"}` : "None"}
            tone={summary.overdue.length ? C.coral : undefined}
          />
        </div>

        {isSuper && notes.length > 0 && (
          <div className="crm-card" style={{ borderColor: C.gold, background: "#FBF3E4" }}>
            <span className="crm-label" style={{ color: C.gold }}>
              Waiting on you · {notes.length}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
              {notes.slice(0, 8).map((n) => (
                <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, color: C.text }}>{n.title}</span>
                  <span className="crm-mute" style={{ fontSize: 11.5 }}>{n.body}</span>
                  <span className="crm-mute" style={{ fontSize: 11 }}>· {relTime(n.created_at)}</span>
                  <Btn sm onClick={() => markNotificationRead(n.id).then(loadNotes)}>Dismiss</Btn>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip on={filter === "all"} onClick={() => setFilter("all")}>All · {closed.length}</Chip>
          <Chip on={filter === "awaited"} onClick={() => setFilter("awaited")}>Awaiting · {summary.awaited.length}</Chip>
          <Chip on={filter === "received"} onClick={() => setFilter("received")}>Received · {summary.received.length}</Chip>
          <Chip on={filter === "approved"} onClick={() => setFilter("approved")}>Approved · {summary.approved.length}</Chip>
        </div>

        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
          {rows.length === 0 ? (
            <Empty>
              Nothing here yet. A client moves onto this list the moment their status becomes
              “Closed by us”.
            </Empty>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Client</th><th>Property</th><th>Rent</th>
                    <th>MovEazy brokerage · expected</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const overdue =
                      c.payment_status === "awaited" &&
                      c.expected_credit_date &&
                      new Date(c.expected_credit_date) < new Date();
                    return (
                      <tr key={c.id}>
                        <td>
                          <button type="button" onClick={() => navigate(`/crm/clients?client=${c.id}`)}
                            style={{ color: C.text, fontWeight: 600, textAlign: "left" }}>
                            {c.name || c.email || "Unnamed"}
                          </button>
                        </td>
                        <td className="crm-num" style={{ color: C.accent }}>{c.closed_property_id || "—"}</td>
                        <td className="crm-num">{inr(c.closed_rent)}</td>
                        <td>
                          <MoneyCell client={c} canEdit={canEdit} onSaved={crm.patchClient} onToast={showToast} />
                          {overdue && (
                            <span style={{ color: C.coral, fontSize: 11, marginLeft: 8 }}>overdue</span>
                          )}
                        </td>
                        <td>
                          <span style={{
                            color: c.payment_status === "approved" ? C.accent
                              : c.payment_status === "received" ? C.gold : C.textMute,
                            fontWeight: 600, fontSize: 12,
                          }}>
                            {paymentLabel(c.payment_status)}
                          </span>
                          {c.payment_marked_by && (
                            <div className="crm-mute" style={{ fontSize: 10.5 }}>
                              by {c.payment_marked_by} · {relTime(c.payment_marked_at)}
                            </div>
                          )}
                          {c.payment_approved_by && (
                            <div className="crm-mute" style={{ fontSize: 10.5 }}>
                              approved {relTime(c.payment_approved_at)}
                            </div>
                          )}
                        </td>
                        <td>
                          {c.payment_status === "awaited" && canEdit && (
                            <Btn sm disabled={busy === c.id}
                              onClick={() => act(c, () => markPaymentReceived(c.id), "Sent for approval")}>
                              Payment received
                            </Btn>
                          )}
                          {c.payment_status === "received" && (
                            isSuper ? (
                              <Btn sm variant="primary" disabled={busy === c.id}
                                onClick={() => act(c, () => approvePayment(c.id), "Approved")}>
                                Approve
                              </Btn>
                            ) : (
                              <span className="crm-mute" style={{ fontSize: 11 }}>with the super admin</span>
                            )
                          )}
                          {c.payment_status === "approved" && (
                            <span style={{ color: C.accent, fontSize: 11, fontWeight: 600 }}>✓ settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="crm-mute" style={{ fontSize: 11.5, margin: 0, lineHeight: 1.55, maxWidth: "70ch" }}>
          Approval is enforced in the database, not just hidden here — the function behind it refuses
          anyone but the super admin, and nothing moves a deal out of approved.
        </p>
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
