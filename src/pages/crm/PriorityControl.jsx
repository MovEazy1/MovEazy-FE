/**
 * A client's place in Priority closures, on their record: add now or from a
 * day, see when they join, take them out (now, or until a day). Reads and
 * refreshes the shell's `priority` rows (crm_priority.sql).
 */
import { useState } from "react";
import { Target } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, shortDate } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { addToPriority, fetchPriority, removeFromPriority } from "../../lib/crmPriority";

const dayInput = (d) => new Date(d).toISOString().slice(0, 10);

export default function PriorityControl({ client, onToast }) {
  const crm = useCrm();
  const canWrite = crm.access.has(SCOPES.CLIENTS_WRITE);
  const row = (crm.priority ?? []).find((p) => p.client_id === client.id);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      const rows = await fetchPriority();
      crm.setData((d) => ({ ...d, priority: rows }));
      onToast?.(ok);
      setOpen(false);
    } catch (e) {
      onToast?.(e?.message || "Couldn't change Priority closures", "error");
    } finally {
      setBusy(false);
    }
  };
  const at = (hh) => (date ? new Date(`${date}T${hh}:00:00`) : null);
  const scheduled = row && new Date(row.active_from).getTime() > now;

  const status = !row ? "Not in Priority closures" : scheduled ? `Joins Priority closures on ${shortDate(row.active_from)}` : "In Priority closures";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 10,
      border: `1px solid ${row ? "#B7D8CF" : C.line}`, background: row ? C.accentSoft : C.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Target size={15} color={row ? C.accent : C.textMute} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: row ? C.accent : C.textDim }}>{status}</span>
        {canWrite && <Btn sm onClick={() => setOpen((v) => !v)}>{open ? "Close" : row ? "Change" : "+ Add"}</Btn>}
      </div>
      {open && canWrite && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" className="crm-input" value={date} min={dayInput(now)} onChange={(e) => setDate(e.target.value)}
            style={{ width: 150 }} aria-label="From or until this day" />
          {(!row || scheduled) && (
            <Btn sm variant="primary" disabled={busy}
              onClick={() => run(() => addToPriority([client.id], at("08")), date ? `Joins on ${shortDate(at("08"))}` : "Added to Priority closures")}>
              {date ? "Add from this day" : "Add now"}
            </Btn>
          )}
          {row && (
            <Btn sm variant="danger" disabled={busy}
              onClick={() => run(() => removeFromPriority(client.id, at("08")), date ? `Back on ${shortDate(at("08"))}` : "Removed from Priority closures")}>
              {date ? "Remove until this day" : "Remove now"}
            </Btn>
          )}
          <span className="crm-mute" style={{ fontSize: 11 }}>Pick a day to schedule; leave it empty for now.</span>
        </div>
      )}
    </div>
  );
}
