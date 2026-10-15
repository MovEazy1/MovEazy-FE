/**
 * The top of CRM → Notifications on a phone: today's visits (MovEazy's and
 * partners'), tenants who liked a flat with no visit fixed, leads nobody has
 * called, and the queue counts — each opens its list right here (?show=).
 * Read on open and every hour (crm_mobile.sql).
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCrm } from "../CrmShell";
import { C, Empty, Loading, inr, relTime } from "../crmUi";
import { friendlyError } from "../../../lib/partners";
import {
  REFRESH_MS, VIA_LABEL, fetchLeadsNotCalled, fetchLikedNoVisit, fetchVisitsToday, likedMessage, notCalledMessage, partnerNudgeMessage,
} from "../../../lib/crmMobile";
import { ContactButtons, Metric, PhSection, Segment, updatedAt } from "./phoneUi";

const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const flatLine = (r) => {
  const name = r.title || [r.flat_type, r.area].filter(Boolean).join(" in ");
  const area = r.title && r.area && !r.title.includes(r.area) ? r.area : "";
  return [name, area, r.rent ? inr(r.rent) : ""].filter(Boolean).join(" · ");
};

export default function PhoneAlerts({ onQueue }) {
  const { summary } = useCrm();
  const [params, setParams] = useSearchParams();
  const show = params.get("show") || "";
  const [visits, setVisits] = useState(null);
  const [liked, setLiked] = useState(null);
  const [quiet, setQuiet] = useState(null);
  const [err, setErr] = useState("");
  const [at, setAt] = useState(null);

  const load = useCallback(async () => {
    try {
      const [v, l, q] = await Promise.all([fetchVisitsToday(), fetchLikedNoVisit(30), fetchLeadsNotCalled()]);
      setVisits(v); setLiked(l); setQuiet(q); setAt(new Date()); setErr("");
    } catch (e) {
      setErr(friendlyError(e, "Couldn't load the numbers."));
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const open = (id) => setParams((p) => {
    const q = new URLSearchParams(p);
    if (q.get("show") === id) q.delete("show"); else q.set("show", id);
    return q;
  }, { replace: true });

  const w = summary?.waiting ?? {};
  const nv = (visits?.moveazy?.length ?? 0) + (visits?.partners?.length ?? 0);
  const nq = (quiet?.moveazy?.length ?? 0) + (quiet?.partners?.length ?? 0);

  return (
    <div className="crm-ph-page" style={{ paddingBottom: 6, gap: 12 }}>
      {err && <p className="crm-ph-note" style={{ color: C.coral }}>{err}</p>}
      <div className="crm-ph-grid">
        <Metric label="Visits today" value={visits ? nv : "…"} on={show === "visits"} onClick={() => open("visits")}
          sub={visits ? `MovEazy ${visits.moveazy.length} · Partners ${visits.partners.length}` : undefined} />
        <Metric label="Liked a flat, no visit" value={liked ? liked.length : "…"} on={show === "liked"} onClick={() => open("liked")}
          sub="Last 30 days" tone={liked?.length ? C.coral : undefined} />
        <Metric label="Leads not called" value={quiet ? nq : "…"} on={show === "notcalled"} onClick={() => open("notcalled")}
          sub={quiet ? `MovEazy ${quiet.moveazy.length} · Partners ${quiet.partners.length}` : undefined} tone={nq ? C.coral : undefined} />
        <Metric label="Visit slots required" value={w.slots_required} onClick={() => onQueue("slots")} />
        <Metric label="Payments to check" value={w.payments_to_check} to="/crm/partner-payments?step=utr" />
        <Metric label="Contact messages" value={w.messages} onClick={() => onQueue("messages")} />
      </div>
      {at && <p className="crm-ph-note">{updatedAt(at)}</p>}

      {show === "visits" && <VisitsList visits={visits} />}
      {show === "liked" && <LikedList rows={liked} />}
      {show === "notcalled" && <NotCalledList quiet={quiet} />}
    </div>
  );
}

function VisitsList({ visits }) {
  const [who, setWho] = useState("moveazy");
  if (!visits) return <Loading />;
  const rows = who === "moveazy" ? visits.moveazy : visits.partners;
  return (
    <PhSection title="Visits today">
      <Segment value={who} onChange={setWho} options={[["moveazy", `MovEazy ${visits.moveazy.length}`], ["partners", `Partners ${visits.partners.length}`]]} />
      <div style={{ marginTop: 8 }}>
        {rows.length === 0 ? <Empty pad={16}>No visits today.</Empty> : rows.map((v) => (
          <div key={v.id} className="crm-ph-card">
            <div className="crm-ph-card-top">
              <div style={{ minWidth: 0 }}>
                <b>{v.name}</b>
                <div className="crm-ph-meta">{flatLine(v)}</div>
                {who === "partners" && <div className="crm-ph-meta">Partner: {v.broker_name || "—"}{v.moveazy_lead ? " · MovEazy lead" : ""}</div>}
              </div>
              <span className="crm-ph-pill">{time(v.slot_at || v.visit_at)}</span>
            </div>
            {who === "moveazy"
              ? <ContactButtons phone={v.phone} label={v.name} />
              : <ContactButtons phone={v.broker_phone} label={v.broker_name} />}
          </div>
        ))}
      </div>
    </PhSection>
  );
}

function LikedList({ rows }) {
  const [via, setVia] = useState("all");
  if (!rows) return <Loading />;
  const shown = rows.filter((r) => via === "all" || (via === "partner" ? r.flat_broker : !r.flat_broker));
  return (
    <PhSection title={`Liked a flat, no visit · ${rows.length}`}>
      <Segment value={via} onChange={setVia} options={[
        ["all", `All ${rows.length}`], ["moveazy", `MovEazy flats ${rows.filter((r) => !r.flat_broker).length}`],
        ["partner", `Partner flats ${rows.filter((r) => r.flat_broker).length}`],
      ]} />
      <div style={{ marginTop: 8 }}>
        {shown.length === 0 ? <Empty pad={16}>Nobody here.</Empty> : shown.map((r) => (
          <div key={`${r.who}-${r.property_id}`} className="crm-ph-card">
            <div className="crm-ph-card-top">
              <div style={{ minWidth: 0 }}>
                <b>{r.name}</b>
                <div className="crm-ph-meta">
                  {VIA_LABEL[r.via] || "Liked"}{r.via === "partner_list" && r.via_broker_name ? ` (${r.via_broker_name})` : ""} · {relTime(r.liked_at)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {r.cover_image_url
                ? <img src={r.cover_image_url} alt="" width="56" height="56" loading="lazy" style={{ borderRadius: 9, objectFit: "cover", flex: "none" }} />
                : <span style={{ width: 56, height: 56, borderRadius: 9, background: C.surfaceAlt, flex: "none" }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{flatLine(r) || r.property_id}</div>
                <div className="crm-ph-meta">{r.flat_broker ? `Partner flat · ${r.flat_broker_name || "a partner"}` : "MovEazy flat"} · {r.property_id}</div>
              </div>
            </div>
            <ContactButtons phone={r.phone} label={r.name} text={likedMessage(r)} />
            {r.crm_client_id && (
              <Link to={`/crm/clients?client=${r.crm_client_id}`} className="crm-btn" style={{ justifyContent: "center", textDecoration: "none" }}>Open the client</Link>
            )}
          </div>
        ))}
      </div>
    </PhSection>
  );
}

function NotCalledList({ quiet }) {
  const [who, setWho] = useState("moveazy");
  if (!quiet) return <Loading />;
  return (
    <PhSection title="Leads not called in 24 hours">
      <Segment value={who} onChange={setWho} options={[["moveazy", `MovEazy ${quiet.moveazy.length}`], ["partners", `Partners ${quiet.partners.length}`]]} />
      <p className="crm-ph-note" style={{ margin: "8px 0" }}>
        {who === "moveazy" ? "New MovEazy leads (up to 30 days old) nobody from the team has called, WhatsApped or sent flats to."
          : "MovEazy leads given to partners 24+ hours ago that the partner hasn't called or WhatsApped. Nudge the partner."}
      </p>
      {who === "moveazy" ? (
        quiet.moveazy.length === 0 ? <Empty pad={16}>Everyone has been contacted.</Empty> : quiet.moveazy.map((c) => (
          <div key={c.client_id} className="crm-ph-card">
            <div className="crm-ph-card-top">
              <div style={{ minWidth: 0 }}>
                <b>{c.name || "A tenant"}</b>
                <div className="crm-ph-meta">{[c.via === "qr" ? "QR scan" : c.source, `came in ${relTime(c.created_at)}`].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <ContactButtons phone={c.phone} label={c.name} text={notCalledMessage(c)} />
            <Link to={`/crm/clients?client=${c.client_id}`} className="crm-btn" style={{ justifyContent: "center", textDecoration: "none" }}>Open the client</Link>
          </div>
        ))
      ) : (
        quiet.partners.length === 0 ? <Empty pad={16}>Partners have called every lead.</Empty> : quiet.partners.map((a) => (
          <div key={a.assignment_id} className="crm-ph-card">
            <div className="crm-ph-card-top">
              <div style={{ minWidth: 0 }}>
                <b>{a.name || "A tenant"}</b>
                <div className="crm-ph-meta">With {a.broker_name || "a partner"} · given {relTime(a.assigned_at)}</div>
              </div>
            </div>
            <ContactButtons phone={a.broker_phone} label={a.broker_name} text={partnerNudgeMessage(a)} />
          </div>
        ))
      )}
    </PhSection>
  );
}
