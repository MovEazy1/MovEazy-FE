/**
 * On a MovEazy lead in the partner app (lib/tenantViews.js, tenant_views.sql):
 * which of the partner's flats the tenant viewed — how often, and how it went
 * (MovEazy's answer, and the partner's own) — the sheet to say how it went,
 * and the day to follow up with a note. Everything here is kept on the
 * tenant's record for MovEazy.
 */
import { useState } from "react";
import { CalendarClock, Eye } from "lucide-react";
import { Chip, Sheet, toast } from "./partnerUi";
import { friendlyError } from "../../lib/partners";
import { DISLIKE_REASONS, LIKED_STATUSES, reasonLabel } from "../../lib/buildings";
import { partnerRespond, setPartnerFollowUp, viewSummary } from "../../lib/tenantViews";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

/** The partner's flats this lead viewed, and how each went. */
export function LeadFlatsViewed({ lead, info, onChanged }) {
  const [open, setOpen] = useState(null);
  const flats = info?.flats ?? [];
  if (!flats.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="pz-hint" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Eye size={14} /> Your flats they viewed</div>
      {flats.map((f) => (
        <div key={f.property_id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 10px", marginTop: 6 }}>
          <div className="pz-between" style={{ gap: 8, alignItems: "flex-start" }}>
            <span style={{ minWidth: 0, fontSize: 14 }}>
              <strong>{[f.flat_type, f.area].filter(Boolean).join(" · ") || f.property_id}</strong>
              <span className="pz-hint" style={{ display: "block" }}>
                {[f.rent ? inr(f.rent) : "", f.opens > 0 ? `opened ${f.opens}×` : "", `last ${day(f.last_at)}`].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button type="button" className="pz-btn pz-btn--sm" style={{ flex: "none" }} onClick={() => setOpen(f)}>How did it go?</button>
          </div>
          {f.response_by && <div style={{ fontSize: 13, marginTop: 4 }}><strong>MovEazy:</strong> {viewSummary(f)}</div>}
          {f.mine && <div className="pz-hint" style={{ marginTop: 2 }}>You said: {viewSummary({ ...f.mine, response_by: "partner" })}</div>}
        </div>
      ))}
      {open && (
        <RespondSheet lead={lead} flat={open} onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); toast("Saved — MovEazy sees it"); onChanged(); }} />
      )}
    </div>
  );
}

function RespondSheet({ lead, flat, onClose, onSaved }) {
  const start = flat.mine || {};
  const [f, setF] = useState({ visit: start.visit || "", liked: start.liked || "", liked_status: start.liked_status || "", reasons: start.reasons ?? [] });
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((cur) => ({ ...cur, ...p }));
  const toggle = (r) => set({ reasons: f.reasons.includes(r) ? f.reasons.filter((x) => x !== r) : [...f.reasons, r] });
  const offered = [...DISLIKE_REASONS.map((r) => r.id), ...f.reasons.filter((r) => !DISLIKE_REASONS.some((d) => d.id === r))];
  const save = async () => {
    setBusy(true);
    try {
      const typed = other.trim().length >= 2 ? [other.trim()] : [];
      await partnerRespond(lead.id, flat.property_id, { ...f, reasons: [...f.reasons, ...typed] });
      onSaved();
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
    }
  };
  return (
    <Sheet title={`${lead.name || "Tenant"} · ${[flat.flat_type, flat.area].filter(Boolean).join(", ") || flat.property_id}`} onClose={onClose}>
      <div className="pz-pad">
        <div className="pz-field">
          <span className="pz-label">Visit</span>
          <div className="pz-chips">
            {[["", "Not yet"], ["pending", "Visit pending"], ["done", "Visit done"]].map(([k, l]) => (
              <Chip key={k || "none"} on={f.visit === k} onClick={() => set({ visit: k })}>{l}</Chip>
            ))}
          </div>
        </div>
        <div className="pz-field">
          <span className="pz-label">The flat</span>
          <div className="pz-chips">
            <Chip on={f.liked === "liked"} onClick={() => set({ liked: f.liked === "liked" ? "" : "liked" })}>Liked it</Chip>
            <Chip on={f.liked === "disliked"} onClick={() => set({ liked: f.liked === "disliked" ? "" : "disliked" })}>Did not like it</Chip>
          </div>
        </div>
        {f.liked === "liked" && (
          <div className="pz-field">
            <span className="pz-label">Where they are</span>
            <div className="pz-chips">
              {LIKED_STATUSES.map((s) => (
                <Chip key={s.id} on={f.liked_status === s.id} onClick={() => set({ liked_status: f.liked_status === s.id ? "" : s.id })}>{s.label}</Chip>
              ))}
            </div>
          </div>
        )}
        {f.liked === "disliked" && (
          <div className="pz-field">
            <span className="pz-label">Why not (pick any)</span>
            <div className="pz-chips">
              {offered.map((r) => <Chip key={r} on={f.reasons.includes(r)} onClick={() => toggle(r)}>{reasonLabel(r)}</Chip>)}
            </div>
            <input className="pz-input" style={{ marginTop: 8 }} placeholder="Any other issue — type it" maxLength={60}
              value={other} onChange={(e) => setOther(e.target.value)} />
          </div>
        )}
        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Sheet>
  );
}

/** The day to follow up with this lead, and a note. */
export function LeadFollowUp({ lead, info, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [on, setOn] = useState(info?.follow_up_on || "");
  const [note, setNote] = useState(info?.follow_up_note || "");
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const due = info?.follow_up_on && info.follow_up_on <= today;
  const save = async (clear = false) => {
    setBusy(true);
    try {
      await setPartnerFollowUp(lead.id, clear ? "" : on, clear ? "" : note);
      if (clear) { setOn(""); setNote(""); }
      setEditing(false);
      toast(clear ? "Follow-up cleared" : "Follow-up saved");
      onChanged();
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, border: 0, background: "none", padding: 0, font: "inherit", fontSize: 13,
          fontWeight: 600, cursor: "pointer", color: due ? "var(--red, #CC3F28)" : "var(--g)" }}>
        <CalendarClock size={15} />
        {info?.follow_up_on ? `Follow up ${day(info.follow_up_on)}${due ? " — due" : ""}${info.follow_up_note ? ` · ${info.follow_up_note}` : ""}` : "Set a follow-up"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
      <input className="pz-input" type="date" value={on} onChange={(e) => setOn(e.target.value)} aria-label="Follow up on" />
      <input className="pz-input" placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="pz-row" style={{ gap: 8 }}>
        <button type="button" className="pz-btn pz-btn--primary pz-btn--sm" disabled={busy || !on} onClick={() => save(false)}>Save</button>
        {info?.follow_up_on && <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={() => save(true)}>Clear</button>}
        <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}
