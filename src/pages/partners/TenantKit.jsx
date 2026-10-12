/**
 * Pieces of tenant management shared by Home, the tenant list and the tenant
 * page (lib/partnerTenants.js): the stage pill, "Remind me", "Deal done" /
 * "Lost", a tenant row, and Home's Today panel.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, Check, ChevronRight, Heart, Phone, Sparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Chip, Sheet, WhatsAppIcon, toast } from "./partnerUi";
import { MzBadge } from "./AiMatcher";
import VisitsToday from "./VisitsToday";
import { useTenants } from "./tenantData";
import { requirementLine } from "./leadBits";
import { friendlyError, inr, patchLead, pp, waLink } from "../../lib/partners";
import { logReachOut } from "../../lib/partnerLeads";
import { flatLine } from "../../lib/partnerMatcher";
import {
  STAGE, addReminder, dueToday, inDaysLabel, movingSoon, newActions, reminderDone, reminderPresets, snoozeReminder, updateTenant, whenLabel,
} from "../../lib/partnerTenants";

export const KIT_CSS = `
.tk-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.tk-new { background: #EEF2FF; color: #3730A3; } .tk-contacted { background: #F1F5F9; color: #334155; }
.tk-list_sent { background: #FEF3C7; color: #92400E; } .tk-liked { background: #FFE4E6; color: #BE123C; }
.tk-visit { background: #DCFCE7; color: #166534; } .tk-done { background: #166534; color: #fff; } .tk-lost { background: #F3F4F6; color: #6B7280; }
.tk-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-top: 1px solid var(--line); color: inherit; text-decoration: none; }
.tk-row:first-child { border-top: 0; }
.tk-meta { display: block; font-size: 12.5px; color: var(--dim); margin-top: 2px; }
.tk-due { color: #B91C1C; font-weight: 700; }
.tk-newbadge { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; border-radius: 99px; background: #E11D48; color: #fff; font-size: 11px; font-weight: 800; }
.tk-acts { display: flex; gap: 6px; flex: none; }
.tk-ic { width: 34px; height: 34px; border-radius: 99px; display: grid; place-items: center; border: 1px solid var(--line); background: #fff; color: var(--ink); cursor: pointer; }
.tk-ic.wa { background: var(--goldg); border-color: transparent; color: #1F1605; }
.tk-today h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 4px; font-size: 15px; }
.tk-today .pz-card { margin-bottom: 12px; padding: 12px 14px; }
`;

export function StagePill({ stage }) {
  return <span className={`tk-pill tk-${stage}`}>{STAGE[stage]?.label ?? stage}</span>;
}

/** WhatsApp or call a tenant, and note it (own: last contacted; MovEazy: the reach-out log). */
export function useReach() {
  const { setLeads } = usePartner();
  const { reload } = useTenants();
  return async (t, channel, text = "") => {
    if (!t?.phone) { toast("No number for them", "error"); return; }
    if (channel === "whatsapp") window.open(waLink(t.phone, text || `Hi ${String(t.name || "").split(" ")[0] || "there"}, `), "_blank", "noopener");
    else window.location.href = `tel:+91${String(t.phone).replace(/\D/g, "").slice(-10)}`;
    try {
      if (t.assignment_id && !t.lead_id) await logReachOut(t.assignment_id, channel);
      else if (t.lead_id) {
        const row = await patchLead(t.lead_id, { last_contacted_at: new Date().toISOString() });
        setLeads?.((ls) => ls.map((x) => (x.id === row.id ? row : x)));
      }
      reload();
    } catch { /* the message matters more than the log */ }
  };
}

const IST_DAY = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** "Remind me": quick picks, or a day and time, and a note. */
export function RemindSheet({ tenant, onClose, onSaved }) {
  const presets = useMemo(() => reminderPresets(), []);
  const [pick, setPick] = useState("tomorrow");
  const [day, setDay] = useState(() => IST_DAY(new Date(Date.now() + 864e5)));
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const at = pick === "custom" ? `${day}T${time}:00+05:30` : presets.find((p) => p.id === pick)?.at;
  const save = async () => {
    setBusy(true);
    try {
      await addReminder(tenant, at, note);
      toast(`Reminder set · ${whenLabel(at)}`);
      onSaved?.();
      onClose();
    } catch (e) { toast(friendlyError(e, "Could not set it."), "error"); setBusy(false); }
  };
  return (
    <Sheet title={`Remind me about ${String(tenant.name || "them").split(" ")[0]}`} onClose={onClose}>
      <div className="pz-pad">
        <div className="pz-chips" style={{ marginBottom: 10 }}>
          {presets.map((p) => <Chip key={p.id} on={pick === p.id} onClick={() => setPick(p.id)}>{p.label}</Chip>)}
          <Chip on={pick === "custom"} onClick={() => setPick("custom")}>Pick a time</Chip>
        </div>
        {pick === "custom" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input className="pz-input" type="date" min={IST_DAY()} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
            <input className="pz-input" type="time" value={time} step="900" onChange={(e) => setTime(e.target.value)} aria-label="Time" />
          </div>
        )}
        <input className="pz-input" placeholder="Note (optional) — e.g. call about the HSR flat" value={note} maxLength={300}
          onChange={(e) => setNote(e.target.value)} />
        <p className="pz-hint" style={{ margin: "8px 0 12px" }}>{at ? `You'll get a notification ${whenLabel(at).toLowerCase().startsWith("today") || whenLabel(at).toLowerCase().startsWith("tomorrow") ? "" : "on "}${whenLabel(at)}.` : ""}</p>
        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy || !at} onClick={save}>
          <AlarmClock size={16} /> {busy ? "Setting…" : "Set reminder"}
        </button>
      </div>
    </Sheet>
  );
}

