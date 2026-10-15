/**
 * CRM → Priority closures: the clients the team works hardest, every day.
 *
 *   top      flat-type pools (1/2/3/4 BHK) and, in a pool, its rent brackets.
 *            A bracket picks both halves: flats renting within it (±2k) and
 *            clients whose max budget is within it (±2k). Each half can add
 *            more brackets of its own ("+ brackets").
 *   left     the clients: due a follow-up first, then hot ones. Call /
 *            WhatsApp (logged), Curate & send, the flats new since their last
 *            list, follow-up in 1 / 3 days or on a date, remove (now, or until
 *            a date). Tap one to see the flats for them on the right.
 *   right    the live flats — partners' "only me" ones too — with how many
 *            priority clients each went to and who liked it. With a client
 *            picked: their fits, what they were already sent, and a tray to
 *            send from.
 *   buttons  Suggested (who to add), This morning (fresh picks per client to
 *            review and send), Today (the scorecard), Scheduled (who joins on
 *            a later day).
 *
 * Rules and numbers: lib/crmPriority.js. Who is in: crm_priority.sql.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, CalendarClock, Flame, MessageCircle, Phone, Send, Sparkles, Sun, UserPlus, X } from "lucide-react";
import { useCrm } from "./CrmShell";
import { useClientReactions } from "./PropertyQuickView";
import { Btn, C, Chip, Empty, TempDot, Toast, inr, relTime, shortDate } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { fetchShortlists, logActivity, saveClientRequirement, tempColor } from "../../lib/crmClients";
import { buildTemplateVars, renderTemplate, whatsappUrl } from "../../lib/crmSettings";
import { effectiveFacts, groupInterestByClient, inferRequirement, requirementForMatching } from "../../lib/crmPropertyInterest";
import { summariseClients } from "../../lib/crmLeadBuckets";
import { scoreMatch } from "../../lib/inventoryMatch";
import { describeSharing, fetchPartnerListingMap, telLink } from "../../lib/partners";
import {
  DAY, NO_BUDGET, POOLS, addToPriority, clientIn, fitsClient, flatIn, flatPool, followUp, freshFor, isHot, isSilent, lastSignal,
  morningPicks, placeClient, removeFromPriority, scorecard, sentTo, setFollowUp, suggestions,
} from "../../lib/crmPriority";

const CurateScreen = lazy(() => import("./CurateScreen"));

const EMPTY_REQ = {
  localities: [], budget_min: null, budget_max: null, flat_types: [], furnishing: "",
  must_haves: [], deal_breakers: [], occupants: [], move_in: "", min_score: 60, office_radius_km: 8,
};
const CLOSED = new Set(["closed_by_us", "closed_outside"]);
const ts = (d) => (d ? new Date(d).getTime() : 0);
const ALL = "all";
const dayInput = (d) => new Date(d).toISOString().slice(0, 10);
/** Every bracket of a pool, and "no budget given": the pool with no bracket picked. */
const allIds = (pool) => new Set([...(POOLS.find((x) => x.id === pool)?.brackets ?? []).map((b) => b.id), NO_BUDGET]);

