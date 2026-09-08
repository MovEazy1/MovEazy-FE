/**
 * The board. Same statuses as the record header, laid out as columns.
 *
 * Drag to move; every move writes an activity row, and closing asks for the
 * detail that makes the outcome worth recording. Cards show the two things that
 * decide whether you touch someone today: how engaged they are, and how long
 * since anyone did.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import {
  CLOSED_STATUSES, STATUSES, setClientStatus, tempColor,
} from "../../lib/crmClients";
import { SCOPES } from "../../lib/adminScopes";
import { formatDuration } from "../../lib/sessionSync";
import { Btn, C, Chip, Empty, Toast, inr, relTime, shortDate } from "./crmUi";

function Card({ client, requirement, engagement, lastTouch, canWrite, onOpen, onDragStart }) {
  return (
    <div
      draggable={canWrite}
      onDragStart={(e) => onDragStart(e, client)}
      onClick={() => onOpen(client)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(client)}
      style={{
        background: C.surface, border: `1px solid ${C.line}`, borderRadius: 9, padding: 9,
        display: "flex", flexDirection: "column", gap: 5, cursor: canWrite ? "grab" : "pointer",
      }}
    >
      <span style={{
        height: 2, borderRadius: 2, flex: "none",
        background: client.temperature ? tempColor(client.temperature) : C.line,
      }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
        {client.name || client.email || "Unnamed"}
      </span>
      <span className="crm-mute crm-num" style={{ fontSize: 10.5 }}>
        {(requirement?.localities ?? []).slice(0, 2).join(", ") || "no area"}
        {requirement?.budget_max ? ` · ₹${Math.round(requirement.budget_max / 1000)}k` : ""}
      </span>
      <span className="crm-mute crm-num" style={{ fontSize: 10.5 }}>
        {engagement ? `${engagement.session_count} opens · ${formatDuration(engagement.total_seconds)}` : "no visits yet"}
        {requirement?.move_in ? ` · moves ${shortDate(requirement.move_in) === "—" ? requirement.move_in : shortDate(requirement.move_in)}` : ""}
      </span>
      <span className="crm-mute" style={{ fontSize: 10.5 }}>
        {client.status === "dnp" && client.dnp_count > 0 ? `DNP ×${client.dnp_count} · ` : ""}
        touched {relTime(lastTouch ?? client.created_at)}
      </span>
      {CLOSED_STATUSES.includes(client.status) && (
        <span className="crm-mute crm-num" style={{ fontSize: 10.5 }}>
          {client.closed_reason || client.closed_property_id || ""}
          {client.closed_rent ? ` · ${inr(client.closed_rent)}` : ""}
        </span>
      )}
    </div>
  );
}

export default function CrmPipelinePage() {
  const crm = useCrm();
  const { clients, requirements, engagement, touches, access } = crm;
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const canWrite = access.has(SCOPES.CLIENTS_WRITE);
  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const reqByClient = useMemo(() => new Map(requirements.map((r) => [r.client_id, r])), [requirements]);
  const engByUser = useMemo(() => new Map(engagement.map((e) => [e.user_id, e])), [engagement]);
  const lastTouch = useMemo(() => {
    const m = new Map();
    for (const t of touches) if (!m.has(t.client_id)) m.set(t.client_id, t.created_at);
    return m;
  }, [touches]);

  const rows = useMemo(
    () => (mineOnly
      ? clients.filter((c) => (c.assigned_to || "").toLowerCase() === access.email.toLowerCase())
      : clients),
    [clients, mineOnly, access.email],
  );

  const byStatus = useMemo(() => {
    const m = new Map(STATUSES.map((s) => [s.id, []]));
    for (const c of rows) (m.get(c.status) ?? m.get("fresh")).push(c);
    return m;
  }, [rows]);

  const move = useCallback(
    async (client, status) => {
      if (client.status === status) return;
      // Closing needs a reason or a property, and that belongs on the record
      // where the prompt lives — dropping a card can't capture it.
      if (CLOSED_STATUSES.includes(status)) {
        navigate(`/crm/clients?client=${client.id}`);
        showToast("Closing needs a reason — finish it on the record");
        return;
      }
      try {
        crm.patchClient(await setClientStatus(client, status, { actorEmail: access.email }));
      } catch (e) {
        showToast(e?.message || "Could not move the card", "error");
      }
    },
    [crm, access.email, navigate],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">Pipeline · {rows.length} clients</span>
        <Chip on={mineOnly} onClick={() => setMineOnly((v) => !v)}>Mine</Chip>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${STATUSES.length}, 190px)`, gap: 10, minWidth: "max-content" }}>
          {STATUSES.map((s) => {
            const list = byStatus.get(s.id) ?? [];
            const isWin = s.id === "closed_by_us";
            const isOut = s.id === "closed_outside";
            return (
              <div
                key={s.id}
                onDragOver={(e) => { if (canWrite) { e.preventDefault(); setOver(s.id); } }}
                onDragLeave={() => setOver((v) => (v === s.id ? "" : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver("");
                  if (dragging) move(dragging, s.id);
                  setDragging(null);
                }}
                style={{
                  display: "flex", flexDirection: "column", gap: 8, minHeight: 120,
                  background: over === s.id ? C.surfaceAlt : "transparent",
                  borderRadius: 10, padding: over === s.id ? 6 : 0, transition: "background .12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, paddingBottom: 7, borderBottom: `2px solid ${C.line}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isWin ? C.accent : isOut ? C.textMute : C.textDim }}>
                    {s.label}
                  </span>
                  <span className="crm-mute crm-num" style={{ fontSize: 11 }}>{list.length}</span>
                </div>

                {list.length === 0 && <Empty pad={14}>—</Empty>}
                {list.slice(0, 80).map((c) => (
                  <Card
                    key={c.id}
                    client={c}
                    requirement={reqByClient.get(c.id)}
                    engagement={engByUser.get(c.user_id)}
                    lastTouch={lastTouch.get(c.id)}
                    canWrite={canWrite}
                    onOpen={(client) => navigate(`/crm/clients?client=${client.id}`)}
                    onDragStart={(e, client) => {
                      setDragging(client);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                  />
                ))}
                {list.length > 80 && (
                  <span className="crm-mute" style={{ fontSize: 10.5 }}>+{list.length - 80} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Toast {...(toast ?? {})} />
    </div>
  );
}
