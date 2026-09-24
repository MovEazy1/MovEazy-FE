/**
 * The half of a listing a tenant never sees.
 *
 * Where the flat came from and who to ring about it. Both are internal: the
 * data lives in inventory_private / crm_brokers, which anon holds no grant on
 * and which every policy gates behind is_crm_staff(). The panel says so on
 * screen, because a field that looks like the rest of the form will be filled
 * in as if it were — and "POC" is exactly the field someone would otherwise
 * paste a tenant-facing note into.
 */
import { useEffect, useMemo, useState } from "react";
import { Btn, C, Chip } from "./crmUi";
import { PROPERTY_SOURCES, fetchBrokers, upsertBroker } from "../../lib/crmPropertyInternal";
import { DEFAULT_VISIT_RULE, VISIT_MODES, buildTimes, datesForMode } from "../../lib/visitSchedule";
import { formatForDisplay } from "../../lib/mobile";

function Row({ title, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
      <span className="crm-label">{title}</span>
      {hint && (
        <span className="crm-mute" style={{ fontSize: 10.5, lineHeight: 1.45 }}>{hint}</span>
      )}
      {children}
    </div>
  );
}

/** The band that says everything inside it is ours. */
function InternalFrame({ children }) {
  return (
    <div style={{
      border: `1px solid ${C.line}`,
      borderLeft: `3px solid ${C.gold}`,
      borderRadius: 10,
      padding: "12px 14px",
      background: C.surfaceAlt,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <span className="crm-label" style={{ margin: 0 }}>Internal only</span>
        <span className="crm-chip" style={{ pointerEvents: "none", fontSize: 9.5, borderColor: C.gold, color: C.gold }}>
          never shown to tenants
        </span>
      </div>
      <p className="crm-mute" style={{ fontSize: 10.5, margin: "0 0 12px", lineHeight: 1.5 }}>
        Stored apart from the listing, in a table no signed-out visitor and no
        tenant account can read. Nothing here reaches the property card, a
        share link or the map.
      </p>
      {children}
    </div>
  );
}

/**
 * Where it came from, which broker, and who to ring.
 *
 * `value` / `onChange` are the same shape as BLANK_INTERNAL, so the form owns
 * the state and this only edits it — the row is written alongside the listing,
 * after there is a property_id to key it on.
 */
export function InternalDetails({ value, onChange, actorEmail = "" }) {
  const [brokers, setBrokers] = useState([]);
  const [loadingBrokers, setLoadingBrokers] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", agency: "" });
  const [err, setErr] = useState("");

  const isBroker = value.source === "broker";

  useEffect(() => {
    if (!isBroker || brokers.length) return;
    let cancelled = false;
    setLoadingBrokers(true);
    (async () => {
      const rows = await fetchBrokers();
      if (cancelled) return;
      setBrokers(rows);
      setLoadingBrokers(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBroker]);

  const set = (patch) => onChange({ ...value, ...patch });

  const chosen = useMemo(
    () => brokers.find((b) => b.id === value.broker_id) ?? null,
    [brokers, value.broker_id],
  );

  /** Pick a broker, and offer their number as the POC — the usual case. */
  const chooseBroker = (id) => {
    const b = brokers.find((x) => x.id === id);
    const patch = { broker_id: id };
    // Only when the POC is still blank. An agent who has typed a specific
    // person should not have it replaced by picking the agency they work for.
    if (b && !String(value.poc_name).trim() && !String(value.poc_phone).trim()) {
      patch.poc_name = b.name || "";
      patch.poc_phone = b.phone || "";
    }
    set(patch);
  };

  const saveNewBroker = async () => {
    setErr("");
    if (!draft.name.trim()) { setErr("A broker needs a name."); return; }
    try {
      const row = await upsertBroker(draft, actorEmail);
      if (!row?.id) { setErr("Could not save this broker."); return; }
      setBrokers((list) => (list.some((b) => b.id === row.id) ? list : [row, ...list]));
      setAdding(false);
      setDraft({ name: "", phone: "", agency: "" });
      chooseBroker(row.id);
      // chooseBroker reads from `brokers`, which has not re-rendered yet, so
      // apply the new broker's details here too rather than relying on it.
      onChange({
        ...value,
        broker_id: row.id,
        poc_name: String(value.poc_name).trim() || row.name || "",
        poc_phone: String(value.poc_phone).trim() || row.phone || "",
      });
    } catch (e) {
      setErr(e?.message || "Could not save this broker.");
    }
  };

  return (
    <InternalFrame>
      <Row title="Property via" hint="How this flat reached us — not the same thing as who the listing is posted as.">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PROPERTY_SOURCES.map((s) => (
            <Chip key={s.id} on={value.source === s.id} onClick={() => set({ source: s.id })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Row>

      {isBroker && (
        <Row
          title="Which broker"
          hint="Everyone entered here is kept, so the next upload picks them from this list."
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="crm-input"
              style={{ flex: 1, minWidth: 180 }}
              value={value.broker_id || ""}
              onChange={(e) => chooseBroker(e.target.value)}
            >
              <option value="">
                {loadingBrokers ? "Loading brokers…" : brokers.length ? "Pick a broker…" : "No brokers saved yet"}
              </option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {[b.name, b.agency, b.phone ? formatForDisplay(b.phone) : ""].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
            <Btn sm onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "+ New"}</Btn>
          </div>

          {chosen && !adding && (
            <span className="crm-mute crm-num" style={{ fontSize: 10.5, marginTop: 4 }}>
              {[chosen.agency, chosen.phone ? formatForDisplay(chosen.phone) : "no number"].filter(Boolean).join(" · ")}
            </span>
          )}

          {adding && (
            <div style={{
              display: "flex", flexDirection: "column", gap: 6, marginTop: 8,
              padding: 10, border: `1px solid ${C.lineSoft}`, borderRadius: 8, background: C.surface,
            }}>
              <input
                className="crm-input" placeholder="Broker name *" value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
              <input
                className="crm-input" placeholder="Phone" inputMode="numeric" value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
              <input
                className="crm-input" placeholder="Agency (optional)" value={draft.agency}
                onChange={(e) => setDraft((d) => ({ ...d, agency: e.target.value }))}
              />
              {/* Matched on the number, so the same broker entered twice is one
                  row rather than two spellings of a name. */}
              <span className="crm-mute" style={{ fontSize: 10 }}>
                A broker with this number already saved will be reused, not duplicated.
              </span>
              {err && <span style={{ fontSize: 11, color: C.coral }}>{err}</span>}
              <div>
                <Btn sm variant="primary" onClick={saveNewBroker}>Save broker</Btn>
              </div>
            </div>
          )}
        </Row>
      )}

      <Row title="Point of contact" hint="Whoever actually opens the door. This is the number the Properties tab messages.">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            className="crm-input" placeholder="POC name" value={value.poc_name}
            onChange={(e) => set({ poc_name: e.target.value })}
          />
          <input
            className="crm-input" placeholder="POC phone" inputMode="numeric" value={value.poc_phone}
            onChange={(e) => set({ poc_phone: e.target.value })}
          />
          <input
            className="crm-input" placeholder="POC email (optional)" value={value.poc_email}
            onChange={(e) => set({ poc_email: e.target.value })}
          />
          <textarea
            className="crm-input" rows={2} placeholder="Anything worth knowing before you call"
            value={value.poc_note}
            onChange={(e) => set({ poc_note: e.target.value })}
          />
        </div>
      </Row>
    </InternalFrame>
  );
}

/**
 * The visit window a new listing is published with.
 *
 * Only on the add form. Editing a listing gets the full PropertyVisitSlots
 * panel, which can layer several windows and shows what is already bookable —
 * this is the one question that has to be answered before there is a listing
 * to attach slots to, and it comes pre-answered.
 */
export function VisitWindow({ value, onChange }) {
  const times = buildTimes(value.fromT, value.toT);
  const dates = datesForMode(value.mode);
  const set = (patch) => onChange({ ...value, ...patch });
  const isDefault =
    value.mode === DEFAULT_VISIT_RULE.mode &&
    value.fromT === DEFAULT_VISIT_RULE.fromT &&
    value.toT === DEFAULT_VISIT_RULE.toT;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {VISIT_MODES.map(([id, label]) => (
          <Chip key={id} on={value.mode === id} onClick={() => set({ mode: id })}>{label}</Chip>
        ))}
        <Chip on={value.mode === "none"} onClick={() => set({ mode: "none" })}>No times yet</Chip>
      </div>

      {value.mode !== "none" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="crm-mute" style={{ fontSize: 11 }}>From</span>
            <input
              className="crm-input" type="time" style={{ width: 118 }}
              value={value.fromT} onChange={(e) => set({ fromT: e.target.value })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="crm-mute" style={{ fontSize: 11 }}>To</span>
            <input
              className="crm-input" type="time" style={{ width: 118 }}
              value={value.toT} onChange={(e) => set({ toT: e.target.value })}
            />
          </label>
          {!isDefault && (
            <Btn sm onClick={() => onChange({ ...DEFAULT_VISIT_RULE })}>Reset to 8am–8pm</Btn>
          )}
        </div>
      )}

      <span className="crm-mute" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
        {value.mode === "none"
          ? "Published with nothing bookable — every visit on this flat will be arranged by hand."
          : times.length
            ? `${times.length} bookable time${times.length === 1 ? "" : "s"} a day across ${dates.length} day${dates.length === 1 ? "" : "s"}, rolling forward as the week moves.`
            : "Set an end time later than the start time."}
      </span>
    </div>
  );
}
