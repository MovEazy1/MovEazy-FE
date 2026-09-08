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
  SORTS, STATUSES, TEMPERATURES, createClient, fetchShortlists,
  saveClientRequirement, resetClientRequirement, statusLabel, tempColor,
} from "../../lib/crmClients";
import { formatDuration } from "../../lib/sessionSync";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, TempDot, Toast, shortDate } from "./crmUi";

const EMPTY_REQ = {
  localities: [], budget_min: null, budget_max: null, flat_types: [], furnishing: "",
  must_haves: [], deal_breakers: [], occupants: [], move_in: "", min_score: 60,
};

/** "15 Oct 2026" and "ASAP" both mean something; only the first can be sorted. */
function moveInTs(raw) {
  const v = String(raw || "").trim();
  if (!v) return Number.POSITIVE_INFINITY;
  const t = Date.parse(v);
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER - 1 : t;
}

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

export default function CrmClientsPage() {
  const crm = useCrm();
  const { clients, requirements, inventory, engagement, shortlists, touches, settings, access, user } = crm;

  const [params, setParams] = useSearchParams();
  const selectedId = params.get("client") || "";

  const [q, setQ] = useState("");
  const [sort, setSort] = useState("move_in");
  const [statusFilter, setStatusFilter] = useState("");
  const [tempFilter, setTempFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);
  const [mobileTab, setMobileTab] = useState("list");
  const [localShortlists, setLocalShortlists] = useState(shortlists);
  const [reqDraft, setReqDraft] = useState(null);

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

  const engByUser = useMemo(() => {
    const m = new Map();
    for (const e of engagement) m.set(e.user_id, e);
    return m;
  }, [engagement]);

  /** Most recent activity per client — the "oldest untouched" sort. */
  const lastTouchByClient = useMemo(() => {
    const m = new Map();
    for (const t of touches) if (!m.has(t.client_id)) m.set(t.client_id, t.created_at);
    return m;
  }, [touches]);

  /* ── The list ──────────────────────────────────────────────────────────── */

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = clients;

    if (needle) {
      rows = rows.filter((c) => {
        const req = reqByClient.get(c.id);
        const hay = [
          c.name, c.phone, c.email, c.note,
          ...(req?.localities ?? []),
          ...(c.tags ?? []),
        ].join(" ").toLowerCase();
        return hay.includes(needle);
      });
    }
    if (statusFilter) rows = rows.filter((c) => c.status === statusFilter);
    if (tempFilter) {
      rows = tempFilter === "unset"
        ? rows.filter((c) => !c.temperature)
        : rows.filter((c) => c.temperature === tempFilter);
    }
    if (mineOnly) rows = rows.filter((c) => (c.assigned_to || "").toLowerCase() === actorEmail.toLowerCase());

    const eng = (c) => engByUser.get(c.user_id);
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sort) {
        case "time":
          return (eng(b)?.total_seconds ?? 0) - (eng(a)?.total_seconds ?? 0);
        case "opens":
          return (eng(b)?.session_count ?? 0) - (eng(a)?.session_count ?? 0);
        case "last_seen":
          return new Date(eng(b)?.last_seen_at ?? 0) - new Date(eng(a)?.last_seen_at ?? 0);
        case "untouched": {
          const at = lastTouchByClient.get(a.id) ?? a.created_at;
          const bt = lastTouchByClient.get(b.id) ?? b.created_at;
          return new Date(at) - new Date(bt);
        }
        case "move_in":
        default:
          return moveInTs(reqByClient.get(a.id)?.move_in) - moveInTs(reqByClient.get(b.id)?.move_in);
      }
    });
    return sorted;
  }, [clients, q, statusFilter, tempFilter, mineOnly, sort, reqByClient, engByUser, lastTouchByClient, actorEmail]);

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

  const select = (id) => {
    setParams({ client: id }, { replace: true });
    setMobileTab("record");
  };

  const isNarrow = typeof window !== "undefined" && window.innerWidth < 900;

  /* ── Panes ─────────────────────────────────────────────────────────────── */

  const listPane = (
    <div className="crm-col" style={{ width: isNarrow ? "100%" : 248, flex: isNarrow ? 1 : "none" }}>
      <div className="crm-colhead">
        <span className="crm-label">Clients · {visible.length}</span>
        {access.has(SCOPES.CLIENTS_WRITE) && (
          <Btn sm onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "+ New"}</Btn>
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

      <div style={{ padding: "9px 12px 6px", display: "flex", flexDirection: "column", gap: 7, flex: "none" }}>
        <input className="crm-input" placeholder="Search name, phone, area, note…" value={q}
          onChange={(e) => setQ(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="crm-label" style={{ flex: "none" }}>Sort</span>
          <select className="crm-input" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ padding: "0 12px 6px", display: "flex", gap: 5, flexWrap: "wrap", flex: "none" }}>
        <Chip on={mineOnly} onClick={() => setMineOnly((v) => !v)}>Mine</Chip>
        {STATUSES.map((s) => (
          <Chip key={s.id} on={statusFilter === s.id} title={s.hint}
            onClick={() => setStatusFilter(statusFilter === s.id ? "" : s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div style={{ padding: "0 12px 9px", display: "flex", gap: 5, flexWrap: "wrap", flex: "none" }}>
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

      <div className="crm-scroll" style={{ flex: 1 }}>
        {visible.length === 0 && <Empty>Nobody matches those filters.</Empty>}
        {visible.map((c) => {
          const e = engByUser.get(c.user_id);
          const req = reqByClient.get(c.id);
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
              <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
                {(req?.localities ?? []).slice(0, 2).join(", ") || "no area"}
                {req?.budget_max ? ` · ₹${Math.round(req.budget_max / 1000)}k` : ""}
                {(req?.flat_types ?? [])[0] ? ` · ${req.flat_types[0]}` : ""}
              </span>
              <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
                {statusLabel(c.status)}
                {c.status === "dnp" && c.dnp_count > 0 ? ` ×${c.dnp_count}` : ""}
                {e ? ` · ${e.session_count} opens · ${formatDuration(e.total_seconds)}` : ""}
              </span>
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

  const matchesPane = (
    <MatchesPane
      client={selected}
      requirement={requirement}
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
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {listPane}
      {recordPane}
      {matchesPane}
      <Toast {...(toast ?? {})} />
    </div>
  );
}
