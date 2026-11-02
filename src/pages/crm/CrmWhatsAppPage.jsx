/**
 * WhatsApp inbox: flats marked numbers sent to our WhatsApp Business number,
 * read by AI into drafts (lib/whatsappIntake.js, whatsapp_intake.sql).
 *
 *   To review    a flat to list: "Review & publish" opens the property form
 *                filled in; a person checks it and publishes. Or dismiss.
 *   Rented       "that flat is gone": the sender's listings it may mean, one
 *                tap to mark rented.
 *   Being read   batches still arriving (the photos come after the text) or
 *                waiting for AI; failures, with Retry.
 *   Done         the last 14 days.
 *   Numbers      who we read: the list here + every approved partner.
 *   Setup        the connection to Meta.
 *
 * A message can also be pasted here (with its photos) and read the same way.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Loading, Toast, inr, relTime } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import {
  META_APP_ID, WA_CONFIG_ID, connectWhatsApp, dismissWaDraft, draftSummary, fetchWaInbox, fetchWaNumbers, markWaRented,
  pasteWaMessage, pokeWaProcess, removeWaNumber, retryWaBatch, saveWaNumber, senderLine,
} from "../../lib/whatsappIntake";

const TABS = [
  { id: "review", label: "To review" },
  { id: "rented", label: "Rented" },
  { id: "reading", label: "Being read" },
  { id: "done", label: "Done" },
  { id: "numbers", label: "Numbers" },
  { id: "setup", label: "Setup" },
];
const DONE = { published: "Published", dismissed: "Dismissed", rented_marked: "Marked rented" };
const isVideo = (u) => /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(u || "");

function Thumbs({ urls }) {
  if (!urls?.length) return <div className="crm-mute" style={{ fontSize: 11 }}>No photos</div>;
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {urls.slice(0, 4).map((u) => (isVideo(u)
        ? <span key={u} style={{ width: 54, height: 54, borderRadius: 6, background: C.surfaceAlt, display: "grid", placeItems: "center", fontSize: 10, color: C.textDim }}>Video</span>
        : <img key={u} src={u} alt="" loading="lazy" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 6, background: C.surface }} />))}
      {urls.length > 4 && <span className="crm-mute" style={{ fontSize: 11, alignSelf: "center" }}>+{urls.length - 4}</span>}
    </div>
  );
}

function MessageText({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > 180;
  return (
    <div style={{ fontSize: 12, color: C.textDim, whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 4 }}>
      {open || !long ? text : `${text.slice(0, 180)}…`}
      {long && <button type="button" onClick={() => setOpen(!open)} style={{ border: 0, background: "none", color: C.accent, cursor: "pointer", fontSize: 11.5, padding: "0 4px" }}>{open ? "less" : "more"}</button>}
    </div>
  );
}

function DraftRow({ d, canWrite, onReview, onDismiss, onRented }) {
  const rented = d.kind === "rented";
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap", alignItems: "flex-start" }}>
      {!rented && <Thumbs urls={d.images} />}
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>
          {rented ? `Rented: ${draftSummary(d) || "which flat?"}` : draftSummary(d) || d.fields?.title || "A flat — details to fill"}
        </div>
        <div className="crm-mute" style={{ fontSize: 11.5, marginTop: 2 }}>
          {senderLine(d)} · {relTime(d.received_at)}{d.source === "paste" ? " · pasted" : ""}
        </div>
        {!rented && d.status === "pending" && d.missing?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
            {d.missing.map((m) => <span key={m} style={{ fontSize: 10.5, fontWeight: 700, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 999, padding: "1px 7px" }}>No {m.toLowerCase()}</span>)}
          </div>
        )}
        {d.fields?.notes && <div style={{ fontSize: 12, marginTop: 4 }}>Note: {d.fields.notes}</div>}
        <MessageText text={d.text} />
        {rented && d.status === "pending" && (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {d.candidates?.length ? d.candidates.map((c) => (
              <div key={c.property_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                <a href={`/crm/properties/${c.property_id}/edit`} target="_blank" rel="noreferrer" style={{ color: C.accent, fontWeight: 600 }}>{c.property_id}</a>
                <span>{[c.title, c.area, inr(c.rent)].filter(Boolean).join(" · ")}</span>
                {canWrite && <Btn sm onClick={() => onRented(d, c.property_id)}>Mark rented</Btn>}
              </div>
            )) : <span className="crm-mute" style={{ fontSize: 12 }}>None of this sender's live listings found — mark it rented from Properties.</span>}
          </div>
        )}
        {d.status !== "pending" && (
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {DONE[d.status]}{d.property_id ? <> · <a href={`/crm/properties/${d.property_id}/edit`} style={{ color: C.accent }}>{d.property_id}</a></> : ""}
            {d.decided_by ? ` · ${d.decided_by.split("@")[0]}` : ""} {relTime(d.decided_at)}
          </div>
        )}
      </div>
      {canWrite && d.status === "pending" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {!rented && <Btn variant="primary" sm onClick={() => onReview(d)}>Review &amp; publish</Btn>}
          <Btn sm onClick={() => onDismiss(d)}>Dismiss</Btn>
        </div>
      )}
    </div>
  );
}

function PasteBox({ onDone, onToast }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await pasteWaMessage(text, files, from);
      setText(""); setFiles([]); setFrom(""); setOpen(false);
      onToast("Reading it — the draft appears here in a few seconds");
      onDone();
    } catch (e) { onToast(e?.message || "Couldn't add it", "error"); }
    finally { setBusy(false); }
  };
  if (!open) return <Btn sm onClick={() => setOpen(true)}>Paste a message</Btn>;
  return (
    <div className="crm-card" style={{ display: "grid", gap: 8, maxWidth: 680 }}>
      <span className="crm-label">Paste a property message</span>
      <textarea className="crm-input" rows={5} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Paste the WhatsApp message — one flat or several" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label className="crm-btn crm-btn--sm" style={{ cursor: "pointer" }}>
          <ImagePlus size={14} /> {files.length ? `${files.length} photo${files.length === 1 ? "" : "s"}` : "Add photos"}
          <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => setFiles([...e.target.files])} />
        </label>
        <input className="crm-input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Sent by (mobile, optional)" style={{ maxWidth: 210 }} />
        <span className="crm-mute" style={{ fontSize: 11 }}>A partner's number lists the flat as theirs.</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" sm disabled={busy || (!text.trim() && !files.length)} onClick={send}>{busy ? "Adding…" : "Read it"}</Btn>
        <Btn sm onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </div>
  );
}

function NumbersTab({ canWrite, onToast }) {
  const [data, setData] = useState(null);
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [showPartners, setShowPartners] = useState(false);
  const load = useCallback(() => fetchWaNumbers().then(setData, (e) => { setData({ marked: [], partners: [] }); onToast(e?.message || "Couldn't load", "error"); }), [onToast]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Loading />;
  const add = async () => {
    try { await saveWaNumber(phone, label); setPhone(""); setLabel(""); onToast("Number marked"); load(); }
    catch (e) { onToast(e?.message || "Couldn't add it", "error"); }
  };
  const remove = async (p) => {
    try { await removeWaNumber(p); onToast("Removed"); load(); } catch (e) { onToast(e?.message || "Couldn't remove it", "error"); }
  };
  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 680 }}>
      <p className="crm-mute" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>
        Flats sent to our WhatsApp Business number are read only from these numbers and from every approved partner.
        Messages from anyone else are ignored and never saved.
      </p>
      {canWrite && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="crm-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" style={{ maxWidth: 180 }} />
          <input className="crm-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Who is it? (e.g. Ramesh, HSR broker)" style={{ maxWidth: 260 }} />
          <Btn variant="primary" sm disabled={!phone.trim()} onClick={add}>Mark number</Btn>
        </div>
      )}
      <div className="crm-card" style={{ padding: 0 }}>
        {data.marked.length === 0 ? <Empty pad={18}>No numbers marked yet.</Empty> : data.marked.map((m) => (
          <div key={m.phone10} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 12px", borderBottom: `1px solid ${C.lineSoft}` }}>
            <span className="crm-num" style={{ fontSize: 13, fontWeight: 600 }}>{m.phone10}</span>
            <span style={{ fontSize: 12.5, flex: 1 }}>{m.label}</span>
            <span className="crm-mute" style={{ fontSize: 11 }}>{m.added_by?.split("@")[0]} · {relTime(m.added_at)}</span>
            {canWrite && <button type="button" aria-label={`Remove ${m.phone10}`} onClick={() => remove(m.phone10)} style={{ border: 0, background: "none", cursor: "pointer", color: C.textMute }}><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      <div>
        <Chip on={showPartners} onClick={() => setShowPartners(!showPartners)}>Approved partners, read automatically · {data.partners.length}</Chip>
        {showPartners && (
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 8, lineHeight: 1.7 }}>
            {data.partners.map((p) => `${p.name} (${p.phone10})`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function SetupTab({ connection, isSuperAdmin, onConnected, onToast }) {
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    setBusy(true);
    try { const r = await connectWhatsApp(); onToast(`Connected ${r.display_phone || ""}`); onConnected(); }
    catch (e) { onToast(e?.message || "Couldn't connect", "error"); }
    finally { setBusy(false); }
  };
  const ready = Boolean(META_APP_ID && WA_CONFIG_ID);
  return (
    <div style={{ padding: 16, display: "grid", gap: 14, maxWidth: 720, fontSize: 12.5, lineHeight: 1.6 }}>
      <div className="crm-card" style={{ display: "grid", gap: 6 }}>
        <span className="crm-label">Connection</span>
        {connection?.connected ? (
          <span>
            Connected: <strong>{connection.display_phone}</strong>{connection.verified_name ? ` (${connection.verified_name})` : ""} since {new Date(connection.connected_at).toLocaleDateString("en-IN")}.
            {" "}Last message received {connection.last_webhook_at ? relTime(connection.last_webhook_at) : "— none yet"}.
          </span>
        ) : <span>Not connected yet. Until it is, paste messages under To review.</span>}
        {isSuperAdmin && (ready
          ? <div><Btn variant="primary" sm disabled={busy} onClick={connect}>{busy ? "Connecting…" : connection?.connected ? "Reconnect WhatsApp Business" : "Connect WhatsApp Business"}</Btn></div>
          : <span className="crm-mute">The Connect button appears once VITE_META_APP_ID and VITE_WA_CONFIG_ID are set (step 5).</span>)}
      </div>
      <div className="crm-card" style={{ display: "grid", gap: 4 }}>
        <span className="crm-label">One-time setup (free)</span>
        <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
          <li>Our number must be on the <strong>WhatsApp Business</strong> app (not normal WhatsApp), on the latest version. It keeps working on the phone after connecting.</li>
          <li>At developers.facebook.com, create an app (type <em>Business</em>) under the MovEazy business account and add the <strong>WhatsApp</strong> product.</li>
          <li>In Business settings, complete <strong>business verification</strong>, then in the app apply to be a <strong>Tech Provider</strong> (App review for whatsapp_business_messaging and whatsapp_business_management). Meta takes 1–3 weeks.</li>
          <li>In the app: Facebook Login for Business → Configurations → create one for <em>WhatsApp Embedded Signup</em>. Its id is the config id.</li>
          <li>In Vercel → Settings → Environment Variables add <code>VITE_META_APP_ID</code>, <code>VITE_WA_CONFIG_ID</code>, <code>META_APP_SECRET</code>, <code>WHATSAPP_VERIFY_TOKEN</code> (any long random text) and <code>ANTHROPIC_API_KEY</code>, then redeploy.</li>
          <li>In the app → WhatsApp → Configuration → Webhook: URL <code>https://www.moveazy.co.in/api/whatsapp-webhook</code>, the same verify token, and subscribe to <strong>messages</strong>.</li>
          <li>Press <strong>Connect WhatsApp Business</strong> above, choose “Connect your existing WhatsApp Business app”, and scan the QR code with the phone.</li>
        </ol>
      </div>
    </div>
  );
}

export default function CrmWhatsAppPage() {
  const { access } = useCrm();
  const navigate = useNavigate();
  const canWrite = access.has(SCOPES.PROPERTIES_WRITE);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("review");
  const [toast, setToast] = useState(null);
  const say = useCallback((message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3200); }, []);
  const load = useCallback(() => fetchWaInbox().then(setData, (e) => { setData({ drafts: [], reading: [], pending: 0 }); say(e?.message || "Couldn't load the inbox", "error"); }), [say]);

  // Read anything waiting first, so the list is current.
  useEffect(() => { pokeWaProcess().finally(load); }, [load]);
  // While something is being read, look again every 20 seconds.
  const busyReading = (data?.reading ?? []).some((b) => b.state !== "error");
  useEffect(() => {
    if (!busyReading) return undefined;
    const t = setInterval(() => { pokeWaProcess().finally(load); }, 20000);
    return () => clearInterval(t);
  }, [busyReading, load]);

  const groups = useMemo(() => {
    const d = data?.drafts ?? [];
    return {
      review: d.filter((x) => x.status === "pending" && x.kind === "property"),
      rented: d.filter((x) => x.status === "pending" && x.kind === "rented"),
      done: d.filter((x) => x.status !== "pending"),
    };
  }, [data]);

  const act = async (fn, ok) => {
    try { await fn(); say(ok); load(); } catch (e) { say(e?.message || "Couldn't save", "error"); }
  };

  if (!data) return <Loading />;
  const conn = data.connection;
  const counts = { review: groups.review.length, rented: groups.rented.length, reading: data.reading.length, done: groups.done.length };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ padding: "14px 16px 10px", display: "grid", gap: 10, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>WhatsApp inbox</h1>
          <span className="crm-mute" style={{ fontSize: 12.5 }}>
            {conn?.connected ? `${conn.display_phone} connected · last message ${conn.last_webhook_at ? relTime(conn.last_webhook_at) : "none yet"}` : "WhatsApp not connected yet — paste messages meanwhile"}
          </span>
          <button type="button" aria-label="Refresh" onClick={() => { pokeWaProcess().finally(load); }} style={{ border: 0, background: "none", cursor: "pointer", color: C.textMute, marginLeft: "auto" }}><RefreshCw size={15} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <Chip key={t.id} on={tab === t.id} onClick={() => setTab(t.id)}>{t.label}{t.id in counts ? ` · ${counts[t.id]}` : ""}</Chip>
          ))}
        </div>
      </div>
      <div className="crm-scroll" style={{ flex: 1 }}>
        {tab === "review" && (
          <>
            {canWrite && <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}` }}><PasteBox onDone={load} onToast={say} /></div>}
            {groups.review.length === 0 ? <Empty>No flats waiting. New ones from marked numbers appear here a few minutes after they're sent.</Empty>
              : groups.review.map((d) => (
                <DraftRow key={d.id} d={d} canWrite={canWrite}
                  onReview={(x) => navigate(`/crm/properties/new?wa=${x.id}`)}
                  onDismiss={(x) => act(() => dismissWaDraft(x.id), "Dismissed")} />
              ))}
          </>
        )}
        {tab === "rented" && (groups.rented.length === 0 ? <Empty>No "rented" messages waiting.</Empty> : groups.rented.map((d) => (
          <DraftRow key={d.id} d={d} canWrite={canWrite}
            onDismiss={(x) => act(() => dismissWaDraft(x.id), "Dismissed")}
            onRented={(x, pid) => act(() => markWaRented(x.id, pid), `${pid} marked rented`)} />
        )))}
        {tab === "reading" && (data.reading.length === 0 ? <Empty>Nothing being read.</Empty> : data.reading.map((b) => (
          <div key={b.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{senderLine(b) || "Pasted"} · {b.messages} message{b.messages === 1 ? "" : "s"}</div>
              <div className="crm-mute" style={{ fontSize: 11.5 }}>
                {b.state === "collecting" ? `Waiting for the rest of the photos · last ${relTime(b.last_message_at)}`
                  : b.state === "error" ? `Couldn't read it: ${b.error}` : "Reading…"}
              </div>
            </div>
            {b.state === "error" && canWrite && <Btn sm onClick={() => act(async () => { await retryWaBatch(b.id); await pokeWaProcess(); }, "Reading it again")}>Retry</Btn>}
          </div>
        )))}
        {tab === "done" && (groups.done.length === 0 ? <Empty>Nothing decided in the last 14 days.</Empty>
          : groups.done.map((d) => <DraftRow key={d.id} d={d} canWrite={canWrite} />))}
        {tab === "numbers" && <NumbersTab canWrite={canWrite} onToast={say} />}
        {tab === "setup" && <SetupTab connection={conn} isSuperAdmin={access.role === "super_admin"} onConnected={load} onToast={say} />}
      </div>
      {tab === "review" && groups.review.length > 0 && (
        <div className="crm-mute" style={{ fontSize: 11, padding: "6px 14px", borderTop: `1px solid ${C.lineSoft}` }}>
          <ExternalLink size={11} /> Review &amp; publish opens the property form filled in from the message. Nothing goes live until you publish it.
        </div>
      )}
      <Toast {...(toast ?? {})} />
    </div>
  );
}
