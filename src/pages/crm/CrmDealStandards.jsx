/**
 * CRM → Deals → Deal of the Day: the standard rents each deal is compared with
 * ("18% lower than the standard 2 BHK rent in HSR (₹59k)"; above that, "8%
 * lower than premium society 2 BHK flats (₹65k)"). One row for everywhere, and
 * any area its own (matched within the flat's area name). Editing needs
 * permission to edit properties — the database checks.
 */
import { useEffect, useState } from "react";
import { Btn, C } from "./crmUi";
import { STANDARD_FIELDS, fetchDealStandards, removeDealStandard, saveDealStandard } from "../../lib/dealStandards";

const errText = (e) => e?.message || "Something went wrong.";
const blank = { area: "", label: "", r1: "", r2: "", r3: "", s2: "", s3: "" };
const toForm = (r) => Object.fromEntries(Object.keys(blank).map((k) => [k, r?.[k] == null ? "" : String(r[k])]));

function Row({ row, canEdit, onSaved, say, isNew = false, onCancel }) {
  const [f, setF] = useState(() => toForm(row));
  const [busy, setBusy] = useState(false);
  const everywhere = !isNew && row.area === "";
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(row));
  const save = async () => {
    if (isNew && f.area.trim().length < 2) { say("Name the area, e.g. Sarjapur", "error"); return; }
    setBusy(true);
    try { onSaved(await saveDealStandard({ ...f, label: f.label || f.area })); say("Standard rents saved — deals now use them"); if (isNew) onCancel?.(); }
    catch (e) { say(errText(e), "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${row.label || row.area}'s own standards? Its flats use everywhere's.`)) return;
    setBusy(true);
    try { onSaved(await removeDealStandard(row.area)); } catch (e) { say(errText(e), "error"); setBusy(false); }
  };
  const input = (k, w = 92) => (
    <input className="crm-input" style={{ width: w }} inputMode="numeric" value={f[k]} disabled={!canEdit || busy} placeholder="—"
      onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") })} aria-label={k} />
  );
  return (
    <tr>
      <td style={td}>
        {everywhere ? (
          <><b>Everywhere</b><div style={{ fontSize: 11.5, color: C.textMute }}>Named in the line as “{row.label || "HSR"}” for flats there</div></>
        ) : isNew ? (
          <input className="crm-input" style={{ width: 150 }} value={f.area} placeholder="Area, e.g. Sarjapur" onChange={(e) => setF({ ...f, area: e.target.value, label: e.target.value })} aria-label="Area" />
        ) : <b>{row.label || row.area}</b>}
      </td>
      {STANDARD_FIELDS.map((x) => <td key={x.id} style={td}>{input(x.id)}</td>)}
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        {canEdit && (dirty || isNew) && <Btn sm variant="primary" disabled={busy} onClick={save}>{busy ? "…" : "Save"}</Btn>}
        {canEdit && isNew && <Btn sm onClick={onCancel}>Cancel</Btn>}
        {canEdit && !isNew && !everywhere && <Btn sm variant="danger" disabled={busy} onClick={remove}>Remove</Btn>}
      </td>
    </tr>
  );
}

export default function CrmDealStandards({ canEdit, say }) {
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => { fetchDealStandards().then(setRows, (e) => { say(errText(e), "error"); setRows([]); }); }, [say]);
  if (rows === null) return null;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.bg, padding: 14, display: "grid", gap: 8 }}>
      <div>
        <b style={{ fontSize: 14.5 }}>Standard rents (₹ / month)</b>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.textDim, lineHeight: 1.55, maxWidth: "90ch" }}>
          Every deal&apos;s “% lower” line is worked out against these. A flat 5% or more under its type&apos;s standard shows
          “X% lower than the standard 2 BHK rent”; one above the standard but 5%+ under the society rent shows “X% lower than premium
          society 2 BHK flats”. 1 RK and 4+ BHK show no %. An area row (e.g. “Sarjapur”) is used for flats whose area name contains it.
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Area</th>
              {STANDARD_FIELDS.map((x) => <th key={x.id} style={th}>{x.label}</th>)}
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <Row key={`${r.area}:${r.updated_at}`} row={r} canEdit={canEdit} onSaved={setRows} say={say} />)}
            {adding && <Row row={blank} isNew canEdit={canEdit} onSaved={setRows} say={say} onCancel={() => setAdding(false)} />}
          </tbody>
        </table>
      </div>
      {canEdit && !adding && <div><Btn sm onClick={() => setAdding(true)}>+ An area&apos;s own standards</Btn></div>}
    </div>
  );
}

const th = { padding: "6px 8px", textAlign: "left", fontSize: 12, color: C.textMute, borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
const td = { padding: "6px 8px", borderBottom: `1px solid ${C.lineSoft}`, verticalAlign: "middle" };
