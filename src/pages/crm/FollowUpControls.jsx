/**
 * Follow up and Assign partner, wherever a client shows in the CRM (lib/followUps.js,
 * crm_follow_ups.sql).
 *
 *   FollowUpActions     the two buttons — the next follow-up on the first — and their sheets
 *   FollowUpSheet       how the call went (an outcome), the next date (quick picks or a
 *                       day and time), a note, the owner. No active client goes without a
 *                       next date: only an outcome that ends the search may leave it empty.
 *   AssignPartnerSheet  pick one or more partners — those with flats in the client's areas
 *                       first — keep the ones they have or take it off them, then WhatsApp
 *                       each the client's details.
 *
 * Saving patches the shell's copy of the client, so every list shows it at once.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, MessageCircle, UserPlus, X } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip } from "./crmUi";
import { whatsappUrl } from "../../lib/crmSettings";
import { fetchBrokerActivity } from "../../lib/tenantViews";
import { expandAreas } from "../../data/preferenceOptions";
import {
  OUTCOMES, assignPartners, endsSearch, fetchFollowUpSettings, fetchPartnerPicker, partnerAssignMessage, quickPicks,
  saveFollowUp, suggestedNext, whenLabel,
} from "../../lib/followUps";

const pad = (n) => String(n).padStart(2, "0");
const dateOf = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const timeOf = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "10:00");
const label = { fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 6px" };

/** A right-hand sheet, like the tenant-view one. */
export function SideSheet({ title, onClose, children, footer }) {
  return (
    <div role="dialog" aria-label={title} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(16,34,30,.35)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(480px, 100%)", height: "100%", background: C.bg, display: "flex", flexDirection: "column", boxShadow: "-12px 0 34px rgba(16,34,30,.18)" }}>
        <div className="crm-colhead">
          <span className="crm-label" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer", color: C.textDim }}><X size={20} /></button>
        </div>
        <div className="crm-scroll" style={{ flex: 1, padding: 16, display: "grid", gap: 14, alignContent: "start" }}>{children}</div>
        {footer && <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>{footer}</div>}
      </div>
    </div>
  );
}

/** The team, for the owner picker (crm_team_emails). */
function useTeam() {
  const [team, setTeam] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchFollowUpSettings().then((s) => alive && setTeam(s?.team ?? []), () => {});
    return () => { alive = false; };
  }, []);
  return team;
}

