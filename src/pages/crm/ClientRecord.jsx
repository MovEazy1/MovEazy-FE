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
  STATUSES, TEMPERATURES, CLOSED_STATUSES, fetchActivities, fetchClientListingReactions, logActivity,
  setClientNote, setClientStatus, setClientTemperature,
} from "../../lib/crmClients";
import { buildTemplateVars, renderTemplate, whatsappUrl } from "../../lib/crmSettings";
import { CURATED_STATUS_LABEL } from "../../lib/curatedShares";
import { formatDuration } from "../../lib/sessionSync";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, TempDot, deadlineLabel, inr, relTime } from "./crmUi";

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

/** Matches the four commute-time cards on the wizard's own step — same
 * minutes, same words, so a number here reads exactly as the client saw it. */
function commuteLabel(minutes) {
  if (!minutes) return "";
  if (minutes >= 60) return "1 hr+";
  return `${minutes} min`;
}

/**
 * The six facts that decide whether you pick this client up right now, sitting
 * directly under the name. Everything else about the requirement is one click
 * away — this strip is what an agent scans, not the full option vocabulary.
 * Office and commute time are what the client typed themselves in the wizard
 * (ownAnswers, from public.user_requirements) — never edited from the CRM.
 */
function HeaderFacts({ req, ownAnswers }) {
  const facts = [
    // An agent's own override wins if set; otherwise fall back to what the
    // client picked themselves in the wizard (also from ownAnswers, like
    // office/commute — user_requirements has no move_in column of its own).
    ["Move in", req?.move_in || ownAnswers?.notes?.moveInDate || ""],
    ["Budget", budgetLabel(req)],
    ["Flat type", (req?.flat_types ?? []).join(", ")],
    ["Area", (req?.localities ?? []).join(", ")],
    ["Office", ownAnswers?.office?.display || ownAnswers?.office?.label || ""],
    ["Time to office", commuteLabel(ownAnswers?.notes?.commuteMinutes)],
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

/**
 * Every answer from the client's own wizard, unfiltered by whatever an agent
 * has since overridden in the requirement above — so "she says ₹48k" and
 * "will go to ₹52k" can both be read at once instead of one silently hiding
 * the other. Only appears once they've actually answered something.
 */
function WhatTheyToldUs({ ownAnswers }) {
  if (!ownAnswers) return null;
  const notes = ownAnswers.notes && typeof ownAnswers.notes === "object" ? ownAnswers.notes : {};
  const rows = [
    ["Office", ownAnswers.office?.display || ownAnswers.office?.label || ""],
    ["Time to office", commuteLabel(notes.commuteMinutes)],
    ["Move in", notes.moveInDate || ""],
    ["Age", ownAnswers.age || ""],
    ["Areas", (ownAnswers.localities ?? []).join(", ")],
    ["Budget", budgetLabel({ budget_min: ownAnswers.budget_min, budget_max: ownAnswers.budget_max })],
    ["Willing to stretch", ownAnswers.stretch ? "Yes" : ""],
    ["Flat type", (ownAnswers.flat_types ?? []).join(", ")],
    ["Occupants", (ownAnswers.occupants ?? []).join(", ")],
    ["Must haves", (ownAnswers.must_haves ?? []).join(", ")],
    ["Lifestyle", (ownAnswers.lifestyle ?? []).join(", ")],
    ["Deal breakers", (ownAnswers.deal_breakers ?? []).join(", ")],
    ["Priority", (ownAnswers.priority ?? []).join(", ")],
  ].filter(([, v]) => v);

  if (!rows.length) return null;

  return (
    <div className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="crm-label">What they told us · their own wizard answers</span>
        {ownAnswers.updated_at && (
          <span className="crm-mute" style={{ fontSize: 10 }}>updated {relTime(ownAnswers.updated_at)}</span>
        )}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(([label, value]) => (
          <li key={label} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span className="crm-label" style={{ flex: "none", width: 110 }}>{label}</span>
            <span style={{ fontSize: 12.5, color: label === "Deal breakers" ? C.coral : C.text, lineHeight: 1.5 }}>
              {value}
            </span>
          </li>
        ))}
      </ul>
      {(() => {
        const deadline = deadlineLabel(notes);
        return deadline ? (
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: deadline.startsWith("overdue") ? C.coral : C.gold, lineHeight: 1.5 }}>
            Shortlist {deadline}
          </p>
        ) : null;
      })()}
      {notes.requestedMoreFlatsAt && (
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: C.gold, lineHeight: 1.5 }}>
          Asked for more homes {relTime(notes.requestedMoreFlatsAt)}
        </p>
      )}
    </div>
  );
}

/** First usable photo — same rule ListingCard/MatchesPane use, cover first. */
function coverOf(listing) {
  return listing?.cover_image_url || (listing?.images ?? [])[0] || "";
}

