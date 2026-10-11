/**
 * Leads → MovEazy leads.
 *
 *   My assigned leads   what MovEazy gave this broker: name, number, what they
 *                       want. WhatsApp and Call are logged against the lead
 *                       (the CRM sees who reached out); status as they work it,
 *                       Closed with the month's rent and how the deal went.
 *   Get leads           10 free (once) · 30 for ₹2,000 (UPI QR, then the UTR) ·
 *                       Premium: unlimited, 10 a request, pay only on closures.
 *   Who's looking       totals only — BHK × area, move-in, budget. Never a name
 *                       or a number until MovEazy assigns them.
 *
 * Rules and amounts live in MovEazy-BE/supabase/partner_moveazy_leads.sql.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, Copy, Crown, Gift, IndianRupee, MapPin, Phone, Wallet } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Empty, Loading, Sheet, WhatsAppIcon, toast } from "./partnerUi";
import { QrImage } from "../../components/QrPosterBlock";
import { friendlyError, pp, waLink } from "../../lib/partners";
import {
  ASSIGNED_STATUS, BUDGET_BANDS, MOVEAZY_DESK, PACKS, REQUEST_STATUS, cleanUtr, closureDue, fetchLeadStats,
  fetchMyAssignedLeads, fetchMyLeadRequests, isUtr, leadNeedLine, logReachOut, moreLeadsMessage, moveInRows,
  onlinePaymentReady, requestLeads, startLeadPayment, topSets, updateAssignedLead, upiLink,
} from "../../lib/partnerLeads";

const BHKS = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "Room in Preoccupied flat"];
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const ago = (t) => {
  const d = Math.round((Date.now() - new Date(t).getTime()) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

function Bar({ label, n, max }) {
  return (
    <div style={{ padding: "7px 0" }}>
      <div className="pz-between" style={{ fontSize: 14 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <strong style={{ flex: "none", marginLeft: 8 }}>{n}</strong>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--line)", marginTop: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${max ? Math.max(3, (n / max) * 100) : 0}%`, background: "var(--g)", borderRadius: 99 }} />
      </div>
    </div>
  );
}

/* ── One assigned lead ────────────────────────────────────────────────────── */