const LOST_REASONS = ["Found a flat elsewhere", "Went with another broker", "Budget didn't work", "Plans changed", "Not reachable"];

/** "Deal done" (which flat, rent, move-in; deal type for MovEazy tenants) or "Lost" (why). */
export function OutcomeSheet({ tenant, kind, flats = [], onClose, onSaved }) {
  const [flat, setFlat] = useState(flats[0]?.property_id ?? "");
  const [rent, setRent] = useState(flats[0]?.rent ? String(flats[0].rent) : "");
  const [moveIn, setMoveIn] = useState(tenant.move_in || IST_DAY());
  const [deal, setDeal] = useState("");
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const mz = tenant.kind === "moveazy";
  const save = async () => {
    setBusy(true);
    try {
      await updateTenant(tenant, kind === "done"
        ? { outcome: "done", deal_property_id: flat, deal_rent: rent, deal_move_in: moveIn, deal_type: deal }
        : { outcome: "lost", lost_reason: reason });
      toast(kind === "done" ? "Deal done — congratulations! A renewal reminder is set for 10 months on." : "Marked lost");
      onSaved?.();
      onClose();
    } catch (e) { toast(friendlyError(e, "Could not save that."), "error"); setBusy(false); }
  };
  return (
    <Sheet title={kind === "done" ? "Deal done" : "Not going ahead"} onClose={onClose}>
      <div className="pz-pad">
        {kind === "done" ? (
          <>
            {flats.length > 0 && (
              <div className="pz-field">
                <span className="pz-label">Which flat?</span>
                <div className="pz-chips">
                  {flats.map((f) => (
                    <Chip key={f.property_id} on={flat === f.property_id}
                      onClick={() => { setFlat(f.property_id); if (f.rent) setRent(String(f.rent)); }}>{flatLine(f)}</Chip>
                  ))}
                  <Chip on={flat === ""} onClick={() => setFlat("")}>Another flat</Chip>
                </div>
              </div>
            )}
            <div className="pz-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label><span className="pz-label">Monthly rent (₹)</span>
                <input className="pz-input" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value.replace(/\D/g, "").slice(0, 7))} /></label>
              <label><span className="pz-label">Move-in</span>
                <input className="pz-input" type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} /></label>
            </div>
            {mz && (
              <div className="pz-field">
                <span className="pz-label">How did the deal go?</span>
                <div className="pz-chips">
                  <Chip on={deal === "direct"} onClick={() => setDeal("direct")}>Direct with the owner</Chip>
                  <Chip on={deal === "shared"} onClick={() => setDeal("shared")}>With other brokers</Chip>
                </div>
                {tenant.pack === "premium" && Number(rent) >= 1000 && deal && (
                  <span className="pz-hint">MovEazy's share: {inr(Math.round(Number(rent) * (deal === "direct" ? 0.3 : 0.2)))}</span>
                )}
              </div>
            )}
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy || Number(rent) < 1000 || (mz && !deal)} onClick={save}>
              <Check size={16} /> {busy ? "Saving…" : "Mark deal done"}
            </button>
          </>
        ) : (
          <>
            <div className="pz-chips" style={{ marginBottom: 12 }}>
              {LOST_REASONS.map((r) => <Chip key={r} on={reason === r} onClick={() => setReason(r)}>{r}</Chip>)}
            </div>
            <button type="button" className="pz-btn pz-btn--block" disabled={busy} onClick={save}>{busy ? "Saving…" : "Mark lost"}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** One tenant in a list: who, where they are, what's next. */
export function TenantRow({ t, onReach }) {
  const r = t.next_reminder;
  const overdue = r && new Date(r.due_at) <= new Date();
  return (
    <div className="tk-row">
      <Link to={pp(`/tenants/${t.slug}`)} style={{ display: "flex", gap: 12, flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
      <Avatar name={t.name} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 15.5 }}>{t.name || "Tenant"}</strong>
          {t.kind === "moveazy" && <MzBadge />}
          <StagePill stage={t.stage} />
          {t.new_actions > 0 && <span className="tk-newbadge"><Heart size={10} fill="currentColor" /> {t.new_actions} new</span>}
        </span>
        <span className="tk-meta">{[requirementLine(t), (t.localities ?? []).slice(0, 2).join(", ")].filter(Boolean).join(" · ") || "No requirement yet"}</span>
        <span className="tk-meta">
          {r ? <span className={overdue ? "tk-due" : ""}><AlarmClock size={11} /> {whenLabel(r.due_at)}{r.note ? ` · ${r.note}` : ""}</span>
            : t.move_in && t.stage !== "done" && t.stage !== "lost" ? `Moving in ${new Date(t.move_in).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : t.liked ? `♥ ${t.liked} liked` : t.lists ? `${t.lists} list${t.lists === 1 ? "" : "s"} sent` : ""}
        </span>
      </span>
      </Link>
      {t.phone && t.stage !== "done" && t.stage !== "lost" && (
        <span className="tk-acts">
          <button type="button" className="tk-ic wa" aria-label={`WhatsApp ${t.name}`} onClick={() => onReach(t, "whatsapp")}><WhatsAppIcon size={16} /></button>
          <button type="button" className="tk-ic" aria-label={`Call ${t.name}`} onClick={() => onReach(t, "call")}><Phone size={15} /></button>
        </span>
      )}
    </div>
  );
}

/** Home: follow-ups due, tenants who did something new, moving in soon, and today's visits. */
export function TodayPanel() {
  const { board, reminders, loaded, reload } = useTenants();
  const reach = useReach();
  const due = dueToday(reminders);
  const fresh = newActions(board).slice(0, 4);
  const soon = movingSoon(board).slice(0, 4);
  const bySlug = useMemo(() => new Map(board.map((t) => [t.slug, t])), [board]);
  const act = async (fn, ok) => { try { await fn(); toast(ok); reload(); } catch (e) { toast(friendlyError(e), "error"); } };
  return (
    <div className="tk-today">
      <style>{KIT_CSS}</style>
      <VisitsToday />
      {loaded && due.length > 0 && (
        <div className="pz-card" style={{ borderColor: "#FCA5A5" }}>
          <h3><AlarmClock size={16} color="#B91C1C" /> Follow-ups due · {due.length}</h3>
          {due.slice(0, 5).map((r) => {
            const t = bySlug.get(r.slug) ?? { ...r.tenant, lead_id: r.lead_id, assignment_id: r.assignment_id, slug: r.slug };
            return (
              <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <Link to={pp(`/tenants/${r.slug}`)} style={{ color: "inherit", textDecoration: "none" }}>
                  <strong style={{ fontSize: 14.5 }}>{r.tenant?.name || "Tenant"}</strong>
                  <span className="tk-meta"><span className={new Date(r.due_at) <= new Date() ? "tk-due" : ""}>{whenLabel(r.due_at)}</span>{r.note ? ` · ${r.note}` : ""}</span>
                </Link>
                <div className="pz-row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {r.tenant?.phone && <button type="button" className="pz-btn pz-btn--sm pz-wa" onClick={() => reach(t, "whatsapp")}><WhatsAppIcon size={14} /> WhatsApp</button>}
                  {r.tenant?.phone && <button type="button" className="pz-btn pz-btn--sm" onClick={() => reach(t, "call")}><Phone size={14} /> Call</button>}
                  <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={() => act(() => reminderDone(r.id), "Done")}><Check size={14} /> Done</button>
                  <button type="button" className="pz-btn pz-btn--sm" onClick={() => act(() => snoozeReminder(r.id, reminderPresets()[1].at), "Snoozed to tomorrow 10 am")}>Tomorrow</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {fresh.length > 0 && (
        <div className="pz-card">
          <h3><Sparkles size={16} color="#E11D48" /> New from your tenants</h3>
          {fresh.map((t) => (
            <Link key={t.key} to={pp(`/tenants/${t.slug}`)} className="pz-row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 14.5 }}>{t.name}</strong>
                <span className="tk-meta">{t.liked ? `♥ liked ${t.liked} flat${t.liked === 1 ? "" : "s"}` : "opened your list"} — fix visits</span>
              </span>
              <span className="tk-newbadge">{t.new_actions} new</span>
              <ChevronRight size={16} color="var(--dim)" />
            </Link>
          ))}
        </div>
      )}
      {soon.length > 0 && (
        <div className="pz-card">
          <h3>🏠 Moving in soon</h3>
          {soon.map((t) => (
            <Link key={t.key} to={pp(`/tenants/${t.slug}`)} className="pz-row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)", color: "inherit", textDecoration: "none" }}>
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 14.5 }}>{t.name}</strong>
                <span className="tk-meta">Moving in {inDaysLabel(t.in_days)} · <StagePill stage={t.stage} /></span>
              </span>
              <ChevronRight size={16} color="var(--dim)" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
