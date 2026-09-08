/**
 * The middle pane: one client, everything about them, everything you can do.
 *
 * Order is deliberate — the pinned note sits above status and temperature,
 * because the sentence "wants a second bathroom, will stretch to ₹52k" is worth
 * more than any structured field on this screen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_LOCALITIES, DEALBREAKERS, FLAT_TYPES, FURNISHINGS, MUST_HAVES, OCCUPANTS,
} from "../../data/preferenceOptions";
import {
  STATUSES, TEMPERATURES, CLOSED_STATUSES, fetchActivities, logActivity,
  setClientNote, setClientStatus, setClientTemperature,
} from "../../lib/crmClients";
import { buildTemplateVars, renderTemplate, whatsappUrl } from "../../lib/crmSettings";
import { formatDuration } from "../../lib/sessionSync";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, TempDot, inr, relTime } from "./crmUi";

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function Section({ label, action, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
        <span className="crm-label">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ options, selected, onToggle, disabled }) {
  const set = new Set(selected ?? []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => (
        <Chip key={o} on={set.has(o)} disabled={disabled} onClick={() => onToggle(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

/**
 * The pinned brief. Saves on blur rather than per keystroke — an agent typing
 * mid-call shouldn't generate thirty timeline entries.
 */
function PinnedNote({ client, canWrite, actorEmail, onSaved, onToast }) {
  const [draft, setDraft] = useState(client.note ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setDraft(client.note ?? "");
    setEditing(false);
  }, [client.id, client.note]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = async () => {
    setEditing(false);
    if ((draft ?? "") === (client.note ?? "")) return;
    setSaving(true);
    try {
      onSaved(await setClientNote(client, draft, { actorEmail }));
      onToast("Note saved");
    } catch (e) {
      setDraft(client.note ?? "");
      onToast(e?.message || "Could not save the note", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-card" style={{ background: C.surfaceAlt, borderLeft: `2px solid ${C.accent}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
        <span className="crm-label">Note about this client</span>
        <span className="crm-mute" style={{ fontSize: 10 }}>
          {saving
            ? "Saving…"
            : client.note_at
              ? `${client.note_by || "—"} · ${relTime(client.note_at)}`
              : canWrite ? "click to write" : ""}
        </span>
      </div>

      {editing ? (
        <textarea
          ref={ref}
          className="crm-input"
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          placeholder="What the questionnaire couldn't ask. Budget flexibility, timing, who they're moving with, when to call."
        />
      ) : (
        <p
          onClick={() => canWrite && setEditing(true)}
          style={{
            margin: 0, fontSize: 12.5, lineHeight: 1.58,
            color: client.note ? C.text : C.textMute,
            cursor: canWrite ? "text" : "default", whiteSpace: "pre-wrap",
          }}
        >
          {client.note || (canWrite ? "Nothing written yet — click to add what you know." : "No note.")}
        </p>
      )}
    </div>
  );
}

/* ── Requirement editor ───────────────────────────────────────────────────── */

const budgetLabel = (req) => {
  const lo = Number(req?.budget_min) || 0;
  const hi = Number(req?.budget_max) || 0;
  if (lo && hi) return `${inr(lo)} – ${inr(hi)}`;
  if (hi) return `up to ${inr(hi)}`;
  if (lo) return `${inr(lo)}+`;
  return "";
};

/** Has anyone told us anything about what this client wants? */
function hasRequirement(req) {
  if (!req) return false;
  return Boolean(
    (req.localities ?? []).length || (req.flat_types ?? []).length ||
    (req.must_haves ?? []).length || (req.deal_breakers ?? []).length ||
    (req.occupants ?? []).length || req.furnishing || req.move_in ||
    req.budget_min || req.budget_max,
  );
}

/**
 * The four facts that decide whether you pick this client up right now, sitting
 * directly under the name. Everything else about the requirement is one click
 * away — this strip is what an agent scans, not the full option vocabulary.
 */
function HeaderFacts({ req }) {
  const facts = [
    ["Move in", req?.move_in || ""],
    ["Budget", budgetLabel(req)],
    ["Flat type", (req?.flat_types ?? []).join(", ")],
    ["Area", (req?.localities ?? []).join(", ")],
  ];
  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.accent}`,
        borderRadius: 9, background: C.surface, overflow: "hidden",
      }}
    >
      {facts.map(([label, value], i) => (
        <div
          key={label}
          style={{ padding: "8px 12px", borderLeft: i ? `1px solid ${C.line}` : "none", minWidth: 0 }}
        >
          <div className="crm-label">{label}</div>
          <div
            className="crm-num"
            style={{
              fontSize: 13, fontWeight: 700, marginTop: 2,
              color: value ? C.text : C.textMute,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
            title={value || "not set"}
          >
            {value || "not set"}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One line per thing we actually know. Nothing that hasn't been set is listed. */
function RequirementSummary({ req }) {
  const rows = [
    ["Areas", (req.localities ?? []).join(", ")],
    ["Budget", budgetLabel(req)],
    ["Flat type", (req.flat_types ?? []).join(", ")],
    ["Furnishing", req.furnishing || ""],
    ["Must haves", (req.must_haves ?? []).join(", ")],
    ["Deal breakers", (req.deal_breakers ?? []).join(", ")],
    ["Occupants", (req.occupants ?? []).join(", ")],
    ["Move in", req.move_in || ""],
  ].filter(([, v]) => v);

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(([label, value]) => (
        <li key={label} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <span className="crm-label" style={{ flex: "none", width: 92 }}>{label}</span>
          <span style={{ fontSize: 12.5, color: label === "Deal breakers" ? C.coral : C.text, lineHeight: 1.5 }}>
            {value}
          </span>
        </li>
      ))}
      <li style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <span className="crm-label" style={{ flex: "none", width: 92 }}>Matching</span>
        <span className="crm-mute crm-num" style={{ fontSize: 12.5 }}>
          showing matches above {req.min_score ?? 60}%
        </span>
      </li>
    </ul>
  );
}

/**
 * Summary by default, full editor on demand.
 *
 * The editor lists every option in the shared vocabulary — sixty-odd chips — and
 * that wall was the first thing an agent saw on every client. It's the right UI
 * for changing a requirement and the wrong one for reading it, so reading is now
 * the default and editing is a click.
 */
function RequirementCard({ req, isOverride, canEdit, onChange, onReset }) {
  const [editing, setEditing] = useState(false);
  const known = hasRequirement(req);

  const set = (patch) => onChange({ ...req, ...patch });
  const toggle = (key, value) => {
    const cur = req[key] ?? [];
    set({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };

  return (
    <div className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="crm-label">
          Requirement{" "}
          {isOverride && known && <span style={{ color: C.accent, letterSpacing: 0 }}>· CRM override</span>}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {canEdit && editing && isOverride && <Btn sm onClick={onReset}>Reset to client&apos;s own</Btn>}
          {canEdit && (
            <Btn sm variant={editing ? "primary" : known ? undefined : "primary"} onClick={() => setEditing((v) => !v)}>
              {editing ? "Done" : known ? "Modify requirements" : "Add requirements"}
            </Btn>
          )}
        </div>
      </div>

      {!editing && known && <RequirementSummary req={req} />}

      {!editing && !known && (
        <p className="crm-mute" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.55 }}>
          Nothing captured yet — they never finished Find My Flat. Add what you know and matches appear
          straight away.
        </p>
      )}

      {editing && (
        <>
          <div>
            <span className="crm-label">Localities</span>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={ALL_LOCALITIES} selected={req.localities} disabled={!canEdit}
                onToggle={(v) => toggle("localities", v)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Budget min</span>
              <input className="crm-input crm-num" type="number" inputMode="numeric" disabled={!canEdit}
                value={req.budget_min ?? ""} placeholder="30000"
                onChange={(e) => set({ budget_min: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Budget max</span>
              <input className="crm-input crm-num" type="number" inputMode="numeric" disabled={!canEdit}
                value={req.budget_max ?? ""} placeholder="50000"
                onChange={(e) => set({ budget_max: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>

          <div>
            <span className="crm-label">Flat type</span>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={FLAT_TYPES} selected={req.flat_types} disabled={!canEdit}
                onToggle={(v) => toggle("flat_types", v)} />
            </div>
          </div>

          <div>
            <span className="crm-label">Furnishing</span>
            <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FURNISHINGS.map((f) => (
                <Chip key={f} on={req.furnishing === f} disabled={!canEdit}
                  onClick={() => set({ furnishing: req.furnishing === f ? "" : f })}>
                  {f}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className="crm-label">Must haves</span>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={MUST_HAVES} selected={req.must_haves} disabled={!canEdit}
                onToggle={(v) => toggle("must_haves", v)} />
            </div>
          </div>

          <div>
            <span className="crm-label">Deal breakers</span>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={DEALBREAKERS} selected={req.deal_breakers} disabled={!canEdit}
                onToggle={(v) => toggle("deal_breakers", v)} />
            </div>
          </div>

          <div>
            <span className="crm-label">Occupants</span>
            <div style={{ marginTop: 5 }}>
              <ChipRow options={OCCUPANTS} selected={req.occupants} disabled={!canEdit}
                onToggle={(v) => toggle("occupants", v)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Move in</span>
              <input className="crm-input" disabled={!canEdit} value={req.move_in ?? ""}
                placeholder="15 Oct 2026, or ASAP"
                onChange={(e) => set({ move_in: e.target.value })} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Show matches above</span>
              <input className="crm-input crm-num" type="number" min="0" max="100" disabled={!canEdit}
                value={req.min_score ?? 60}
                onChange={(e) => set({ min_score: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Closing ──────────────────────────────────────────────────────────────── */

function ClosePrompt({ status, reasons, onCancel, onConfirm }) {
  const outside = status === "closed_outside";
  const [reason, setReason] = useState(outside ? reasons[0] ?? "Other" : "");
  const [propertyId, setPropertyId] = useState("");
  const [rent, setRent] = useState("");

  return (
    <div className="crm-card" style={{ borderColor: outside ? C.textMute : C.accent, display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="crm-label" style={{ color: outside ? C.textMute : C.accent }}>
        {outside ? "Closed outside — why?" : "Closed by us — the details"}
      </span>

      {outside ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {reasons.map((r) => (
            <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="crm-label">Property</span>
            <input className="crm-input" value={propertyId} placeholder="MZ-XXXXXX"
              onChange={(e) => setPropertyId(e.target.value.toUpperCase())} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="crm-label">Rent agreed</span>
            <input className="crm-input crm-num" type="number" value={rent} placeholder="44000"
              onChange={(e) => setRent(e.target.value)} />
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: 7 }}>
        <Btn variant="primary"
          onClick={() => onConfirm({ reason, propertyId, rent: rent === "" ? null : Number(rent) })}>
          Confirm
        </Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
      <p className="crm-mute" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        This also marks their profile as no longer searching, so the site stops sending them matches.
      </p>
    </div>
  );
}

/* ── The pane ─────────────────────────────────────────────────────────────── */

export default function ClientRecord({
  client, requirement, isOverride, engagement, settings, access, actorEmail, agentName,
  onPatch, onRequirementChange, onRequirementReset, onToast,
}) {
  const [activities, setActivities] = useState([]);
  const [pendingClose, setPendingClose] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const canWrite = access.has(SCOPES.CLIENTS_WRITE);
  const canEditReq = access.has(SCOPES.REQUIREMENTS_WRITE);

  useEffect(() => {
    let alive = true;
    fetchActivities(client.id).then((rows) => alive && setActivities(rows));
    return () => { alive = false; };
  }, [client.id]);

  const refreshActivities = () => fetchActivities(client.id).then(setActivities);

  /** tel: opens the dialler on a phone; on a laptop it opens nothing useful, so
   *  the button copies the number instead of pretending to dial. */
  const isTouch = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(hover: none)")?.matches,
    [],
  );

  const outreachTemplate = useMemo(() => {
    const list = settings?.templates ?? [];
    return list.find((t) => t.id === settings?.defaultTemplateId) ?? list[0];
  }, [settings]);

  const handleWhatsApp = async () => {
    const vars = buildTemplateVars({ client, requirement, agentName });
    const url = whatsappUrl(client.phone, renderTemplate(outreachTemplate?.body ?? "", vars));
    if (!url) return onToast("No phone number on this client", "error");
    window.open(url, "_blank", "noopener");
    if (canWrite) {
      await logActivity(client.id, {
        type: "whatsapp",
        body: `Opened WhatsApp · ${outreachTemplate?.name ?? "template"}`,
        actorEmail,
      });
      refreshActivities();
    }
  };

  const handleCall = async () => {
    if (!client.phone) return onToast("No phone number on this client", "error");
    if (isTouch) {
      window.location.href = `tel:+${String(client.phone).replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`;
    } else {
      try {
        await navigator.clipboard.writeText(client.phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        onToast("Could not copy the number", "error");
      }
    }
    if (canWrite) {
      await logActivity(client.id, { type: "call", body: "Called", actorEmail });
      refreshActivities();
    }
  };

  const applyStatus = async (status, extra = {}) => {
    setBusy(true);
    try {
      onPatch(await setClientStatus(client, status, { actorEmail, ...extra }));
      setPendingClose(null);
      refreshActivities();
    } catch (e) {
      onToast(e?.message || "Could not change the status", "error");
    } finally {
      setBusy(false);
    }
  };

  const chooseStatus = (status) => {
    // Re-clicking the current status wrote a "Fresh lead -> Fresh lead" row and
    // buried the real history. Nothing changed, so log nothing.
    if (status === client.status) return;
    if (CLOSED_STATUSES.includes(status)) return setPendingClose(status);
    applyStatus(status);
  };

  const applyTemperature = async (temp) => {
    setBusy(true);
    try {
      onPatch(await setClientTemperature(client, client.temperature === temp ? null : temp, { actorEmail }));
      refreshActivities();
    } catch (e) {
      onToast(e?.message || "Could not set the temperature", "error");
    } finally {
      setBusy(false);
    }
  };

  const initials = (client.name || client.email || "?")
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="crm-col crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* identity + the two things you actually do */}
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span
            style={{
              width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center",
              background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, flex: "none",
            }}
          >
            {initials}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{client.name || "Unnamed"}</div>
            <div className="crm-mute crm-num" style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {client.phone || "no phone"} · {client.email || "no email"}
              {client.assigned_to ? ` · ${client.assigned_to}` : ""}
            </div>
          </div>
          <Btn variant="wa" onClick={handleWhatsApp} disabled={!client.phone}>WhatsApp</Btn>
          <Btn variant="call" onClick={handleCall} disabled={!client.phone}>
            {copied ? "Copied" : "Call"}
          </Btn>
        </div>

        <HeaderFacts req={requirement} />
        {client.phone && (
          <span className="crm-mute crm-num" style={{ fontSize: 10.5, marginTop: -10 }}>
            {isTouch ? `tel:+${String(client.phone).replace(/\D/g, "")} · opens your phone's dialler`
                     : `${client.phone} · click Call to copy — tel: links don't dial from a laptop`}
          </span>
        )}

        <PinnedNote client={client} canWrite={canWrite} actorEmail={actorEmail}
          onSaved={onPatch} onToast={onToast} />

        {/* status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="crm-label">Status</span>
          <div style={{ display: "flex", overflowX: "auto" }}>
            {STATUSES.map((s) => {
              const on = client.status === s.id;
              const cls = [
                "crm-step",
                on && "crm-step--on",
                !on && s.id === "closed_by_us" && "crm-step--win",
                !on && s.id === "closed_outside" && "crm-step--out",
              ].filter(Boolean).join(" ");
              return (
                <button key={s.id} type="button" className={cls} title={s.hint} disabled={!canWrite || busy}
                  onClick={() => chooseStatus(s.id)}>
                  {s.label}
                  {s.id === "dnp" && client.dnp_count > 0 ? ` ×${client.dnp_count}` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {pendingClose && (
          <ClosePrompt
            status={pendingClose}
            reasons={settings?.closedOutsideReasons ?? []}
            onCancel={() => setPendingClose(null)}
            onConfirm={({ reason, propertyId, rent }) =>
              applyStatus(pendingClose, { reason, propertyId, rent })}
          />
        )}

        {/* temperature — never computed, blank until someone decides */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="crm-label">Client is</span>
          {TEMPERATURES.map((t) => (
            <Chip key={t.id} on={client.temperature === t.id} title={t.hint} disabled={!canWrite || busy}
              onClick={() => applyTemperature(t.id)}
              style={client.temperature === t.id
                ? { borderColor: t.color, color: t.color, background: `${t.color}18` }
                : undefined}
            >
              <TempDot color={t.color} />
              {t.label}
            </Chip>
          ))}
          {!client.temperature && (
            <span className="crm-mute" style={{ fontSize: 11 }}>set by hand · not set yet</span>
          )}
        </div>

        <RequirementCard req={requirement} isOverride={isOverride} canEdit={canEditReq}
          onChange={onRequirementChange} onReset={onRequirementReset} />

        {/* engagement */}
        <div className="crm-card">
          <span className="crm-label">Engagement</span>
          {engagement ? (
            <>
              <div className="crm-row">
                <span className="crm-label">Opened the site</span>
                <span className="crm-num" style={{ fontSize: 12.5 }}>
                  {engagement.session_count} times · last {relTime(engagement.last_seen_at)}
                </span>
              </div>
              <div className="crm-row">
                <span className="crm-label">Total time on site</span>
                <span className="crm-num" style={{ fontSize: 12.5 }}>
                  {formatDuration(engagement.total_seconds)} across {engagement.session_count} sessions
                </span>
              </div>
              <div className="crm-row">
                <span className="crm-label">Longest session</span>
                <span className="crm-num" style={{ fontSize: 12.5 }}>
                  {formatDuration(engagement.longest_seconds)}
                </span>
              </div>
            </>
          ) : (
            <p className="crm-mute" style={{ fontSize: 11.5, margin: "8px 0 0", lineHeight: 1.5 }}>
              No sessions recorded yet. Visits only started counting when session tracking went live — this
              fills in from their next visit, and never backfills older ones.
            </p>
          )}
        </div>

        {/* timeline */}
        <Section label="Activity">
          <div className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {activities.length === 0 && <Empty pad={12}>Nothing logged yet.</Empty>}
            {activities.slice(0, 60).map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span className="crm-chip" style={{ flex: "none", pointerEvents: "none" }}>{a.type}</span>
                <span style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, minWidth: 0 }}>
                  {a.body}{" "}
                  <span className="crm-mute">
                    · {a.actor_email || "—"}, {relTime(a.created_at)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>

        {client.closed_at && (
          <p className="crm-mute" style={{ fontSize: 11.5, margin: 0 }}>
            Closed {relTime(client.closed_at)}
            {client.closed_reason ? ` · ${client.closed_reason}` : ""}
            {client.closed_property_id ? ` · ${client.closed_property_id}` : ""}
            {client.closed_rent ? ` · ${inr(client.closed_rent)}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