function AssignedLead({ lead, me, onChanged, onClose }) {
  const [busy, setBusy] = useState(false);
  const reach = async (channel) => {
    // Opened first: a phone may not wait for the network before leaving the page.
    if (channel === "whatsapp") {
      const first = String(lead.name || "").split(" ")[0];
      window.open(waLink(lead.phone, `Hi ${first || "there"}, this is ${me?.name || "your broker"} from MovEazy Partners — you're looking for a flat${lead.localities?.length ? ` in ${lead.localities[0]}` : ""}? I have options for you.`), "_blank", "noopener");
    } else {
      window.location.href = `tel:+91${String(lead.phone).replace(/\D/g, "").slice(-10)}`;
    }
    try { await logReachOut(lead.id, channel); onChanged(); } catch { /* the call matters more than the log */ }
  };
  const setStatus = async (status) => {
    if (status === "closed") { onClose(lead); return; }
    setBusy(true);
    try { await updateAssignedLead(lead.id, status); onChanged(); } catch (e) { toast(friendlyError(e), "error"); } finally { setBusy(false); }
  };
  return (
    <div style={{ padding: 14, borderTop: "1px solid var(--line)" }}>
      <div className="pz-between" style={{ alignItems: "flex-start", gap: 10 }}>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 16 }}>{lead.name || "MovEazy client"}</strong>
          <span className="pz-meta" style={{ display: "block" }}>{lead.phone}</span>
        </span>
        <span className={`pz-pill${lead.status === "closed" ? "" : " pz-pill--grey"}`} style={{ flex: "none" }}>{ASSIGNED_STATUS[lead.status]}</span>
      </div>
      {leadNeedLine(lead) && <div style={{ fontSize: 14, marginTop: 6 }}>{leadNeedLine(lead)}</div>}
      <div className="pz-hint" style={{ marginTop: 2 }}>
        Given {ago(lead.assigned_at)}{lead.last_reach_at ? ` · you reached out ${ago(lead.last_reach_at)}` : " · not contacted yet"}
        {lead.pack === "premium" ? " · Premium" : ""}
      </div>
      {lead.status === "closed" ? (
        <div className="pz-hint" style={{ marginTop: 6, color: "var(--g)", fontWeight: 600 }}>
          Closed at {inr(lead.closed_rent)}/month{Number(lead.due_amount) > 0 ? ` · ${inr(lead.due_amount)} due to MovEazy` : ""}
        </div>
      ) : (
        <>
          <div className="pz-row" style={{ gap: 8, marginTop: 10 }}>
            <button type="button" className="pz-btn pz-btn--gold pz-btn--sm" onClick={() => reach("whatsapp")}><WhatsAppIcon size={15} /> WhatsApp</button>
            <button type="button" className="pz-btn pz-btn--sm" onClick={() => reach("call")}><Phone size={15} /> Call</button>
          </div>
          <div className="pz-chips" style={{ marginTop: 8 }}>
            {["contacted", "visit", "closed", "not_interested"].map((s) => (
              <Chip key={s} on={lead.status === s} disabled={busy} onClick={() => setStatus(s)}>{ASSIGNED_STATUS[s]}</Chip>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Closing a lead ───────────────────────────────────────────────────────── */

function CloseSheet({ lead, onDone, onCancel }) {
  const [rent, setRent] = useState("");
  const [deal, setDeal] = useState("");
  const [busy, setBusy] = useState(false);
  const due = closureDue(rent, deal, lead.pack);
  const save = async () => {
    if (Number(rent) < 1000) { toast("Enter the monthly rent", "error"); return; }
    if (!deal) { toast("Say how the deal went", "error"); return; }
    setBusy(true);
    try {
      await updateAssignedLead(lead.id, "closed", Number(rent), deal);
      toast("Marked closed — congratulations!");
      onDone();
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
    }
  };
  return (
    <Sheet title={`Closed: ${lead.name || "lead"}`} onClose={onCancel}>
      <div className="pz-pad">
        <div className="pz-field">
          <label className="pz-label" htmlFor="cl-rent">Monthly rent (₹)</label>
          <input id="cl-rent" className="pz-input" inputMode="numeric" value={rent} placeholder="30000"
            onChange={(e) => setRent(e.target.value.replace(/\D/g, "").slice(0, 7))} />
        </div>
        <div className="pz-field">
          <span className="pz-label">How did the deal go?</span>
          {[["direct", "I dealt with the owner directly"], ["shared", "More than one broker was involved"]].map(([k, label]) => (
            <label key={k} className="pz-radio" style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0" }}>
              <input type="radio" name="deal" checked={deal === k} onChange={() => setDeal(k)} /> {label}
            </label>
          ))}
        </div>
        {lead.pack === "premium" && deal && Number(rent) >= 1000 && (
          <p className="pz-hint" style={{ margin: "0 0 12px" }}>
            MovEazy's share on a Premium lead: <strong>{inr(due)}</strong> ({deal === "direct" ? "30" : "20"}% of one month's rent). The team will be in touch.
          </p>
        )}
        <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Mark closed"}</button>
      </div>
    </Sheet>
  );
}

/* ── Asking for leads ─────────────────────────────────────────────────────── */

function RequestSheet({ pack, stats, myAreas, me, onDone, onCancel }) {
  const areaOptions = useMemo(() => {
    const fromStats = topSets(stats?.bhk_area ?? [], myAreas, 30).map((p) => p.area).filter((a) => a !== "Anywhere");
    return [...new Set([...myAreas, ...fromStats])].slice(0, 14);
  }, [stats, myAreas]);
  const [areas, setAreas] = useState(() => myAreas.slice(0, 3));
  const [bhk, setBhk] = useState([]);
  const [bmin, setBmin] = useState("");
  const [bmax, setBmax] = useState("");
  const [step, setStep] = useState("prefs");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const price = stats?.pack_price ?? 2000;
  const upi = stats?.upi_id || "";
  const link = upiLink({ vpa: upi, amount: price, note: "30 MovEazy leads" });
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const prefs = () => ({ areas, flat_types: bhk, budget_min: bmin || null, budget_max: bmax || null });

  // Razorpay when it's set up; otherwise (or if it fails to start) the UPI QR and UTR.
  const toPayment = async () => {
    setBusy(true);
    try {
      if (await onlinePaymentReady()) {
        const r = await requestLeads("paid30", prefs(), "", true);
        const url = await startLeadPayment(r.id);
        if (url) { window.location.href = url; return; }
      }
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
      return;
    }
    setBusy(false);
    setStep("pay");
  };

  const submit = async () => {
    if (pack === "paid30" && !isUtr(utr)) { toast("Enter the UTR / reference number from your payment app", "error"); return; }
    setBusy(true);
    try {
      const r = await requestLeads(pack, prefs(), pack === "paid30" ? cleanUtr(utr) : "");
      if (r?.status === "needs_approval") {
        const a = stats?.allowance ?? {};
        window.open(waLink(MOVEAZY_DESK, moreLeadsMessage(me?.name, a.premium_given, a.premium_closed)), "_blank", "noopener");
        toast("Sent to MovEazy for approval");
      } else {
        toast(pack === "paid30" ? "Got it — we'll check the payment and assign your leads" : "Request sent — MovEazy is picking your leads");
      }
      onDone();
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
    }
  };

  return (
    <Sheet title={`${PACKS[pack].title}${pack === "paid30" ? ` · ${inr(price)}` : pack === "free10" ? " · free" : " · Premium"}`} onClose={onCancel}>
      <div className="pz-pad">
        {step === "prefs" ? (
          <>
            <p className="pz-hint" style={{ margin: "0 0 12px" }}>What kind of tenants do you want? MovEazy picks leads that fit.</p>
            <div className="pz-field">
              <span className="pz-label">Areas</span>
              <div className="pz-chips">
                {areaOptions.map((a) => <Chip key={a} on={areas.includes(a)} onClick={() => toggle(areas, setAreas, a)}>{a}</Chip>)}
              </div>
            </div>
            <div className="pz-field">
              <span className="pz-label">BHK</span>
              <div className="pz-chips">
                {BHKS.map((b) => <Chip key={b} on={bhk.includes(b)} onClick={() => toggle(bhk, setBhk, b)}>{b.replace("Room in Preoccupied flat", "Room")}</Chip>)}
              </div>
            </div>
            <div className="pz-field" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label><span className="pz-label">Budget from (₹)</span>
                <input className="pz-input" inputMode="numeric" value={bmin} placeholder="15000" onChange={(e) => setBmin(e.target.value.replace(/\D/g, "").slice(0, 7))} /></label>
              <label><span className="pz-label">Budget up to (₹)</span>
                <input className="pz-input" inputMode="numeric" value={bmax} placeholder="40000" onChange={(e) => setBmax(e.target.value.replace(/\D/g, "").slice(0, 7))} /></label>
            </div>
            {pack === "premium" && (
              <p className="pz-hint" style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
                Premium: up to 10 leads a request, one request every 3 days, nothing to pay now. On a closure MovEazy takes 30% of one
                month's rent if you dealt with the owner directly, 20% if more than one broker was involved. Every 20 leads need a closure
                before the next set.
              </p>
            )}
            {pack === "paid30" ? (
              <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={toPayment} disabled={busy}>{busy ? "Opening payment…" : `Next: pay ${inr(price)}`}</button>
            ) : (
              <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={submit} disabled={busy}>{busy ? "Sending…" : `Ask for ${PACKS[pack].count} leads`}</button>
            )}
          </>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 10px", fontSize: 15 }}>Scan with any UPI app and pay <strong>{inr(price)}</strong></p>
              {link ? (
                <div style={{ display: "inline-block", padding: 10, background: "#fff", borderRadius: 14, border: "1px solid var(--line)" }}>
                  <QrImage url={link} size={210} title="Pay MovEazy by UPI" />
                </div>
              ) : <p className="pz-err">Payment isn't set up yet — message MovEazy on WhatsApp.</p>}
              {upi && (
                <div className="pz-row" style={{ justifyContent: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ fontWeight: 600 }}>{upi}</span>
                  <button type="button" className="pz-iconbtn" aria-label="Copy UPI ID"
                    onClick={() => navigator.clipboard?.writeText(upi).then(() => toast("UPI ID copied"), () => {})}><Copy size={16} /></button>
                </div>
              )}
              {link && <a className="pz-btn pz-btn--sm" href={link} style={{ marginTop: 8 }}>Open a UPI app</a>}
            </div>
            <div className="pz-field" style={{ marginTop: 18 }}>
              <label className="pz-label" htmlFor="utr">After paying, enter the UTR / reference number</label>
              <input id="utr" className="pz-input" value={utr} placeholder="e.g. 412345678901" autoComplete="off"
                onChange={(e) => setUtr(e.target.value.slice(0, 40))} />
              <span className="pz-hint">It's on the payment's success screen in your UPI app (12 digits).</span>
            </div>
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={submit} disabled={busy || !isUtr(utr)}>
              {busy ? "Sending…" : "I've paid — submit"}
            </button>
            <button type="button" className="pz-btn pz-btn--ghost pz-btn--block" onClick={() => setStep("prefs")} style={{ marginTop: 6 }}>Back</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ── The tab ──────────────────────────────────────────────────────────────── */

/** `me`: the broker, from the partner app (or passed in). */
export default function MoveazyLeads({ me: meProp = null }) {
  const ctx = usePartner();
  const me = meProp ?? ctx?.me ?? null;
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [requests, setRequests] = useState([]);
  const [assigned, setAssigned] = useState(null);
  const [asking, setAsking] = useState(null);
  const [closing, setClosing] = useState(null);
  const [allSets, setAllSets] = useState(false);
  const myAreas = useMemo(() => me?.operational_areas ?? [], [me]);
  const [params, setParams] = useSearchParams();

  // Back from Razorpay: its webhook opens the request; say so and tidy the URL.
  useEffect(() => {
    if (params.get("paid") !== "1") return;
    toast("Payment received — MovEazy is picking your 30 leads");
    setParams({ tab: "moveazy" }, { replace: true });
  }, [params, setParams]);

  const load = useCallback(() => {
    fetchLeadStats().then(setStats, (e) => setErr(friendlyError(e, "Couldn't load MovEazy leads.")));
    fetchMyLeadRequests().then(setRequests, () => setRequests([]));
    fetchMyAssignedLeads().then(setAssigned, () => setAssigned([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err) return <Empty>{err}</Empty>;
  if (!stats || assigned === null) return <Loading />;

  const allow = stats.allowance ?? {};
  const openReq = requests.find((r) => ["payment_check", "needs_approval", "open"].includes(r.status));
  const sets = topSets(stats.bhk_area, myAreas, allSets ? 40 : 8);
  const setMax = Math.max(1, ...sets.map((s) => s.n));
  const moveRows = moveInRows(stats.move_in);
  const moveMax = Math.max(1, ...moveRows.map((r) => r[1]));
  const budgetMax = Math.max(1, ...BUDGET_BANDS.map(([k]) => stats.budget?.[k] ?? 0));
  const premiumWait = allow.premium_next_at
    ? new Date(allow.premium_next_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "";

  const packCard = (id, icon, line, cta, disabledReason) => (
    <button key={id} type="button" className="pz-card" disabled={Boolean(disabledReason) || Boolean(openReq)}
      onClick={() => setAsking(id)}
      style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, width: "100%", textAlign: "left", marginBottom: 10,
        opacity: disabledReason || openReq ? 0.55 : 1, cursor: disabledReason || openReq ? "default" : "pointer", font: "inherit", color: "inherit" }}>
      <span className="pz-avatar" style={{ background: "var(--goldg)", color: "#1F1605" }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 15.5 }}>{PACKS[id].title} <span className="pz-hint" style={{ fontWeight: 600 }}>· {line}</span></strong>
        <span className="pz-hint">{disabledReason || PACKS[id].sub}</span>
      </span>
      <span className="pz-btn pz-btn--sm pz-btn--primary" style={{ flex: "none" }}>{cta}</span>
    </button>
  );

  return (
    <div className="pz-pad">
      {assigned.length > 0 && (
        <div className="pz-card" style={{ marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px 4px" }}>
            <strong style={{ fontSize: 16 }}>My assigned leads · {assigned.length}</strong>
            <span className="pz-hint" style={{ display: "block" }}>From MovEazy. WhatsApp and calls are noted so MovEazy knows who reached out.</span>
          </div>
          {assigned.map((l) => <AssignedLead key={l.id} lead={l} me={me} onChanged={load} onClose={setClosing} />)}
        </div>
      )}

      {openReq && (
        <div className="pz-card" style={{ padding: 14, marginBottom: 14, borderColor: "var(--gold)" }}>
          <strong style={{ display: "block" }}>{REQUEST_STATUS[openReq.status]}</strong>
          <span className="pz-hint">
            {PACKS[openReq.pack]?.title} requested {ago(openReq.created_at)} · {openReq.assigned}/{openReq.lead_count} assigned
            {openReq.status === "needs_approval" ? " · MovEazy will message you on WhatsApp" : ""}
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 17, margin: "4px 0 10px" }}>Get MovEazy leads</h2>
      {packCard("free10", <Gift size={18} />, "free", "Get", allow.free_used ? "Already used" : "")}
      {packCard("paid30", <Wallet size={18} />, inr(stats.pack_price), "Buy", "")}
      {stats.premium
        ? packCard("premium", <Crown size={18} />, "10 a request", "Ask",
          premiumWait ? `Next request after ${premiumWait}` : allow.premium_needs_approval ? "Needs MovEazy's OK (on WhatsApp) — close one first to skip" : "")
        : (
          <Link to={pp("/premium")} className="pz-card" style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, marginBottom: 10, color: "inherit", textDecoration: "none" }}>
            <span className="pz-avatar" style={{ background: "var(--noir)", color: "#D4A437" }}><Crown size={18} /></span>
            <span style={{ flex: 1 }}><strong style={{ display: "block" }}>Unlimited with Premium</strong>
              <span className="pz-hint">No upfront cost for leads — pay MovEazy only when one closes.</span></span>
            <span className="pz-btn pz-btn--sm" style={{ flex: "none" }}>See Premium</span>
          </Link>
        )}

      <h2 style={{ fontSize: 17, margin: "18px 0 4px" }}>Who's looking right now</h2>
      <p className="pz-hint" style={{ margin: "0 0 10px" }}>
        <strong>{stats.total}</strong> MovEazy clients actively looking.
        Names and numbers come once MovEazy assigns leads to you.
      </p>
      <div className="pz-card" style={{ padding: "8px 14px", marginBottom: 12 }}>
        <div className="pz-label" style={{ margin: "6px 0 2px", display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} /> By BHK and area</div>
        {sets.length === 0 ? <p className="pz-hint">No one yet.</p> : sets.map((s) => (
          <Bar key={`${s.bhk}|${s.area}`} label={`${s.bhk === "Any" ? "Any BHK" : s.bhk.replace("Room in Preoccupied flat", "Room")} in ${s.area === "Anywhere" ? "any area" : s.area}${myAreas.includes(s.area) ? " ★" : ""}`} n={s.n} max={setMax} />
        ))}
        {(stats.bhk_area ?? []).length > 8 && (
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" onClick={() => setAllSets((v) => !v)} style={{ margin: "4px 0" }}>
            {allSets ? "Show fewer" : "Show more"}
          </button>
        )}
      </div>
      <div className="pz-card" style={{ padding: "8px 14px", marginBottom: 12 }}>
        <div className="pz-label" style={{ margin: "6px 0 2px", display: "flex", alignItems: "center", gap: 6 }}><CalendarClock size={13} /> By move-in</div>
        {moveRows.map(([label, n]) => <Bar key={label} label={label} n={n} max={moveMax} />)}
      </div>
      <div className="pz-card" style={{ padding: "8px 14px", marginBottom: 12 }}>
        <div className="pz-label" style={{ margin: "6px 0 2px", display: "flex", alignItems: "center", gap: 6 }}><IndianRupee size={13} /> By budget</div>
        {BUDGET_BANDS.map(([k, label]) => <Bar key={k} label={label} n={stats.budget?.[k] ?? 0} max={budgetMax} />)}
      </div>

      {requests.length > 0 && (
        <details style={{ marginBottom: 20 }}>
          <summary className="pz-hint" style={{ cursor: "pointer" }}>Your requests ({requests.length})</summary>
          {requests.map((r) => (
            <div key={r.id} className="pz-hint" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              {PACKS[r.pack]?.title} · {REQUEST_STATUS[r.status]} · {r.assigned}/{r.lead_count} · {ago(r.created_at)}
              {r.utr ? ` · UTR ${r.utr}` : ""}{r.note ? ` · ${r.note}` : ""}
            </div>
          ))}
        </details>
      )}

      {asking && (
        <RequestSheet pack={asking} stats={stats} myAreas={myAreas} me={me}
          onDone={() => { setAsking(null); load(); }} onCancel={() => setAsking(null)} />
      )}
      {closing && <CloseSheet lead={closing} onDone={() => { setClosing(null); load(); }} onCancel={() => setClosing(null)} />}
    </div>
  );
}
