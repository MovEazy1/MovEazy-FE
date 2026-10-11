/**
 * Notifications → Messages: what people wrote on the website's Contact page
 * (site_contact_messages.sql). Answer on WhatsApp or a call, then mark done.
 * A number that's already a client opens their record.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Btn, Chip, Empty, relTime } from "./crmUi";
import { whatsappUrl } from "../../lib/crmSettings";
import { CONTACT_TOPICS, crmContactMessages, crmSetContactMessage } from "../../lib/contactMessages";

const TOPIC = Object.fromEntries(CONTACT_TOPICS);

function MessageRow({ m, onChanged }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const first = String(m.name || "").split(" ")[0] || "there";
  const toggle = async () => {
    setBusy(true);
    try { await crmSetContactMessage(m.id, m.status !== "done"); onChanged(); } catch { setBusy(false); }
  };
  return (
    <div className="crm-card" style={{ padding: 12, display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong>{m.name}</strong>
        <span className="crm-mute crm-num" style={{ fontSize: 12 }}>{m.phone}{m.email ? ` · ${m.email}` : ""}</span>
        <span className="crm-mute" style={{ fontSize: 11, marginLeft: "auto" }}>{relTime(m.created_at)}</span>
      </div>
      <span className="crm-chip" style={{ pointerEvents: "none", justifySelf: "start" }}>{TOPIC[m.topic] ?? "Something else"}</span>
      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13.5 }}>{m.message}</p>
      {m.status === "done" && (
        <span className="crm-mute" style={{ fontSize: 11 }}>Done{m.done_by ? ` by ${m.done_by}` : ""} · {relTime(m.done_at)}</span>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <a className="crm-btn crm-btn--sm crm-btn--wa" target="_blank" rel="noopener noreferrer"
          href={whatsappUrl(m.phone, `Hi ${first}, this is MovEazy — thanks for your message. `)}>WhatsApp</a>
        <a className="crm-btn crm-btn--sm" href={`tel:+91${m.phone}`}>Call</a>
        {m.client_id && <Btn sm onClick={() => navigate(`/crm/clients?client=${m.client_id}`)}>Open client</Btn>}
        <Btn sm variant={m.status === "done" ? undefined : "primary"} disabled={busy} onClick={toggle}>
          {m.status === "done" ? "Undo" : "Mark done"}
        </Btn>
      </div>
    </div>
  );
}

/** `onCount`: told how many are waiting, for the section chip. */
export default function CrmContactMessages({ onCount }) {
  const [tab, setTab] = useState("new");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    crmContactMessages(tab).then((r) => {
      setRows(r);
      setErr("");
      if (tab === "new") onCount?.(r.length);
    }, (e) => setErr(e?.message || "Couldn't load messages."));
  }, [tab, onCount]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="crm-colhead" style={{ gap: 6, justifyContent: "flex-start" }}>
        <Chip on={tab === "new"} onClick={() => { setRows(null); setTab("new"); }}>New</Chip>
        <Chip on={tab === "done"} onClick={() => { setRows(null); setTab("done"); }}>Done</Chip>
        <span style={{ marginLeft: "auto" }}><Btn sm onClick={load}>Refresh</Btn></span>
      </div>
      <div className="crm-scroll" style={{ flex: 1, padding: 12 }}>
        {err ? <Empty>{err}</Empty>
          : rows === null ? <Empty>Loading…</Empty>
            : rows.length === 0 ? <Empty>{tab === "new" ? "No new messages from the website." : "Nothing marked done yet."}</Empty>
              : (
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                  {rows.map((m) => <MessageRow key={m.id} m={m} onChanged={load} />)}
                </div>
              )}
      </div>
    </>
  );
}