export function FollowUpSheet({ client, onClose, onSaved }) {
  const team = useTeam();
  const [now] = useState(() => Date.now());
  const current = client.next_follow_up_at ? new Date(client.next_follow_up_at) : null;
  const [outcome, setOutcome] = useState("");
  const [day, setDay] = useState(dateOf(current));
  const [time, setTime] = useState(timeOf(current));
  const [note, setNote] = useState(client.follow_up_note || "");
  const [owner, setOwner] = useState(client.assigned_to || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const picks = useMemo(() => quickPicks(now), [now]);
  const ends = endsSearch(outcome);
  const nextAt = day ? new Date(`${day}T${time || "10:00"}`) : null;

  const pickOutcome = (id) => {
    setOutcome(id === outcome ? "" : id);
    if (id === outcome) return;
    if (endsSearch(id)) { setDay(""); return; }
    const s = suggestedNext(id, now);
    if (s) { setDay(dateOf(s)); setTime(timeOf(s)); }
  };

  const save = async () => {
    if (!ends && !nextAt) { setErr("Pick the next follow-up — every active client needs one."); return; }
    if (nextAt && Number.isNaN(nextAt.getTime())) { setErr("That date doesn't look right."); return; }
    setBusy(true);
    setErr("");
    try {
      const p = { note: note.trim(), next_at: ends && !day ? "" : nextAt };
      if (outcome) p.outcome = outcome;
      if ((owner || "") !== (client.assigned_to || "")) p.owner = owner;
      onSaved(await saveFollowUp(client.id, p), outcome);
    } catch (e) {
      setErr(e?.message || "Couldn't save. Please try again.");
      setBusy(false);
    }
  };

  return (
    <SideSheet title={`Follow up · ${client.name || "Client"}`} onClose={onClose}
      footer={<>
        {err && <span style={{ color: C.coral, fontSize: 12, marginRight: "auto", alignSelf: "center" }}>{err}</span>}
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Btn>
      </>}>
      <div className="crm-card" style={{ fontSize: 12.5, display: "grid", gap: 3 }}>
        <span><b>{client.name || "Client"}</b> <span className="crm-mute crm-num">{client.phone}</span></span>
        <span className="crm-mute">
          {[current ? `Next: ${whenLabel(current, now)}` : "No follow-up set",
            client.last_outcome ? `last call: ${OUTCOMES.find((o) => o.id === client.last_outcome)?.label ?? client.last_outcome}` : "",
            client.no_answer_streak > 1 ? `didn't pick up ${client.no_answer_streak}× in a row` : ""].filter(Boolean).join(" · ")}
        </span>
      </div>

      <div>
        <div style={label}>How did the call go?</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {OUTCOMES.map((o) => (
            <Chip key={o.id} on={outcome === o.id} onClick={() => pickOutcome(o.id)}
              style={outcome === o.id && o.next === "none" ? { borderColor: C.coral, color: C.coral, background: `${C.coral}14` } : undefined}>
              {o.label}
            </Chip>
          ))}
        </div>
        <div className="crm-mute" style={{ fontSize: 11, marginTop: 6 }}>
          {outcome === "not_picked" || outcome === "busy" ? `Back on tomorrow's list. ${client.no_answer_streak >= 2 ? "A third miss marks them Cold." : ""}`
            : outcome === "not_interested" ? "Marks them Ice — off the daily list."
            : outcome === "found_elsewhere" ? "Closes them as Closed outside · Found elsewhere."
            : outcome === "visit_booked" ? "Moves them to 1 visit + pending."
            : outcome ? "" : "Leave empty to just change the date, note or owner."}
        </div>
      </div>

      <div>
        <div style={label}>Next follow-up{ends ? " (optional)" : ""}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {picks.map((p) => (
            <Chip key={p.id} on={day === dateOf(p.at) && time === timeOf(p.at)} onClick={() => { setDay(dateOf(p.at)); setTime(timeOf(p.at)); }}>
              {p.label}
            </Chip>
          ))}
          {day && <Chip onClick={() => setDay("")}>Clear</Chip>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" className="crm-input" value={day} min={dateOf(new Date(now))} onChange={(e) => setDay(e.target.value)} style={{ flex: 1 }} />
          <input type="time" className="crm-input" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 120 }} />
        </div>
        {nextAt && !Number.isNaN(nextAt.getTime()) && <div className="crm-mute" style={{ fontSize: 11, marginTop: 5 }}>{whenLabel(nextAt, now)}</div>}
      </div>

      <div>
        <div style={label}>Note</div>
        <textarea className="crm-input" rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Call after salary on the 5th · wants 2 BHK near office" style={{ width: "100%", resize: "vertical" }} />
      </div>

      <div>
        <div style={label}>Owner</div>
        <select className="crm-input" value={owner} onChange={(e) => setOwner(e.target.value)} style={{ width: "100%" }}>
          <option value="">Nobody — on everyone's list</option>
          {[...new Set([...team, ...(client.assigned_to ? [client.assigned_to.toLowerCase()] : [])])].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
    </SideSheet>
  );
}

const norm = (s) => String(s || "").trim().toLowerCase();

export function AssignPartnerSheet({ client, areas = [], defaultReplace = false, onClose, onDone }) {
  const [partners, setPartners] = useState(null);
  const [current, setCurrent] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [replace, setReplace] = useState(defaultReplace);
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchPartnerPicker().then((r) => alive && setPartners(r), (e) => alive && (setPartners([]), setErr(e?.message || "Couldn't load the partners.")));
    fetchBrokerActivity(client.id).then((r) => alive && setCurrent((r ?? []).filter((b) => !b.removed_at)), () => {});
    return () => { alive = false; };
  }, [client.id]);

  const has = useMemo(() => new Set(current.map((b) => b.broker_id)), [current]);
  // "HSR" takes in HSR Layout, Kudlu Gate… (the CRM's area list).
  const wanted = useMemo(() => new Set(expandAreas(areas).map(norm)), [areas]);
  const list = useMemo(() => {
    const needle = norm(q);
    return (partners ?? [])
      .map((p) => ({ ...p, fits: (p.areas ?? []).filter((a) => wanted.has(norm(a))) }))
      .filter((p) => !needle || norm(p.name).includes(needle) || norm(p.agency).includes(needle) || (p.areas ?? []).some((a) => norm(a).includes(needle)))
      .sort((a, b) => (b.fits.length > 0) - (a.fits.length > 0) || a.open - b.open || a.name.localeCompare(b.name));
  }, [partners, q, wanted]);

  const toggle = (id) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const others = current.filter((b) => b.status !== "closed");

  const assign = async () => {
    if (!picked.size) { setErr("Pick at least one partner."); return; }
    // One partner: their WhatsApp opens in the click's own tab, before the popup blocker can object.
    const tab = picked.size === 1 ? window.open("about:blank", "_blank") : null;
    setBusy(true);
    setErr("");
    try {
      const r = await assignPartners(client.id, [...picked], { replace, note: note.trim() });
      const msgs = (r.added ?? []).map((a) => ({ ...a, url: whatsappUrl(a.phone, partnerAssignMessage({ partner: a.name, client: r.client, need: r.client?.need, note: note.trim() })) }));
      if (tab && msgs[0]?.url) tab.location.replace(msgs[0].url); else tab?.close();
      setDone({ ...r, msgs });
      onDone?.(r);
    } catch (e) {
      tab?.close();
      setErr(e?.message || "Couldn't assign. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SideSheet title={`Assigned · ${client.name || "Client"}`} onClose={onClose} footer={<Btn variant="primary" onClick={onClose}>Done</Btn>}>
        <div className="crm-card" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
          {done.msgs.length ? `${done.msgs.length} partner${done.msgs.length === 1 ? "" : "s"} assigned — each got an app notification.` : "They already had this client."}
          {done.removed ? ` Taken off ${done.removed} other partner${done.removed === 1 ? "" : "s"} (their history stays).` : ""}
        </div>
        {done.msgs.map((m) => (
          <div key={m.broker_id} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <span style={{ fontSize: 13 }}><b>{m.name}</b> <span className="crm-mute crm-num">{m.phone}</span></span>
            {m.url && <a className="crm-btn crm-btn--wa" href={m.url} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp details</a>}
          </div>
        ))}
      </SideSheet>
    );
  }

  return (
    <SideSheet title={`Assign partner · ${client.name || "Client"}`} onClose={onClose}
      footer={<>
        {err && <span style={{ color: C.coral, fontSize: 12, marginRight: "auto", alignSelf: "center" }}>{err}</span>}
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={busy || !picked.size} onClick={assign}>{busy ? "Assigning…" : `Assign${picked.size ? ` ${picked.size}` : ""}`}</Btn>
      </>}>
      {others.length > 0 && (
        <div className="crm-card" style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 12.5 }}>
            With {others.map((b) => b.broker_name).join(", ")} now.
          </span>
          <label style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "center" }}>
            <input type="radio" checked={!replace} onChange={() => setReplace(false)} /> Keep them too
          </label>
          <label style={{ display: "flex", gap: 8, fontSize: 12.5, alignItems: "center" }}>
            <input type="radio" checked={replace} onChange={() => setReplace(true)} /> Take it off them (their calls and notes stay on the record)
          </label>
        </div>
      )}
      <input className="crm-input" type="search" placeholder="Search partner, agency or area" value={q} onChange={(e) => setQ(e.target.value)} />
      {partners === null ? <span className="crm-mute" style={{ fontSize: 12 }}>Loading partners…</span> : list.length === 0 ? (
        <span className="crm-mute" style={{ fontSize: 12 }}>No approved partner matches.</span>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {list.map((p) => {
            const already = has.has(p.broker_id);
            const on = already || picked.has(p.broker_id);
            return (
              <label key={p.broker_id}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 9, cursor: already ? "default" : "pointer",
                  border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : C.surface, opacity: already ? 0.75 : 1 }}>
                <input type="checkbox" checked={on} disabled={already} onChange={() => toggle(p.broker_id)} style={{ marginTop: 3, accentColor: C.accent }} />
                <span style={{ minWidth: 0, flex: 1, fontSize: 12.5 }}>
                  <b>{p.name}</b>{p.agency ? <span className="crm-mute"> · {p.agency}</span> : null}
                  <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>
                    {[already ? "Has this client" : "", `${p.open} open client${p.open === 1 ? "" : "s"}`,
                      p.fits.length ? `flats in ${p.fits.join(", ")}` : (p.areas ?? []).length ? `flats in ${(p.areas ?? []).slice(0, 3).join(", ")}` : "no live flats"]
                      .filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      <div>
        <div style={label}>Note for the partner (optional)</div>
        <input className="crm-input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Hot — moving in by the 10th" style={{ width: "100%" }} />
      </div>
    </SideSheet>
  );
}

/** The client's areas, from the shell's data: their requirement, else their own answers. */
function useClientAreas(client) {
  const crm = useCrm();
  return useMemo(() => {
    const req = (crm?.requirements ?? []).find((r) => r.client_id === client?.id);
    if (req?.localities?.length) return req.localities;
    const own = (crm?.ownAnswers ?? []).find((a) => a.user_id && a.user_id === client?.user_id);
    return own?.localities ?? [];
  }, [crm?.requirements, crm?.ownAnswers, client?.id, client?.user_id]);
}

/**
 * The two buttons. `client` when the caller has the row; otherwise `clientId`
 * (and a name for the sheet's title) and the shell's copy is used.
 */
export function FollowUpActions({ client: given, clientId, name = "", phone = "", partner = true, sm = true, onSaved, onToast, style }) {
  const crm = useCrm();
  const client = useMemo(() => {
    const id = given?.id ?? clientId;
    const shell = (crm?.clients ?? []).find((c) => c.id === id);
    return { id, name, phone, ...(shell ?? {}), ...(given ?? {}) };
  }, [given, clientId, crm?.clients, name, phone]);
  const [open, setOpen] = useState("");
  const areas = useClientAreas(client);
  const canWrite = crm?.access?.has?.("crm.clients.write") ?? true;
  const [shownAt] = useState(() => Date.now());
  if (!client.id || !canWrite) return null;
  const next = client.next_follow_up_at;
  const late = next && new Date(next).getTime() < shownAt;

  const saved = (row, outcome) => {
    crm?.patchClient?.(row);
    if (outcome) {
      crm?.setData?.((d) => (d.touches ? { ...d, touches: [{ client_id: row.id, actor_email: crm?.access?.email ?? "", type: "call", created_at: new Date().toISOString() }, ...d.touches] } : d));
    }
    setOpen("");
    onSaved?.(row);
    onToast?.(row.next_follow_up_at ? `Next follow-up ${whenLabel(row.next_follow_up_at)}` : "Saved");
  };

  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", ...style }} onClick={(e) => e.stopPropagation()}>
      <Btn sm={sm} onClick={() => setOpen("fu")} title={next ? `Next follow-up ${whenLabel(next)}` : "Log a call and set the next follow-up"}
        style={late ? { borderColor: C.coral, color: C.coral } : undefined}>
        <CalendarClock size={13} /> {next ? whenLabel(next).replace(/, (\d)/, " $1") : "Follow up"}
      </Btn>
      {partner && <Btn sm={sm} onClick={() => setOpen("partner")} title="Assign a broker partner"><UserPlus size={13} /> Assign partner</Btn>}
      {open === "fu" && <FollowUpSheet client={client} onClose={() => setOpen("")} onSaved={saved} />}
      {open === "partner" && (
        <AssignPartnerSheet client={client} areas={areas} onClose={() => setOpen("")}
          onDone={(r) => onToast?.(r.added?.length ? `Assigned to ${r.added.map((a) => a.name).join(", ")}` : "No new partner assigned")} />
      )}
    </span>
  );
}
