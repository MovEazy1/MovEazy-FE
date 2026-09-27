/**
 * The main screen: list · record · matches.
 *
 * The list never moves. Selecting someone swaps the two panes beside it, not the
 * page. On a phone the three become swipeable tabs, because this gets used
 * standing outside a building.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCrm } from "./CrmShell";
import ClientRecord from "./ClientRecord";
import MatchesPane from "./MatchesPane";
import {
  TEMPERATURES, createClient, fetchShortlists, markContacted,
  saveClientRequirement, resetClientRequirement, statusLabel, tempColor, syncClientsFromSignups,
} from "../../lib/crmClients";
import { formatDuration } from "../../lib/sessionSync";
import {
  CONTACTED_SORTS, FRESH_SORTS, LEAD_STAGES, QUIET_AFTER_DAYS, agoLabel, bucketOf, moveInTs,
  shortlistDueTs, sortClients, summariseClients,
} from "../../lib/crmLeadBuckets";
import {
  basisLabel, effectiveFacts, groupInterestByClient, inferRequirement, requirementForMatching,
} from "../../lib/crmPropertyInterest";
import { SCOPES } from "../../lib/adminScopes";
import { buildTemplateCsv, downloadCsv, parseCsv, planImport, runImport } from "../../lib/crmImport";
import { Btn, C, Chip, Empty, TempDot, Toast, deadlineLabel, shortDate } from "./crmUi";

const EMPTY_REQ = {
  localities: [], budget_min: null, budget_max: null, flat_types: [], furnishing: "",
  must_haves: [], deal_breakers: [], occupants: [], move_in: "", min_score: 60,
};

function NewClientForm({ actorEmail, onCreated, onCancel, onToast }) {
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim() && !f.phone.trim()) return onToast("A name or a phone number, at least", "error");
    setSaving(true);
    try {
      onCreated(await createClient({ ...f, source: "manual" }, { actorEmail }));
    } catch (err) {
      onToast(err?.message || "Could not add the client", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7, borderBottom: `1px solid ${C.line}` }}>
      <input className="crm-input" placeholder="Name" value={f.name}
        onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
      <input className="crm-input" placeholder="Phone" value={f.phone} inputMode="tel"
        onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <input className="crm-input" placeholder="Email (optional)" value={f.email} type="email"
        onChange={(e) => setF({ ...f, email: e.target.value })} />
      <div style={{ display: "flex", gap: 6 }}>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? "Adding…" : "Add"}</Btn>
        <Btn type="button" onClick={onCancel}>Cancel</Btn>
      </div>
    </form>
  );
}

/**
 * Bulk import.
 *
 * Two steps on purpose: the file is parsed and shown back before anything is
 * written, because undoing a bad import of two hundred rows is far worse than
 * pausing to look at it. The template carries the closed statuses and brokerage
 * columns so a backlog of finished deals imports as history, not as fresh leads.
 */