export default function CrmPriorityPage() {
  const crm = useCrm();
  const { clients, requirements, inventory, shortlists, touches, ownAnswers, interest, settings, priority, access, user, phone } = crm;
  const canWrite = access.has(SCOPES.CLIENTS_WRITE);
  const actorEmail = access.email;
  const agentName = user?.name || access.email?.split("@")[0] || "MovEazy";
  // One clock per screen, moved on every 5 minutes, so the lists don't recompute on every render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5 * 60 * 1000); return () => clearInterval(t); }, []);

  const [pool, setPool] = useState(ALL);
  const [clientBr, setClientBr] = useState(() => new Set());
  const [flatBr, setFlatBr] = useState(() => new Set());
  const [view, setView] = useState("all");          // left filter
  const [flatView, setFlatView] = useState("all");  // right filter
  const [picked, setPicked] = useState("");         // client whose flats show on the right
  const [tray, setTray] = useState([]);             // flats chosen for them on the right
  const [curate, setCurate] = useState(null);       // { id, picks, label }
  const [panel, setPanel] = useState("");           // suggested | morning | today | scheduled
  const [side, setSide] = useState("clients");      // phone: which half
  const [toast, setToast] = useState(null);
  const say = useCallback((message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3000); }, []);

  /* ── Everyone, placed ─────────────────────────────────────────────────── */
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const reqBy = useMemo(() => new Map(requirements.map((r) => [r.client_id, r])), [requirements]);
  const ownBy = useMemo(() => new Map(ownAnswers.map((o) => [o.user_id, o])), [ownAnswers]);
  const invById = useMemo(() => new Map(inventory.map((l) => [l.property_id, l])), [inventory]);
  const interestBy = useMemo(() => groupInterestByClient(interest), [interest]);
  const live = useMemo(() => inventory.filter((l) => l.status === "published"), [inventory]);

  const rows = useMemo(() => (priority ?? []).filter((p) => clientById.has(p.client_id)), [priority, clientById]);
  const scheduled = useMemo(() => rows.filter((p) => ts(p.active_from) > now).sort((a, b) => ts(a.active_from) - ts(b.active_from)), [rows, now]);
  const activeIds = useMemo(() => new Set(rows.filter((p) => ts(p.active_from) <= now && !CLOSED.has(clientById.get(p.client_id)?.status)).map((p) => p.client_id)),
    [rows, now, clientById]);
  const priorityIds = useMemo(() => new Set(rows.map((p) => p.client_id)), [rows]);

  const summaries = useMemo(() => summariseClients(clients.filter((c) => activeIds.has(c.id)), { activities: touches, shortlists }),
    [clients, activeIds, touches, shortlists]);

  const people = useMemo(() => [...activeIds].map((id) => {
    const c = clientById.get(id);
    const own = c.user_id ? ownBy.get(c.user_id) : null;
    const stored = reqBy.get(id);
    const inferred = inferRequirement(interestBy.get(id) ?? [], invById);
    const facts = effectiveFacts(stored, own, inferred);
    const requirement = { ...EMPTY_REQ, ...(stored ?? {}) };
    const matchReq = requirementForMatching(requirement, inferred);
    // Matching on what we know: the requirement, else their own answers.
    const req = (stored && (stored.localities?.length || stored.budget_max)) ? matchReq
      : { ...matchReq, localities: facts.localities.value, flat_types: facts.flat_types.value, budget_min: facts.budget.min, budget_max: facts.budget.max };
    const placed = placeClient(facts);
    const lastContactAt = summaries.get(id)?.lastContactAt || 0;
    const signal = lastSignal(id, { shortlists, touches });
    const sent = sentTo(id, shortlists);
    const fresh = freshFor({ inventory: live, placed, req, sent, now });
    return {
      c, own, facts, requirement, req, placed, lastContactAt, signal, sent, fresh,
      fu: followUp(c, lastContactAt, now),
      hot: isHot(signal, now),
      silent: isSilent(signal, lastContactAt, now) && !(ts(c.next_follow_up_at) > now),
    };
  }), [activeIds, clientById, ownBy, reqBy, interestBy, invById, summaries, shortlists, touches, live, now]);

  /* ── The pool and brackets picked ─────────────────────────────────────── */
  const poolDef = POOLS.find((p) => p.id === pool);
  const pickBracket = (id) => {
    const on = clientBr.size === 1 && clientBr.has(id) && flatBr.size === 1 && flatBr.has(id);
    setClientBr(on ? new Set() : new Set([id]));
    setFlatBr(on ? new Set() : new Set([id]));
  };
  const toggleIn = (set, setter, id) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setter(n); };

  const inPoolClients = useMemo(() => people.filter((p) => {
    if (pool === ALL) return true;
    return clientIn(p.placed, pool, clientBr.size ? clientBr : allIds(pool));
  }), [people, pool, clientBr]);
  const inPoolFlats = useMemo(() => live.filter((l) => {
    if (pool === ALL) return true;
    return flatIn(l, pool, flatBr.size ? flatBr : allIds(pool));
  }), [live, pool, flatBr]);

  const counts = useMemo(() => {
    const out = {};
    for (const p of POOLS) {
      out[p.id] = { clients: people.filter((x) => x.placed.pools.includes(p.id)).length, flats: live.filter((l) => flatPool(l) === p.id).length };
      for (const b of p.brackets) {
        const one = new Set([b.id]);
        out[`${p.id}:${b.id}`] = { clients: people.filter((x) => clientIn(x.placed, p.id, one)).length, flats: live.filter((l) => flatIn(l, p.id, one)).length };
      }
    }
    return out;
  }, [people, live]);

  /* ── Left: clients ────────────────────────────────────────────────────── */
  const VIEWS = [
    ["all", "All", inPoolClients.length],
    ["due", "Due today", inPoolClients.filter((p) => p.fu.due).length],
    ["fresh", "New flats", inPoolClients.filter((p) => p.fresh.length).length],
    ["hot", "Hot", inPoolClients.filter((p) => p.hot).length],
    ["silent", "Silent 7d", inPoolClients.filter((p) => p.silent).length],
  ];
  const shownClients = useMemo(() => inPoolClients
    .filter((p) => view === "all" || (view === "due" && p.fu.due) || (view === "fresh" && p.fresh.length) || (view === "hot" && p.hot) || (view === "silent" && p.silent))
    .sort((a, b) => (Number(b.fu.overdue) - Number(a.fu.overdue)) || (Number(b.fu.due) - Number(a.fu.due)) || (Number(b.hot) - Number(a.hot))
      || ((b.signal?.at || 0) - (a.signal?.at || 0))), [inPoolClients, view]);

  const pickedP = people.find((p) => p.c.id === picked) ?? null;

  /* ── Right: flats ─────────────────────────────────────────────────────── */
  // Partner flats: whose, and whether they're shared or "only them".
  const [partnerMap, setPartnerMap] = useState({});
  const liveKey = live.length;
  useEffect(() => {
    let alive = true;
    fetchPartnerListingMap(live.map((l) => l.property_id)).then((m) => alive && setPartnerMap(m ?? {}), () => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  const reach = useMemo(() => {
    const m = new Map();
    for (const s of shortlists) {
      if (!activeIds.has(s.client_id) || !s.shared_at) continue;
      const r = m.get(s.property_id) ?? { sent: 0, liked: 0 };
      r.sent += 1;
      if (s.status === "liked" || s.status === "visit_scheduled") r.liked += 1;
      m.set(s.property_id, r);
    }
    return m;
  }, [shortlists, activeIds]);
  const shownFlats = useMemo(() => {
    let list = pickedP ? live.filter((l) => fitsClient(l, pickedP.placed, pickedP.req)) : inPoolFlats;
    if (flatView === "fresh") list = list.filter((l) => now - ts(l.created_at) < DAY);
    if (flatView === "unsent") list = list.filter((l) => (pickedP ? !pickedP.sent.ids.has(l.property_id) : !reach.has(l.property_id)));
    const score = (l) => (pickedP ? scoreMatch(l, pickedP.req).score : 0);
    return [...list].sort((a, b) => score(b) - score(a) || ts(b.created_at) - ts(a.created_at)).slice(0, 300);
  }, [pickedP, live, inPoolFlats, flatView, reach, now]);

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const logged = (clientId, type) => crm.setData((d) => ({
    ...d, touches: [{ client_id: clientId, actor_email: actorEmail, type, created_at: new Date().toISOString() }, ...(d.touches ?? [])],
  }));
  const contact = async (p, type) => {
    if (!p.c.phone) return say("No phone number on this client", "error");
    if (type === "whatsapp") {
      const tpl = (settings?.templates ?? []).find((t) => t.id === settings?.defaultTemplateId) ?? settings?.templates?.[0];
      window.open(whatsappUrl(p.c.phone, renderTemplate(tpl?.body ?? "", buildTemplateVars({ client: p.c, requirement: p.requirement, agentName }))), "_blank", "noopener");
    } else {
      window.location.href = telLink(p.c.phone);
    }
    if (!canWrite) return;
    try {
      await logActivity(p.c.id, { type, body: type === "call" ? "Called · Priority closures" : "Opened WhatsApp · Priority closures", actorEmail });
      logged(p.c.id, type);
    } catch (e) { say(e?.message || "Couldn't log it", "error"); }
  };
  const followUpOn = async (p, at) => {
    try {
      crm.patchClient(await setFollowUp(p.c.id, at));
      say(at ? `Follow up ${shortDate(at)}` : "Follow-up date cleared");
    } catch (e) { say(e?.message || "Couldn't set the follow-up", "error"); }
  };
  const reloadPriority = async () => {
    const { fetchPriority } = await import("../../lib/crmPriority");
    const rowsNow = await fetchPriority();
    crm.setData((d) => ({ ...d, priority: rowsNow }));
  };
  const add = async (ids, from = null) => {
    try {
      const n = await addToPriority(ids, from);
      await reloadPriority();
      say(from ? `${n} will join on ${shortDate(from)}` : `${n} added to Priority closures`);
    } catch (e) { say(e?.message || "Couldn't add", "error"); }
  };
  const remove = async (p, backOn = null) => {
    try {
      await removeFromPriority(p.c.id, backOn);
      await reloadPriority();
      if (picked === p.c.id) setPicked("");
      say(backOn ? `${p.c.name || "Client"} comes back on ${shortDate(backOn)}` : `${p.c.name || "Client"} removed`);
    } catch (e) { say(e?.message || "Couldn't remove", "error"); }
  };
  const openCurate = (p, picks = null, label = "") => setCurate({ id: p.c.id, picks, label });

  /* ── Layout ───────────────────────────────────────────────────────────── */
  const left = (
    <div className="crm-col crm-fill" style={{ flex: 1, minWidth: 0 }}>
      <div className="crm-colhead crm-wrap" style={{ gap: 6 }}>
        <span className="crm-label">Clients · {shownClients.length}</span>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {VIEWS.map(([id, label, n]) => <Chip key={id} on={view === id} onClick={() => setView(id)}>{label} · {n}</Chip>)}
        </div>
      </div>
      {pool !== ALL && poolDef.brackets.length > 1 && (
        <MoreBrackets pool={poolDef} picked={clientBr} counts={counts} kind="clients" onToggle={(id) => toggleIn(clientBr, setClientBr, id)} />
      )}
      <div className="crm-scroll" style={{ flex: 1, padding: 10 }}>
        {people.length === 0 ? (
          <Empty>No one in Priority closures yet. Add clients from Suggested, from a client&apos;s record, or tick several in Clients.</Empty>
        ) : shownClients.length === 0 ? <Empty>Nobody here.</Empty> : shownClients.map((p) => (
          <ClientCard key={p.c.id} p={p} on={picked === p.c.id} now={now} canWrite={canWrite}
            onPick={() => { setPicked(picked === p.c.id ? "" : p.c.id); setTray([]); if (phone) setSide("flats"); }}
            onContact={(type) => contact(p, type)} onCurate={() => openCurate(p)}
            onFresh={() => openCurate(p, p.fresh.slice(0, 10).map((l) => l.property_id), `${Math.min(10, p.fresh.length)} new since the last list`)}
            onFollowUp={(at) => followUpOn(p, at)} onRemove={(backOn) => remove(p, backOn)} />
        ))}
      </div>
    </div>
  );

  const right = (
    <div className="crm-col crm-fill" style={{ flex: 1, minWidth: 0 }}>
      <div className="crm-colhead crm-wrap" style={{ gap: 6 }}>
        <span className="crm-label">{pickedP ? `Flats for ${pickedP.c.name || "this client"}` : "Flats"} · {shownFlats.length}</span>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[["all", "All"], ["fresh", "Added today"], ["unsent", pickedP ? "Not sent to them" : "Not sent to anyone"]].map(([id, label]) => (
            <Chip key={id} on={flatView === id} onClick={() => setFlatView(id)}>{label}</Chip>
          ))}
          {pickedP && <Chip onClick={() => { setPicked(""); setTray([]); }}>× Back to the bracket</Chip>}
        </div>
      </div>
      {!pickedP && pool !== ALL && poolDef.brackets.length > 1 && (
        <MoreBrackets pool={poolDef} picked={flatBr} counts={counts} kind="flats" onToggle={(id) => toggleIn(flatBr, setFlatBr, id)} />
      )}
      {pickedP && tray.length > 0 && (
        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8, background: C.accentSoft }}>
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{tray.length} picked for {pickedP.c.name || "them"}</span>
          <Btn sm onClick={() => setTray([])}>Clear</Btn>
          <Btn sm variant="primary" onClick={() => openCurate(pickedP, tray, `${tray.length} picked in Priority closures`)}><Send size={13} /> Curate & send</Btn>
        </div>
      )}
      <div className="crm-scroll" style={{ flex: 1, padding: 10 }}>
        {shownFlats.length === 0 ? <Empty>No live flats here.</Empty> : shownFlats.map((l) => (
          <FlatRow key={l.property_id} l={l} reach={reach.get(l.property_id)} partner={partnerMap[l.property_id]}
            forClient={pickedP} sentToThem={pickedP?.sent.ids.has(l.property_id)} inTray={tray.includes(l.property_id)}
            onTray={() => setTray((t) => (t.includes(l.property_id) ? t.filter((x) => x !== l.property_id) : [...t, l.property_id]))} now={now} />
        ))}
      </div>
    </div>
  );

  const curateP = curate ? people.find((p) => p.c.id === curate.id) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead crm-wrap" style={{ gap: 8 }}>
        <span className="crm-label">Priority closures · {people.length}</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn sm onClick={() => setPanel("suggested")}><UserPlus size={13} /> Suggested</Btn>
          <Btn sm onClick={() => setPanel("morning")}><Sun size={13} /> This morning</Btn>
          <Btn sm onClick={() => setPanel("today")}><BarChart3 size={13} /> Today</Btn>
          <Btn sm onClick={() => setPanel("scheduled")}><CalendarClock size={13} /> Scheduled · {scheduled.length}</Btn>
        </div>
      </div>

      {/* Flat type, then its brackets: a bracket picks both halves at once. */}
      <div style={{ padding: "10px 12px 6px", borderBottom: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 8, flex: "none" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip on={pool === ALL} onClick={() => { setPool(ALL); setClientBr(new Set()); setFlatBr(new Set()); }}>All types · {people.length}</Chip>
          {POOLS.map((p) => (
            <Chip key={p.id} on={pool === p.id} onClick={() => { setPool(p.id); setClientBr(new Set()); setFlatBr(new Set()); setPicked(""); }}>
              {p.label} · {counts[p.id].clients} clients · {counts[p.id].flats} flats
            </Chip>
          ))}
        </div>
        {pool !== ALL && poolDef.brackets.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {poolDef.brackets.map((b) => {
              const n = counts[`${pool}:${b.id}`];
              const on = clientBr.has(b.id) && flatBr.has(b.id);
              return (
                <button key={b.id} type="button" onClick={() => pickBracket(b.id)}
                  className={on ? "crm-chip crm-chip--on" : "crm-chip"} style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, borderRadius: 10, padding: "5px 11px" }}>
                  <b style={{ fontSize: 12.5 }}>{b.label}</b>
                  <span style={{ fontSize: 10.5, opacity: 0.8 }}>{n.clients} clients · {n.flats} flats</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {phone ? (
        <>
          <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderBottom: `1px solid ${C.line}` }}>
            <Chip on={side === "clients"} onClick={() => setSide("clients")}>Clients · {shownClients.length}</Chip>
            <Chip on={side === "flats"} onClick={() => setSide("flats")}>Flats · {shownFlats.length}</Chip>
          </div>
          {side === "clients" ? left : right}
        </>
      ) : (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>{left}{right}</div>
      )}

      {panel && (
        <Panel title={{ suggested: "Suggested for Priority closures", morning: "This morning's fresh flats", today: "Today", scheduled: "Joining on a later day" }[panel]}
          onClose={() => setPanel("")}>
          {panel === "suggested" && (
            <Suggested clients={clients} priorityIds={priorityIds} canWrite={canWrite} onAdd={add} now={now}
              signalOf={(id) => lastSignal(id, { shortlists, touches })}
              moveInOf={(c) => {
                const raw = reqBy.get(c.id)?.move_in || (c.user_id ? ownBy.get(c.user_id)?.notes?.moveInDate : "");
                const t = Date.parse(raw || "");
                return Number.isNaN(t) ? null : t;
              }} />
          )}
          {panel === "morning" && (
            <Morning people={people} live={live} now={now}
              onReview={(p, picks) => { setPanel(""); openCurate(p, picks.map((l) => l.property_id), `This morning's ${picks.length} fresh flat${picks.length === 1 ? "" : "s"}`); }} />
          )}
          {panel === "today" && <Today touches={touches} shortlists={shortlists} clients={clients} people={people} priorityIds={activeIds} now={now} />}
          {panel === "scheduled" && (
            <Scheduled rows={scheduled} clientById={clientById} canWrite={canWrite}
              onNow={(id) => add([id])} onRemove={(id) => remove({ c: clientById.get(id) })} />
          )}
        </Panel>
      )}

      {curate && curateP && (
        <Suspense fallback={null}>
          <CurateFor p={curateP} picks={curate.picks} label={curate.label} inventory={inventory} shortlists={shortlists} access={access}
            settings={settings} actorEmail={actorEmail} agentName={agentName} crm={crm} say={say}
            onClose={() => { setCurate(null); setTray([]); }} />
        </Suspense>
      )}
      <Toast {...(toast ?? {})} />
    </div>
  );
}

/** "+ brackets" on one half: add neighbouring brackets to just that side. */
function MoreBrackets({ pool, picked, counts, kind, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "6px 12px", borderBottom: `1px solid ${C.lineSoft}`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", flex: "none" }}>
      <Btn sm onClick={() => setOpen((v) => !v)}>{open ? "Done" : `+ ${kind === "clients" ? "Clients" : "Flats"} from more brackets`}</Btn>
      {!open && picked.size > 1 && <span className="crm-mute" style={{ fontSize: 11 }}>{picked.size} brackets</span>}
      {open && pool.brackets.map((b) => (
        <Chip key={b.id} on={picked.has(b.id)} onClick={() => onToggle(b.id)}>
          {b.label} · {counts[`${pool.id}:${b.id}`][kind]}
        </Chip>
      ))}
    </div>
  );
}

function ClientCard({ p, on, now, canWrite, onPick, onContact, onCurate, onFresh, onFollowUp, onRemove }) {
  const { c, facts, fu, signal, hot, silent, fresh, sent } = p;
  const [more, setMore] = useState(false);
  const [date, setDate] = useState(() => dayInput(now + 2 * DAY));
  const types = facts.flat_types.value.join("/") || "Type not set";
  const budget = facts.budget.max ? `up to ${inr(facts.budget.max)}` : facts.budget.min ? `from ${inr(facts.budget.min)}` : "budget not set";
  const areas = facts.localities.value.slice(0, 3).join(", ");
  return (
    <div className="crm-card" style={{ marginBottom: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6,
      borderColor: on ? C.accent : fu.overdue ? "#E8C4BC" : C.line, background: on ? C.accentSoft : C.bg }}>
      <button type="button" onClick={onPick} style={{ textAlign: "left", width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TempDot color={c.temperature ? tempColor(c.temperature) : null} />
          <b style={{ fontSize: 13.5 }}>{c.name || "Client"}</b>
          <span className="crm-mute crm-num" style={{ fontSize: 11 }}>{c.phone}</span>
          {hot && <Flame size={14} color={C.coral} aria-label="Hot" />}
        </span>
        <span className="crm-dim" style={{ fontSize: 12 }}>{[types, budget, areas].filter(Boolean).join(" · ")}</span>
      </button>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <span className={fu.due ? (fu.overdue ? "crm-chip crm-chip--bad" : "crm-chip crm-chip--warn") : "crm-chip"} style={{ pointerEvents: "none" }}>{fu.why}</span>
        {signal && <span className="crm-chip" style={{ pointerEvents: "none" }}>{signal.label} · {relTime(signal.at)}</span>}
        {silent && <span className="crm-chip crm-chip--bad" style={{ pointerEvents: "none" }}>Silent 7 days</span>}
        {sent.ids.size > 0 && <span className="crm-chip" style={{ pointerEvents: "none" }}>{sent.ids.size} sent · last {relTime(sent.last)}</span>}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        <Btn sm variant="call" onClick={() => onContact("call")}><Phone size={12} /> Call</Btn>
        <Btn sm variant="wa" onClick={() => onContact("whatsapp")}><MessageCircle size={12} /> WhatsApp</Btn>
        {canWrite && <Btn sm variant="primary" onClick={onCurate}><Send size={12} /> Curate & send</Btn>}
        {canWrite && fresh.length > 0 && <Btn sm onClick={onFresh}><Sparkles size={12} /> {fresh.length} new flat{fresh.length === 1 ? "" : "s"}</Btn>}
        <Link to={`/crm/clients?client=${c.id}`} className="crm-btn crm-btn--sm" style={{ textDecoration: "none" }}>Record</Link>
        {canWrite && <Btn sm onClick={() => setMore((v) => !v)}>{more ? "Less" : "Follow-up / remove"}</Btn>}
      </div>
      {more && canWrite && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6, borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <span className="crm-label">Follow up</span>
            <Btn sm onClick={() => onFollowUp(Date.now() + DAY)}>Tomorrow</Btn>
            <Btn sm onClick={() => onFollowUp(Date.now() + 3 * DAY)}>In 3 days</Btn>
            {silent && <Btn sm onClick={() => onFollowUp(Date.now() + 2 * DAY)}>Keep — try again in 2 days</Btn>}
            {c.next_follow_up_at && <Btn sm onClick={() => onFollowUp(null)}>Clear date</Btn>}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" className="crm-input" value={date} min={dayInput(now)} onChange={(e) => setDate(e.target.value)} style={{ width: 150 }} />
            <Btn sm onClick={() => onFollowUp(new Date(`${date}T10:00:00`))}>Follow up on this day</Btn>
            <Btn sm variant="danger" onClick={() => onRemove(new Date(`${date}T08:00:00`))}>Remove until this day</Btn>
            <Btn sm variant="danger" onClick={() => window.confirm(`Remove ${c.name || "this client"} from Priority closures?`) && onRemove(null)}><X size={12} /> Remove now</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function FlatRow({ l, reach, partner, forClient, sentToThem, inTray, onTray, now }) {
  const cover = l.cover_image_url || (l.images ?? [])[0];
  const fresh = now - ts(l.created_at) < DAY;
  return (
    <div className="crm-card" style={{ marginBottom: 8, padding: 8, display: "flex", gap: 10, alignItems: "center",
      opacity: sentToThem ? 0.55 : 1, borderColor: inTray ? C.accent : C.line, background: inTray ? C.accentSoft : C.bg }}>
      {cover ? <img src={cover} alt="" width="64" height="52" loading="lazy" style={{ borderRadius: 8, objectFit: "cover", flex: "none" }} />
        : <span style={{ width: 64, height: 52, borderRadius: 8, background: C.surfaceAlt, flex: "none" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[l.flat_type, l.area].filter(Boolean).join(" · ") || l.property_id}
        </div>
        <div className="crm-num" style={{ fontSize: 12 }}>{inr(l.rent)}{l.furnishing ? ` · ${l.furnishing}` : ""}</div>
        <div className="crm-mute" style={{ fontSize: 10.5, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span>{l.property_id}</span>
          <span style={fresh ? { color: C.accent, fontWeight: 700 } : undefined}>{fresh ? "Added today" : `added ${relTime(l.created_at)}`}</span>
          {partner && <span style={{ color: C.gold, fontWeight: 600 }}>Partner · {partner.broker?.name || "a partner"} · {describeSharing(partner)}</span>}
          {reach && <span>sent to {reach.sent} · liked by {reach.liked}</span>}
          {forClient && <span>{scoreMatch(l, forClient.req).score}% fit</span>}
        </div>
      </div>
      {forClient && (sentToThem
        ? <span className="crm-mute" style={{ fontSize: 11, flex: "none" }}>Sent</span>
        : <Btn sm variant={inTray ? "primary" : undefined} onClick={onTray}>{inTray ? "✓ Picked" : "+ Pick"}</Btn>)}
      <a className="crm-btn crm-btn--sm" href={`/property/${l.property_id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: "none" }}>Open</a>
    </div>
  );
}

function Panel({ title, onClose, children }) {
  return (
    <div role="dialog" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(16,34,30,.35)", display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)", height: "100%", background: C.bg, display: "flex", flexDirection: "column",
        boxShadow: "-12px 0 34px rgba(16,34,30,.18)" }}>
        <div className="crm-colhead"><b style={{ fontSize: 14 }}>{title}</b><Btn sm onClick={onClose}><X size={13} /> Close</Btn></div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function Suggested({ clients, priorityIds, canWrite, onAdd, signalOf, moveInOf, now }) {
  const list = useMemo(() => suggestions({ clients, priorityIds, signalOf, moveInOf }), [clients, priorityIds, signalOf, moveInOf]);
  const [from, setFrom] = useState("");
  if (!list.length) return <Empty>No suggestions right now: nobody hot, recently active or moving in within 30 days who isn&apos;t already in.</Empty>;
  return (
    <>
      <p className="crm-mute" style={{ margin: "0 0 10px", fontSize: 12 }}>On fire or hot, active on the site in the last 7 days, or moving in within 30 days — and not in Priority closures yet.</p>
      {canWrite && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <Btn sm variant="primary" onClick={() => onAdd(list.map((x) => x.c.id), from ? new Date(`${from}T08:00:00`) : null)}>Add all {list.length}</Btn>
          <span className="crm-mute" style={{ fontSize: 11 }}>from</span>
          <input type="date" className="crm-input" value={from} min={dayInput(now)} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          <span className="crm-mute" style={{ fontSize: 11 }}>{from ? "" : "(today)"}</span>
        </div>
      )}
      {list.map(({ c, why }) => (
        <div key={c.id} className="crm-row" style={{ padding: "8px 0" }}>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>{c.name || "Client"}</b> <span className="crm-mute crm-num" style={{ fontSize: 11 }}>{c.phone}</span>
            <div className="crm-dim" style={{ fontSize: 11.5 }}>{why.join(" · ")}</div>
          </div>
          {canWrite && <Btn sm onClick={() => onAdd([c.id], from ? new Date(`${from}T08:00:00`) : null)}>Add</Btn>}
        </div>
      ))}
    </>
  );
}

function Morning({ people, live, now, onReview }) {
  const list = useMemo(() => people
    .map((p) => ({ p, picks: morningPicks({ inventory: live, placed: p.placed, req: p.req, sent: p.sent, now }) }))
    .filter((x) => x.picks.length)
    .sort((a, b) => Number(b.p.hot) - Number(a.p.hot) || b.picks.length - a.picks.length), [people, live, now]);
  if (!list.length) return <Empty>No flat added in the last day fits a priority client yet.</Empty>;
  return (
    <>
      <p className="crm-mute" style={{ margin: "0 0 10px", fontSize: 12 }}>
        Flats added in the last 24 hours that fit each priority client and weren&apos;t sent to them — best fit first, up to 5 each. Review, then send.
      </p>
      {list.map(({ p, picks }) => (
        <div key={p.c.id} className="crm-card" style={{ marginBottom: 8, padding: 10 }}>
          <div className="crm-row" style={{ padding: 0 }}>
            <b style={{ fontSize: 13 }}>{p.c.name || "Client"}{p.hot ? " 🔥" : ""}</b>
            <Btn sm variant="primary" onClick={() => onReview(p, picks)}><Send size={12} /> Review & send {picks.length}</Btn>
          </div>
          <div className="crm-dim" style={{ fontSize: 11.5, marginTop: 4 }}>
            {picks.map((l) => `${[l.flat_type, l.area].filter(Boolean).join(" ")} ${inr(l.rent)}`).join(" · ")}
          </div>
        </div>
      ))}
    </>
  );
}

function Today({ touches, shortlists, clients, people, priorityIds, now }) {
  const card = useMemo(() => scorecard({ touches, shortlists, clients, priorityIds, now }), [touches, shortlists, clients, priorityIds, now]);
  const due = people.filter((p) => p.fu.due).length;
  const doneToday = people.filter((p) => p.lastContactAt && new Date(p.lastContactAt).toDateString() === new Date(now).toDateString()).length;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[["Contacted today", `${doneToday} / ${people.length}`], ["Still due today", due], ["Closed by us today", card.closures]].map(([k, v]) => (
          <div key={k} className="crm-card" style={{ padding: 10 }}>
            <div className="crm-label">{k}</div><div style={{ fontSize: 20, fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
      {card.agents.length === 0 ? <Empty pad={16}>Nobody has logged a call, WhatsApp or list today yet.</Empty> : (
        <table className="crm-table">
          <thead><tr><th>Agent</th><th>Clients contacted</th><th>Priority contacted</th><th>Lists sent</th></tr></thead>
          <tbody>{card.agents.map((a) => (
            <tr key={a.who}><td>{a.who.split("@")[0]}</td><td className="crm-num">{a.contacted}</td><td className="crm-num">{a.priority}</td><td className="crm-num">{a.lists}</td></tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

function Scheduled({ rows, clientById, canWrite, onNow, onRemove }) {
  if (!rows.length) return <Empty>Nobody is waiting to join. Add a client &quot;from a day&quot; (Suggested, their record, or Clients), or remove one &quot;until a day&quot;.</Empty>;
  return rows.map((r) => {
    const c = clientById.get(r.client_id);
    return (
      <div key={r.client_id} className="crm-row" style={{ padding: "8px 0" }}>
        <div>
          <b style={{ fontSize: 13 }}>{c?.name || "Client"}</b> <span className="crm-mute crm-num" style={{ fontSize: 11 }}>{c?.phone}</span>
          <div className="crm-dim" style={{ fontSize: 11.5 }}>Joins {shortDate(r.active_from)}{r.added_by ? ` · by ${r.added_by.split("@")[0]}` : ""}</div>
        </div>
        {canWrite && (
          <span style={{ display: "flex", gap: 5 }}>
            <Btn sm onClick={() => onNow(r.client_id)}>Add now</Btn>
            <Btn sm variant="danger" onClick={() => onRemove(r.client_id)}>Remove</Btn>
          </span>
        )}
      </div>
    );
  });
}

/** The curate screen for one priority client, with what it needs from the CRM. */
function CurateFor({ p, picks, label, inventory, shortlists, access, settings, actorEmail, agentName, crm, say, onClose }) {
  const reactions = useClientReactions(p.c.user_id);
  const [requirement, setRequirement] = useState(p.requirement);
  const onRequirementChange = (next) => {
    setRequirement(next);
    saveClientRequirement(p.c.id, next, { actorEmail })
      .then((saved) => crm.setData((d) => ({ ...d, requirements: [...d.requirements.filter((r) => r.client_id !== p.c.id), saved] })))
      .catch((e) => say(e?.message || "Could not save the requirement", "error"));
  };
  const patchListing = (pid, patch) => crm.setData((d) => ({ ...d, inventory: d.inventory.map((l) => (l.property_id === pid ? { ...l, ...patch } : l)) }));
  return (
    <CurateScreen
      key={p.c.id}
      client={p.c}
      requirement={requirement}
      rankBy={p.req}
      onRequirementChange={onRequirementChange}
      office={p.own?.office || null}
      inventory={inventory}
      shortlists={shortlists}
      reactions={reactions}
      access={access}
      settings={settings}
      actorEmail={actorEmail}
      agentName={agentName}
      onShortlistsChanged={async () => { const s = await fetchShortlists(); crm.setData((d) => ({ ...d, shortlists: s })); }}
      onPatchListing={patchListing}
      onToast={say}
      onClose={onClose}
      initialPicks={picks}
      initialLabel={label}
    />
  );
}
