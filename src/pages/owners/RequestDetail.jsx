/**
 * One request: what was asked, who is coming, what it costs, and what has
 * happened. A quote at or above the approval limit waits here for the owner's
 * yes or no; the ops team's internal notes never reach this screen.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarClock, IndianRupee, Phone, UserRound } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { ServiceIcon } from "./serviceIcons";
import { Confirm, Empty, Loading, Pill, TopBar, WhatsAppIcon, toast } from "./ownerUi";
import {
  REQUEST_STATUS, SLOTS, cancelRequest, fmtDate, fmtDateTime, friendlyError, inr, op, propertyName, respondQuote,
  signedUrl, teamWa, telLink,
} from "../../lib/owners";

function Photos({ paths }) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    let alive = true;
    Promise.all(paths.map((p) => signedUrl(p, 600))).then((u) => { if (alive) setUrls(u.filter(Boolean)); });
    return () => { alive = false; };
  }, [paths]);
  if (!urls.length) return null;
  return (
    <div className="oz-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="oz-thumb" style={{ width: 84, height: 84 }}><img src={u} alt="Issue photo" /></a>)}
    </div>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { requests, setRequests, reloadRequests, byId } = useOwner();
  const r = requests.find((x) => x.id === id);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!r) return <><TopBar title="Request" back={op("/repairs")} />{requests.length ? <Empty>Request not found.</Empty> : <Loading />}</>;

  const st = REQUEST_STATUS[r.status] || REQUEST_STATUS.open;
  const p = byId.get(r.property_id);
  const others = (r.property_ids ?? []).filter((x) => x !== r.property_id).map((x) => byId.get(x)).filter(Boolean);
  const done = ["resolved", "cancelled"].includes(r.status);

  const act = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      await reloadRequests();
      toast(message);
      setConfirm(null);
    } catch (e) {
      toast(friendlyError(e), "error");
      await reloadRequests();
    } finally {
      setBusy(false);
    }
  };
  // Optimistic for the one tap that matters most, so the button doesn't sit there.
  const approve = () => {
    setRequests((rs) => rs.map((x) => (x.id === id ? { ...x, quote_status: "approved", status: "in_progress" } : x)));
    act(() => respondQuote(id, true), "Quote approved — work will be scheduled");
  };

  return (
    <>
      <TopBar title={r.kind === "designer_call" ? "Designer call" : "Request"} back={op("/repairs")} />
      <div className="oz-pad">
        <div className="oz-row" style={{ alignItems: "flex-start", marginBottom: 14 }}>
          <span className="oz-svc-ic"><ServiceIcon id={r.service_id} category={r.category} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{r.title}</h2>
            <div className="oz-meta">{p ? propertyName(p) : r.property_id}{others.length ? ` + ${others.length} more` : ""}</div>
            <div className="oz-hint">Raised {fmtDate(r.created_at)}</div>
          </div>
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>

        {r.quote_status === "pending" && (
          <div className="oz-section" style={{ borderColor: "#F2D99A", background: "#FFFBF0" }}>
            <h2 className="oz-h2"><span className="oz-row" style={{ gap: 6 }}><IndianRupee size={17} /> Quote waiting for you</span></h2>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{inr(r.quote_amount)}</div>
            {r.quote_note && <p className="oz-meta" style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{r.quote_note}</p>}
            <div className="oz-grid2" style={{ marginTop: 12 }}>
              <button type="button" className="oz-btn" onClick={() => setConfirm("decline")} disabled={busy}>Decline</button>
              <button type="button" className="oz-btn oz-btn--primary" onClick={approve} disabled={busy}>Approve</button>
            </div>
          </div>
        )}

        {(r.vendor_name || r.scheduled_at || r.quote_amount != null || r.final_cost != null) && (
          <div className="oz-section">
            {r.vendor_name && (
              <div className="oz-row" style={{ marginBottom: 10 }}>
                <span className="oz-avatar"><UserRound size={17} /></span>
                <span style={{ flex: 1 }}><strong style={{ display: "block" }}>{r.vendor_name}</strong><span className="oz-meta">Verified MovEazy professional</span></span>
                {r.vendor_phone && <a className="oz-iconbtn" href={telLink(r.vendor_phone)} aria-label="Call the professional"><Phone size={19} color="var(--em)" /></a>}
              </div>
            )}
            {r.scheduled_at && (
              <div className="oz-row" style={{ gap: 8, fontSize: 15, fontWeight: 600, color: "var(--deep)" }}>
                <CalendarClock size={17} /> {fmtDateTime(r.scheduled_at)}
              </div>
            )}
            {(r.final_cost != null || (r.quote_amount != null && r.quote_status !== "pending")) && (
              <div className="oz-kv" style={{ marginTop: 8 }}>
                {r.quote_amount != null && r.quote_status !== "pending" && (<><div>Quote</div><div>{inr(r.quote_amount)} · {r.quote_status}</div></>)}
                {r.final_cost != null && (<><div>Final cost</div><div>{inr(r.final_cost)}</div></>)}
              </div>
            )}
          </div>
        )}

        <div className="oz-section">
          <h2 className="oz-h2">Details</h2>
          <div className="oz-kv">
            <div>Preferred</div>
            <div>{r.preferred_date ? fmtDate(r.preferred_date, { weekday: "short", day: "numeric", month: "short" }) : "Any day"} · {SLOTS.find((s) => s[0] === r.preferred_slot)?.[1] || "Any time"}</div>
            {others.length > 0 && (<><div>Properties</div><div>{[p, ...others].filter(Boolean).map(propertyName).join(", ")}</div></>)}
          </div>
          {r.description && <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.description}</p>}
          <Photos paths={r.photos ?? []} />
        </div>

        <div className="oz-section">
          <h2 className="oz-h2">Timeline</h2>
          <div className="oz-timeline">
            {[...r.events].reverse().map((e) => (
              <div key={`${e.at}-${e.message}`}>
                <strong style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{e.message}</strong>
                <span className="oz-meta">{fmtDateTime(e.at)}</span>
              </div>
            ))}
          </div>
        </div>

        <a className="oz-btn" style={{ width: "100%", marginBottom: 10 }} target="_blank" rel="noreferrer"
          href={teamWa(`Hi MovEazy, about my request "${r.title}" for ${p ? propertyName(p) : r.property_id} — `)}>
          <WhatsAppIcon /> Message MovEazy about this
        </a>
        {!done && (
          <button type="button" className="oz-btn oz-btn--ghost oz-btn--danger" style={{ width: "100%" }} onClick={() => setConfirm("cancel")}>
            Cancel request
          </button>
        )}
      </div>
      {confirm === "decline" && (
        <Confirm title="Decline this quote?" danger busy={busy} confirmLabel="Decline"
          body="MovEazy will get back to you with another option. Nothing is charged." onClose={() => setConfirm(null)}
          onConfirm={() => act(() => respondQuote(id, false), "Quote declined")} />
      )}
      {confirm === "cancel" && (
        <Confirm title="Cancel this request?" danger busy={busy} confirmLabel="Cancel request" onClose={() => setConfirm(null)}
          body="If a professional is already scheduled, MovEazy will let them know." onConfirm={() => act(() => cancelRequest(id), "Request cancelled")} />
      )}
    </>
  );
}
