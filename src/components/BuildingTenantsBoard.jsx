/**
 * A building's tenants, as the MovEazy team and the building's owner see them
 * (building_tenants_board.sql): the numbers on top — from the QR, visits,
 * liked and how far, not liked and why — then filters and every tenant with
 * Call / WhatsApp. `onUpdate(tenant)`, in the CRM, adds the "Update status"
 * button; the owner's copy is read-only.
 */
import { useMemo, useState } from "react";
import { CalendarClock, MessageCircle, Phone } from "lucide-react";
import { LIKED_STATUSES, TENANT_FILTERS, callFeedbackLabel, reasonLabel, tenantBoardStats, trackSummary } from "../lib/buildings";

const INK = "#10221E", DIM = "#5E6B66", LINE = "#E2E6E4", ACCENT = "#0E7C68", GOLD = "#B0740F", CORAL = "#CC3F28";

function Tile({ label, value, sub, tone }) {
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: "9px 10px", background: "#fff", minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || INK, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: DIM, fontWeight: 600, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: DIM, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const dayOnly = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const tone = (t) => (!t ? DIM : t.liked_status === "paid_token" ? ACCENT : t.liked_status === "will_pay_token" ? GOLD : t.liked === "disliked" ? CORAL : INK);

export default function BuildingTenantsBoard({ tenants = [], onUpdate }) {
  const [filter, setFilter] = useState("all");
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const s = useMemo(() => tenantBoardStats(tenants), [tenants]);
  const test = TENANT_FILTERS.find((f) => f.id === filter)?.test || (() => true);
  const shown = tenants.filter((x) => test(x, day));
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 6 };
  const h = { fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: DIM, margin: "14px 0 6px" };

  return (
    <div style={{ color: INK, fontSize: 13.5 }}>
      <div style={h}>Tenants · {s.total}</div>
      <div style={grid}>
        <Tile label="From QR" value={s.fromQr} sub={`${s.called} called`} />
        <Tile label="Visit done" value={s.visitDone} />
        <Tile label="Visit pending" value={s.visitPending} />
        <Tile label="No status yet" value={s.noStatus} />
        <Tile label="Follow-up due" value={s.due} tone={s.due ? CORAL : undefined} />
      </div>
      <div style={h}>Liked · {s.liked}</div>
      <div style={grid}>
        {LIKED_STATUSES.map((st) => (
          <Tile key={st.id} label={st.label} value={s[st.id]} tone={st.id === "paid_token" && s[st.id] ? ACCENT : st.id === "will_pay_token" && s[st.id] ? GOLD : undefined} />
        ))}
      </div>
      <div style={h}>Did not like · {s.disliked}</div>
      {s.reasons.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {s.reasons.map(([r, n]) => (
            <span key={r} style={{ border: `1px solid ${LINE}`, borderRadius: 99, padding: "4px 10px", fontSize: 12.5, background: "#fff" }}>
              {reasonLabel(r)} <b>{n}</b>
            </span>
          ))}
        </div>
      ) : <div style={{ color: DIM, fontSize: 12.5 }}>No one yet.</div>}

      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "16px 0 8px", scrollbarWidth: "none" }}>
        {TENANT_FILTERS.map((f) => {
          const on = filter === f.id;
          const count = tenants.filter((x) => f.test(x, day)).length;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              style={{ flex: "none", border: `1px solid ${on ? ACCENT : LINE}`, background: on ? ACCENT : "#fff", color: on ? "#fff" : INK,
                borderRadius: 99, padding: "6px 12px", font: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {f.label} {count}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? <div style={{ color: DIM, fontSize: 13, padding: "12px 0" }}>No tenants here.</div> : (
        <div style={{ display: "grid", gap: 8 }}>
          {shown.map((x) => {
            const t = x.track;
            const due = t?.follow_up_on && t.follow_up_on <= day;
            return (
              <div key={x.phone} style={{ border: `1px solid ${due ? "#F1C9A8" : LINE}`, borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ fontSize: 14.5 }}>{x.name || "Tenant"}</strong>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, letterSpacing: ".02em" }}>{x.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</span>
                </div>
                <div style={{ color: tone(t), fontWeight: 700, marginTop: 3 }}>{t ? trackSummary(t) : "No status yet"}</div>
                {(t?.flats ?? []).length > 0 && <div style={{ color: DIM, fontSize: 12.5, marginTop: 2 }}>Flat {t.flats.join(", ")}</div>}
                {t?.note && <div style={{ fontSize: 12.5, marginTop: 2 }}>{t.note}</div>}
                {x.qr && (
                  <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>
                    From the QR · {when(x.qr.first_at)}
                    {(x.qr.called ?? []).length ? ` · called the ${x.qr.called.map((c) => (c === "manager" ? "property manager" : "caretaker")).join(" and ")}` : ""}
                    {(x.qr.feedback ?? []).length ? ` · said: ${x.qr.feedback.map((f) => callFeedbackLabel(f.kind) + (f.note ? ` ("${f.note}")` : "")).join(", ")}` : ""}
                  </div>
                )}
                {t?.follow_up_on && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, marginTop: 4, color: due ? CORAL : DIM }}>
                    <CalendarClock size={13} /> Follow up {dayOnly(t.follow_up_on)}{due ? " — due" : ""}
                  </div>
                )}
                {t && <div style={{ color: DIM, fontSize: 11, marginTop: 4 }}>Updated {when(t.updated_at)}{t.updated_by ? ` · ${t.updated_by}` : ""}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <a href={`tel:+91${x.phone}`} style={btn()}><Phone size={14} /> Call</a>
                  <a href={`https://wa.me/91${x.phone}`} target="_blank" rel="noreferrer" style={btn()}><MessageCircle size={14} /> WhatsApp</a>
                  {onUpdate && (
                    <button type="button" onClick={() => onUpdate(x)} style={{ ...btn(true), marginLeft: "auto" }}>{t ? "Update status" : "Add status"}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function btn(primary) {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 9, padding: "7px 11px", font: "inherit", fontSize: 12.5, fontWeight: 700,
    textDecoration: "none", cursor: "pointer", border: `1px solid ${primary ? ACCENT : LINE}`, background: primary ? ACCENT : "#fff", color: primary ? "#fff" : INK,
  };
}