function ImportPanel({ actorEmail, onDone, onCancel, onToast }) {
  const [plan, setPlan] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const readFile = async (file) => {
    if (!file) return;
    try {
      setPlan(planImport(parseCsv(await file.text())));
      setResult(null);
    } catch (e) {
      onToast(e?.message || "Could not read that file", "error");
    }
  };

  const go = async () => {
    setRunning(true);
    try {
      const r = await runImport(plan.clients, actorEmail);
      setResult(r);
      if (r.inserted) onDone(r.inserted);
    } catch (e) {
      onToast(e?.message || "Import failed", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${C.line}` }}>
      <span className="crm-label">Bulk import</span>
      <p className="crm-mute" style={{ fontSize: 11, margin: 0, lineHeight: 1.45 }}>
        Fill the template and upload it. Closed deals can be imported as closed — status,
        brokerage and expected credit date are all columns.
      </p>

      <Btn sm onClick={() => downloadCsv("moveazy-leads-template.csv", buildTemplateCsv())}>
        Download template
      </Btn>

      <input
        type="file"
        accept=".csv,text/csv"
        className="crm-input"
        onChange={(e) => readFile(e.target.files?.[0])}
        style={{ fontSize: 11 }}
      />

      {plan && !result && (
        <div className="crm-card" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {plan.clients.length} to add
            {plan.skipped ? ` · ${plan.skipped} guide/blank rows skipped` : ""}
          </span>
          {plan.errors.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {plan.errors.slice(0, 6).map((e) => (
                <span key={e} style={{ fontSize: 11, color: C.coral }}>{e}</span>
              ))}
              {plan.errors.length > 6 && (
                <span className="crm-mute" style={{ fontSize: 11 }}>+{plan.errors.length - 6} more</span>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <Btn sm variant="primary" disabled={running || !plan.clients.length} onClick={go}>
              {running ? "Importing…" : `Import ${plan.clients.length}`}
            </Btn>
            <Btn sm onClick={onCancel}>Cancel</Btn>
          </div>
        </div>
      )}

      {result && (
        <div className="crm-card" style={{ padding: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>
            {result.inserted} imported
          </span>
          {result.failures.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5 }}>
              {result.failures.slice(0, 5).map((f) => (
                <span key={f} style={{ fontSize: 11, color: C.coral }}>{f}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 7 }}><Btn sm onClick={onCancel}>Done</Btn></div>
        </div>
      )}
    </div>
  );
}

/**
 * "JP Nagar · ₹27k · 2 BHK" under a client's name.
 *
 * Anything read from the flats they opened rather than stated is prefixed "~"
 * and tinted, so a guess never passes for an answer at a glance.
 */
function ClientFactsLine({ facts, basis }) {
  const parts = [];
  const areas = facts.localities.value.slice(0, 2).join(", ");
  parts.push({ text: areas || "no area", inferred: facts.localities.inferred });
  const b = facts.budget;
  if (b.max || b.min) {
    const k = (n) => `₹${Math.round(n / 1000)}k`;
    const text = b.inferred && b.min && b.max && b.min !== b.max ? `${k(b.min)}–${k(b.max)}` : k(b.max || b.min);
    parts.push({ text, inferred: b.inferred });
  }
  if (facts.flat_types.value[0]) parts.push({ text: facts.flat_types.value[0], inferred: facts.flat_types.inferred });
  const anyInferred = parts.some((p) => p.inferred);

  return (
    <span className="crm-mute crm-num" style={{ fontSize: 11 }}
      title={anyInferred ? `~ = going by the flat they opened (${basis}), not something they told us` : undefined}>
      {parts.map((p, i) => (
        <span key={i} style={p.inferred ? { color: C.gold } : undefined}>
          {i ? " · " : ""}{p.inferred ? "~" : ""}{p.text}
        </span>
      ))}
    </span>
  );
}

export default function CrmClientsPage() {
  const crm = useCrm();
  const {
    clients, requirements, inventory, engagement, shortlists, touches, settings, access, user, ownAnswers, interest, leads,
  } = crm;

  const [params, setParams] = useSearchParams();
  const selectedId = params.get("client") || "";

  const [q, setQ] = useState("");
  /**
   * Fresh leads | Contacted | No number.
   *
   * Fresh is anyone who gave us a number and has not heard from us; Contacted
   * is everyone we have reached out to. The third holds sign-ins with no
   * number — not leads, but kept visible rather than silently dropped, which
   * is what the old "Fresh leads" sort did and why the count shrank.
   */
  const [tab, setTab] = useState("fresh");
  const [freshSort, setFreshSort] = useState("site");
  const [contactedSort, setContactedSort] = useState("site");
  const [stageFilter, setStageFilter] = useState("");
  const [tempFilter, setTempFilter] = useState("");
  /** Extra filters on Contacted: quiet, dnp, mine, closed. Closed is hidden unless asked for. */
  const [extras, setExtras] = useState(() => new Set());
  const toggleExtra = (id) =>
    setExtras((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileTab, setMobileTab] = useState("list");
  const [localShortlists, setLocalShortlists] = useState(shortlists);
  const [reqDraft, setReqDraft] = useState(null);

  // Visits booked on listings whose lister published no times — somebody has to
  // arrange one, and nothing else on this screen would say so.

  useEffect(() => setLocalShortlists(shortlists), [shortlists]);

  const showToast = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const actorEmail = access.email;
  const agentName = user?.name || access.email?.split("@")[0] || "MovEazy";

  /* ── Lookups ───────────────────────────────────────────────────────────── */

  const reqByClient = useMemo(() => {
    const m = new Map();
    for (const r of requirements) m.set(r.client_id, r);
    return m;
  }, [requirements]);

  /**
   * What each client's opened flats say they want — a stand-in for anyone who
   * never finished Find My Flat. Never saved; only fills fields that are
   * otherwise empty, so real answers win the moment they exist.
   */
  const inferredByClient = useMemo(() => {
    const byId = new Map(inventory.map((l) => [l.property_id, l]));
    const m = new Map();
    for (const [clientId, signals] of groupInterestByClient(interest ?? [])) {
      const inferred = inferRequirement(signals, byId);
      if (inferred) m.set(clientId, inferred);
    }
    return m;
  }, [interest, inventory]);

  const engByUser = useMemo(() => {
    const m = new Map();
    for (const e of engagement) m.set(e.user_id, e);
    return m;
  }, [engagement]);

  /** What the client told us themselves — office + commute time — keyed by
   * user_id, the same lookup shape as engByUser above. */
  const ownAnswersByUser = useMemo(() => {
    const m = new Map();
    for (const a of ownAnswers ?? []) m.set(a.user_id, a);
    return m;
  }, [ownAnswers]);

  /**
   * Per client: have we contacted them, when did they last do something on
   * the site, and how far along are they. Derived, never stored — see
   * lib/crmLeadBuckets.js. localShortlists rather than the shell's copy, so a
   * flat sent from the Matches pane moves the lead out of Fresh at once.
   */
  const summaries = useMemo(
    () => summariseClients(clients, {
      activities: touches, shortlists: localShortlists, engagement, ownAnswers, leads, requirements, interest,
    }),
    [clients, touches, localShortlists, engagement, ownAnswers, leads, requirements, interest],
  );

  const bucketCounts = useMemo(() => {
    const n = { fresh: 0, contacted: 0, no_number: 0 };
    for (const c of clients) n[bucketOf(summaries.get(c.id))] += 1;
    return n;
  }, [clients, summaries]);

  const stageCounts = useMemo(() => {
    const n = Object.fromEntries(LEAD_STAGES.map((s) => [s.id, 0]));
    for (const c of clients) {
      const s = summaries.get(c.id);
      if (bucketOf(s) === "contacted" && !s.closed) n[s.stage] += 1;
    }
    return n;
  }, [clients, summaries]);

  /* ── The list ──────────────────────────────────────────────────────────── */

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // A search spans every tab: someone typing a phone number wants that
    // person wherever they are, not only if they happen to be under this tab.
    let rows = needle ? clients : clients.filter((c) => bucketOf(summaries.get(c.id)) === tab);

    if (needle) {
      rows = rows.filter((c) => {
        const req = reqByClient.get(c.id);
        const hay = [
          c.name, c.phone, c.email, c.note,
          ...(req?.localities ?? []),
          ...(inferredByClient.get(c.id)?.localities ?? []),
          ...(c.tags ?? []),
        ].join(" ").toLowerCase();
        return hay.includes(needle);
      });
    }
    if (tab === "contacted" && !needle) {
      // A closed lead needs no follow-up, so it stays out of the working list
      // unless asked for — otherwise every deal we ever closed sits in the way.
      rows = extras.has("closed")
        ? rows.filter((c) => summaries.get(c.id)?.closed)
        : rows.filter((c) => !summaries.get(c.id)?.closed);
      if (stageFilter) rows = rows.filter((c) => summaries.get(c.id)?.stage === stageFilter);
      if (tempFilter) {
        rows = tempFilter === "unset"
          ? rows.filter((c) => !c.temperature)
          : rows.filter((c) => c.temperature === tempFilter);
      }
      if (extras.has("quiet")) rows = rows.filter((c) => summaries.get(c.id)?.quiet);
      if (extras.has("dnp")) rows = rows.filter((c) => c.status === "dnp");
      if (extras.has("mine")) rows = rows.filter((c) => (c.assigned_to || "").toLowerCase() === actorEmail.toLowerCase());
    }

    return sortClients(rows, tab === "contacted" ? contactedSort : freshSort, summaries, {
      moveIn: (c) => moveInTs(reqByClient.get(c.id)?.move_in || ownAnswersByUser.get(c.user_id)?.notes?.moveInDate),
      due: (c) => shortlistDueTs(ownAnswersByUser.get(c.user_id)?.notes),
    });
  }, [clients, q, tab, freshSort, contactedSort, stageFilter, tempFilter, extras, summaries, reqByClient, actorEmail,
    ownAnswersByUser, inferredByClient]);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? visible[0] ?? null,
    [clients, selectedId, visible],
  );

  /* ── Requirement: DB row, or a blank one held locally until first save ──── */

  const storedReq = selected ? reqByClient.get(selected.id) : null;
  const requirement = useMemo(() => {
    if (reqDraft && reqDraft.__clientId === selected?.id) return reqDraft;
    return { ...EMPTY_REQ, ...(storedReq ?? {}) };
  }, [reqDraft, storedReq, selected?.id]);

  useEffect(() => setReqDraft(null), [selected?.id]);

  /**
   * Edits re-rank the matches immediately and save behind that — waiting on a
   * round trip before re-scoring would make the pane feel broken.
   */
  const handleRequirementChange = useCallback(
    (next) => {
      if (!selected) return;
      setReqDraft({ ...next, __clientId: selected.id });
      saveClientRequirement(selected.id, next, { actorEmail })
        .then((saved) => {
          crm.setData((d) => ({
            ...d,
            requirements: [...d.requirements.filter((r) => r.client_id !== selected.id), saved],
          }));
        })
        .catch((e) => showToast(e?.message || "Could not save the requirement", "error"));
    },
    [selected, actorEmail, crm, showToast],
  );

  const handleRequirementReset = useCallback(async () => {
    if (!selected) return;
    try {
      const saved = await resetClientRequirement(selected.id, selected.user_id, { actorEmail });
      setReqDraft(null);
      crm.setData((d) => ({
        ...d,
        requirements: [...d.requirements.filter((r) => r.client_id !== selected.id), saved],
      }));
      showToast("Back to what the client told us");
    } catch (e) {
      showToast(e?.message || "Could not reset", "error");
    }
  }, [selected, actorEmail, crm, showToast]);

  const refreshShortlists = useCallback(async () => {
    setLocalShortlists(await fetchShortlists());
  }, []);

  // Manual stand-in for a live signup→CRM sync — see the doc comment on
  // syncClientsFromSignups for why this is a button and not a trigger.
  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { created, failures } = await syncClientsFromSignups({ actorEmail });
      await crm.reload();
      if (failures.length) {
        showToast(`${created} added, ${failures.length} failed`, "error");
      } else {
        showToast(created ? `${created} new client${created === 1 ? "" : "s"} added` : "Already up to date");
      }
    } catch (e) {
      showToast(e?.message || "Could not sync user data", "error");
    } finally {
      setSyncing(false);
    }
  }, [actorEmail, crm, showToast]);

  /**
   * A contact just logged from this screen, folded into the loaded activity so
   * the lead re-buckets now. Without it a lead messaged from its record stayed
   * under Fresh until the next reload — the list most likely to be worked
   * straight down, showing someone already handled.
   */
  const recordContact = useCallback((clientId, type) => {
    crm.setData((d) => ({
      ...d,
      touches: [{ client_id: clientId, actor_email: actorEmail, type, created_at: new Date().toISOString() },
        ...(d.touches ?? [])],
    }));
  }, [crm, actorEmail]);

  const handleMarkContacted = useCallback(async (clientId) => {
    try {
      await markContacted(clientId, { actorEmail });
      recordContact(clientId, "contacted");
      showToast("Moved to Contacted");
    } catch (e) {
      showToast(e?.message || "Could not mark as contacted", "error");
    }
  }, [actorEmail, recordContact, showToast]);

  const select = (id) => {
    setParams({ client: id }, { replace: true });
    setMobileTab("record");
  };

  const isNarrow = typeof window !== "undefined" && window.innerWidth < 900;

  /* ── Panes ─────────────────────────────────────────────────────────────── */

  const listPane = (
    <div className="crm-col" style={{ width: isNarrow ? "100%" : 248, flex: isNarrow ? 1 : "none" }}>
      <div className="crm-colhead">
        <span className="crm-label">Clients · {clients.length}</span>
        {access.has(SCOPES.CLIENTS_WRITE) && (
          <div style={{ display: "flex", gap: 5 }}>
            <Btn sm onClick={() => { setAdding((v) => !v); setImporting(false); }}>
              {adding ? "Close" : "+ New"}
            </Btn>
            <Btn sm onClick={() => { setImporting((v) => !v); setAdding(false); }}>
              {importing ? "Close" : "Import"}
            </Btn>
            <Btn sm onClick={handleSync} disabled={syncing} title="Add any signed-up user with a mobile number who is not already in the CRM">
              {syncing ? "Syncing…" : "Sync users"}
            </Btn>
          </div>
        )}
      </div>

      {adding && (
        <NewClientForm
          actorEmail={actorEmail}
          onToast={showToast}
          onCancel={() => setAdding(false)}
          onCreated={(row) => {
            crm.setData((d) => ({ ...d, clients: [row, ...d.clients] }));
            setAdding(false);
            select(row.id);
            showToast("Client added");
          }}
        />
      )}

      {importing && (
        <ImportPanel
          actorEmail={actorEmail}
          onToast={showToast}
          onCancel={() => setImporting(false)}
          onDone={(n) => { crm.reload(); showToast(`${n} leads imported`); }}
        />
      )}

      <div style={{ padding: "9px 12px 6px", display: "flex", flexDirection: "column", gap: 7, flex: "none" }}>
        <input className="crm-input" placeholder="Search every tab: name, phone, area…" value={q}
          onChange={(e) => setQ(e.target.value)} />

        {/* The three buckets. Counts are always the whole bucket, so a filter
            below never makes it look as if leads have gone missing. */}
        <div role="tablist" style={{ display: "flex", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          {[
            ["fresh", "Fresh", "A number, and nobody from MovEazy has contacted them"],
            ["contacted", "Contacted", "Everyone we have reached out to"],
            ["no_number", "No no.", "Signed in, never gave a number — not a lead"],
          ].map(([id, label, hint]) => {
            const on = tab === id;
            return (
              <button
                key={id} type="button" role="tab" aria-selected={on} title={hint}
                onClick={() => setTab(id)}
                style={{
                  flex: id === "no_number" ? "0 0 auto" : 1, padding: "6px 6px", border: "none", cursor: "pointer",
                  font: "inherit", fontSize: 11.5, fontWeight: 700,
                  background: on ? C.accent : C.surface, color: on ? "#fff" : id === "no_number" ? C.textMute : C.text,
                  borderLeft: id === "fresh" ? "none" : `1px solid ${C.line}`,
                }}
              >
                {label} <span style={{ opacity: 0.8, fontWeight: 600 }}>{bucketCounts[id]}</span>
              </button>
            );
          })}
        </div>

        {!q.trim() && tab !== "no_number" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="crm-label" style={{ flex: "none" }}>Sort</span>
            {tab === "fresh" ? (
              <select className="crm-input" value={freshSort} onChange={(e) => setFreshSort(e.target.value)}>
                {FRESH_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            ) : (
              <select className="crm-input" value={contactedSort} onChange={(e) => setContactedSort(e.target.value)}>
                {CONTACTED_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
          </label>
        )}
      </div>

      {q.trim() && (
        <div className="crm-mute" style={{ padding: "0 12px 8px", fontSize: 11 }}>
          Searching all tabs · {visible.length} found
        </div>
      )}

      {!q.trim() && tab === "fresh" && (
        <div className="crm-mute" style={{ padding: "0 12px 8px", fontSize: 11, lineHeight: 1.45 }}>
          Gave us a number, not contacted yet. Messaging, calling or sending a flat moves them to Contacted.
        </div>
      )}

      {!q.trim() && tab === "no_number" && (
        <div className="crm-mute" style={{ padding: "0 12px 8px", fontSize: 11, lineHeight: 1.45 }}>
          Signed in without a mobile number. Not leads — they move to Fresh the moment they add one.
        </div>
      )}

      {!q.trim() && tab === "contacted" && (
        <>
          {/* Where they have got to. Exclusive: each lead sits at the furthest
              stage reached, so these add up to the tab. */}
          <div style={{ padding: "0 12px 6px", display: "flex", gap: 5, flexWrap: "wrap", flex: "none" }}>
            {LEAD_STAGES.map((s) => (
              <Chip key={s.id} on={stageFilter === s.id} title={s.hint}
                onClick={() => setStageFilter(stageFilter === s.id ? "" : s.id)}>
                {s.label} <span style={{ opacity: 0.7 }}>{stageCounts[s.id]}</span>
              </Chip>
            ))}
          </div>

          <div style={{ padding: "0 12px 6px", display: "flex", gap: 5, flexWrap: "wrap", flex: "none" }}>
            {TEMPERATURES.map((t) => (
              <Chip key={t.id} on={tempFilter === t.id} title={t.hint}
                onClick={() => setTempFilter(tempFilter === t.id ? "" : t.id)}
                style={tempFilter === t.id ? { borderColor: t.color, color: t.color, background: `${t.color}18` } : undefined}>
                <TempDot color={t.color} />
                {t.label}
              </Chip>
            ))}
            <Chip on={tempFilter === "unset"} onClick={() => setTempFilter(tempFilter === "unset" ? "" : "unset")}>
              Unset
            </Chip>
          </div>

          <div style={{ padding: "0 12px 9px", display: "flex", gap: 5, flexWrap: "wrap", flex: "none" }}>
            <Chip on={extras.has("quiet")} onClick={() => toggleExtra("quiet")}
              title={`Nothing from us in ${QUIET_AFTER_DAYS}+ days`}>
              Going quiet
            </Chip>
            <Chip on={extras.has("dnp")} onClick={() => toggleExtra("dnp")} title="Did not pick">DNP</Chip>
            <Chip on={extras.has("mine")} onClick={() => toggleExtra("mine")}>Mine</Chip>
            <Chip on={extras.has("closed")} onClick={() => toggleExtra("closed")} title="Closed by us or outside — hidden otherwise">
              Closed
            </Chip>
            {(stageFilter || tempFilter || extras.size > 0) && (
              <Chip onClick={() => { setStageFilter(""); setTempFilter(""); setExtras(new Set()); }}>Clear</Chip>
            )}
          </div>
        </>
      )}

      <div className="crm-scroll" style={{ flex: 1 }}>
        {visible.length === 0 && (
          <Empty>
            {q.trim() ? "Nobody matches that."
              : tab === "fresh" ? "No fresh leads — everyone who left a number has been contacted."
                : "Nobody matches those filters."}
          </Empty>
        )}
        {visible.map((c) => {
          const e = engByUser.get(c.user_id);
          const sm = summaries.get(c.id);
          const bucket = bucketOf(sm);
          const req = reqByClient.get(c.id);
          const deadline = deadlineLabel(ownAnswersByUser.get(c.user_id)?.notes);
          return (
            <button key={c.id} type="button" onClick={() => select(c.id)}
              className={c.id === selected?.id ? "crm-lead crm-lead--on" : "crm-lead"}>
              <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <TempDot color={c.temperature ? tempColor(c.temperature) : C.line} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name || c.email || "Unnamed"}
                  </span>
                </span>
                <span className="crm-mute crm-num" style={{ fontSize: 11, flex: "none" }}>
                  {req?.move_in ? shortDate(req.move_in) === "—" ? req.move_in : shortDate(req.move_in) : "—"}
                </span>
              </span>
              <ClientFactsLine
                facts={effectiveFacts(req, ownAnswersByUser.get(c.user_id), inferredByClient.get(c.id))}
                basis={basisLabel(inferredByClient.get(c.id))}
              />
              <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
                {/* The clock the list is sorted by comes first. Sorting by
                    "Newest lead" while showing "on site 45h ago" made a correct
                    sort look broken: those are different moments, and a lead
                    who arrived an hour ago can last have done anything days
                    back. So a Fresh row always says when it became a lead. */}
                {bucket === "fresh" && c.created_at ? `lead ${agoLabel(new Date(c.created_at).getTime())}` : ""}
                {bucket === "fresh" && c.created_at ? " · " : ""}
                {sm?.lastSiteActionAt ? `on site ${agoLabel(sm.lastSiteActionAt)}` : "never on site"}
                {bucket === "contacted" && sm?.lastContactAt ? ` · us ${agoLabel(sm.lastContactAt)}` : ""}
              </span>
              <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
                {bucket === "contacted"
                  ? LEAD_STAGES.find((st) => st.id === sm?.stage)?.label
                  : statusLabel(c.status)}
                {c.status === "dnp" && c.dnp_count > 0 ? ` · DNP ×${c.dnp_count}` : ""}
                {e ? ` · ${e.session_count} opens · ${formatDuration(e.total_seconds)}` : ""}
                {q.trim() && (
                  <span style={{ color: C.accent, fontWeight: 700 }}>
                    {" "}· {bucket === "fresh" ? "Fresh" : bucket === "contacted" ? "Contacted" : "No number"}
                  </span>
                )}
              </span>
              {deadline && (
                <span
                  className="crm-num"
                  style={{ fontSize: 10.5, fontWeight: 700, color: deadline.startsWith("overdue") ? C.coral : C.gold }}
                >
                  Shortlist {deadline}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!selected) {
    return (
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {listPane}
        <div style={{ flex: 1, display: "grid", placeItems: "center" }}>
          <Empty>No clients yet. Add one, or run the backfill in crm_schema.sql.</Empty>
        </div>
        <Toast {...(toast ?? {})} />
      </div>
    );
  }


  const recordPane = (
    <ClientRecord
      key={selected.id}
      client={selected}
      requirement={requirement}
      isOverride={Boolean(storedReq)}
      engagement={engByUser.get(selected.user_id)}
      ownAnswers={ownAnswersByUser.get(selected.user_id)}
      inferred={inferredByClient.get(selected.id)}
      isFreshLead={bucketOf(summaries.get(selected.id)) === "fresh"}
      onContactLogged={recordContact}
      onMarkContacted={handleMarkContacted}
      shortlists={localShortlists}
      inventory={inventory}
      settings={settings}
      access={access}
      actorEmail={actorEmail}
      agentName={agentName}
      onPatch={crm.patchClient}
      onRequirementChange={handleRequirementChange}
      onRequirementReset={handleRequirementReset}
      onToast={showToast}
    />
  );

  // With nothing stated, match on what their opened flats imply rather than
  // show an empty pane — the pane says so, so it isn't mistaken for a brief.
  const selectedInferred = selected ? inferredByClient.get(selected.id) : null;
  const matchRequirement = requirementForMatching(requirement, selectedInferred);

  const matchesPane = (
    <MatchesPane
      client={selected}
      requirement={matchRequirement}
      inferredBasis={matchRequirement !== requirement ? basisLabel(selectedInferred) : ""}
      inventory={inventory}
      shortlists={localShortlists}
      settings={settings}
      access={access}
      actorEmail={actorEmail}
      agentName={agentName}
      onShortlistsChanged={refreshShortlists}
      onToast={showToast}
    />
  );

  if (isNarrow) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", gap: 5, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, flex: "none" }}>
          {[["list", "Clients"], ["record", "Record"], ["matches", "Matches"]].map(([id, label]) => (
            <Chip key={id} on={mobileTab === id} onClick={() => setMobileTab(id)}>{label}</Chip>
          ))}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {mobileTab === "list" && listPane}
          {mobileTab === "record" && recordPane}
          {mobileTab === "matches" && matchesPane}
        </div>
        <Toast {...(toast ?? {})} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {listPane}
        {recordPane}
        {matchesPane}
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