const REACTION_STATUS = { like: "liked", dislike: "disliked" };

/**
 * Every property this client has actually reacted to — the first five
 * matches, a curated shortlist, or a link an agent sent — merged from
 * listing_reactions (their own swipes) and crm_shortlists (what an agent
 * sent and however they answered it) so one property never shows up twice
 * with two different verdicts. Loaded only for whichever client is open,
 * same as the activity timeline below.
 */
function PropertiesShown({ client, shortlists, inventory }) {
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!client.user_id) { setReactions([]); return undefined; }
    fetchClientListingReactions(client.user_id).then((rows) => alive && setReactions(rows));
    return () => { alive = false; };
  }, [client.id, client.user_id]);

  const inventoryById = useMemo(() => {
    const m = new Map();
    for (const l of inventory ?? []) m.set(l.property_id, l);
    return m;
  }, [inventory]);

  const rows = useMemo(() => {
    const byProperty = new Map();
    for (const r of reactions) {
      byProperty.set(r.property_id, { propertyId: r.property_id, status: REACTION_STATUS[r.reaction] || "", at: r.updated_at });
    }
    for (const s of shortlists ?? []) {
      if (s.client_id !== client.id) continue;
      const prior = byProperty.get(s.property_id);
      byProperty.set(s.property_id, {
        propertyId: s.property_id,
        status: s.status || prior?.status || "",
        at: s.reacted_at || prior?.at || s.shared_at,
      });
    }
    return [...byProperty.values()]
      .map((r) => ({ ...r, listing: inventoryById.get(r.propertyId) }))
      .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  }, [reactions, shortlists, client.id, inventoryById]);

  if (!rows.length) return null;

  return (
    <Section label={`Properties shown · ${rows.length}`}>
      <div className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {rows.map((r) => {
          const cover = coverOf(r.listing);
          const label = CURATED_STATUS_LABEL[r.status] || r.status || "Shown, no reply yet";
          const color = ["liked", "visit_scheduled", "visited"].includes(r.status) ? C.accent
            : r.status === "disliked" || r.status === "rejected" ? C.coral : C.textDim;
          return (
            <div key={r.propertyId} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.lineSoft}` }}>
              <div style={{
                flex: "none", width: 36, height: 36, borderRadius: 7, overflow: "hidden",
                background: C.surfaceAlt, border: `1px solid ${C.line}`, display: "grid", placeItems: "center",
              }}>
                {cover ? (
                  <img src={cover} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <span className="crm-mute" style={{ fontSize: 7 }}>NO PIC</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.listing ? `${r.listing.flat_type || "Home"} · ${r.listing.area || "—"}` : r.propertyId}
                </span>
                <span className="crm-mute crm-num" style={{ fontSize: 10.5 }}>
                  {r.listing ? `${inr(r.listing.rent)} · ${r.propertyId}` : "no longer in inventory"}
                </span>
              </div>
              <span style={{
                flex: "none", alignSelf: "center", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
                background: `${color}18`, color, border: `1px solid ${color}44`, whiteSpace: "nowrap",
              }}>
                {label}{r.at ? ` · ${relTime(r.at)}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
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
  const [brokerage, setBrokerage] = useState("");
  const [creditDate, setCreditDate] = useState("");

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
        <>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">MovEazy brokerage</span>
              <input className="crm-input crm-num" type="number" value={brokerage} placeholder="11250"
                onChange={(e) => setBrokerage(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Expected credit date</span>
              <input className="crm-input" type="date" value={creditDate}
                onChange={(e) => setCreditDate(e.target.value)} />
            </label>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 7 }}>
        <Btn variant="primary"
          onClick={() => onConfirm({
            reason, propertyId,
            rent: rent === "" ? null : Number(rent),
            brokerage: brokerage === "" ? null : Number(brokerage),
            creditDate,
          })}>
          Confirm
        </Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
      <p className="crm-mute" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        This marks their profile as no longer searching, so the site stops sending them matches.
        {outside ? "" : " The deal then appears on the payments list awaiting the money."}
      </p>
    </div>
  );
}

/* ── The pane ─────────────────────────────────────────────────────────────── */

export default function ClientRecord({
  client, requirement, isOverride, engagement, settings, access, actorEmail, agentName,
  onPatch, onRequirementChange, onRequirementReset, onToast, ownAnswers, shortlists, inventory,
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

        <HeaderFacts req={requirement} ownAnswers={ownAnswers} />
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
            onConfirm={({ reason, propertyId, rent, brokerage, creditDate }) =>
              applyStatus(pendingClose, { reason, propertyId, rent, brokerage, creditDate })}
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

        <WhatTheyToldUs ownAnswers={ownAnswers} />

        <PropertiesShown client={client} shortlists={shortlists} inventory={inventory} />

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
