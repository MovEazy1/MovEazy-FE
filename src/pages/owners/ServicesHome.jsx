/**
 * PRD 11 — Home Services. Urban Company-style discovery over the catalogue the
 * Inventory Ops team keeps in the CRM. Booking picks a property and a
 * preferred time, confirms, and creates a request the team schedules; prices
 * are "from", and anything over the approval limit waits for the owner's yes.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronRight, ClipboardList, Search } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { ServiceIcon } from "./serviceIcons";
import { Chip, Empty, Loading, Sheet, TopBar, toast } from "./ownerUi";
import {
  SERVICE_TABS, SLOTS, createRequest, fetchCatalogue, fmtDate, friendlyError, inr, op, propertyName,
} from "../../lib/owners";

function nextDays(n = 10) {
  const out = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`);
  }
  return out;
}

export function WhenPicker({ date, slot, onDate, onSlot }) {
  const days = useMemo(() => nextDays(10), []);
  return (
    <>
      <div className="oz-field">
        <span className="oz-label">Preferred date</span>
        <div className="oz-chips oz-chips--scroll">
          {days.map((d) => (
            <Chip key={d} on={date === d} onClick={() => onDate(d)}>
              {new Date(`${d}T00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Chip>
          ))}
        </div>
      </div>
      <div className="oz-field">
        <span className="oz-label">Preferred time</span>
        <div className="oz-grid2">
          {SLOTS.map(([k, label, sub]) => (
            <button key={k} type="button" className={`oz-cat${slot === k ? " oz-cat--on" : ""}`} style={{ minHeight: 56 }} onClick={() => onSlot(k)}>
              {label}{sub && <span className="oz-hint" style={{ fontWeight: 400 }}>{sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function BookSheet({ service, onClose }) {
  const navigate = useNavigate();
  const { properties, reloadRequests } = useOwner();
  const [step, setStep] = useState("details");
  const [f, setF] = useState({ property_id: properties?.[0]?.property_id || "", date: nextDays(1)[0], slot: "morning", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const p = (properties ?? []).find((x) => x.property_id === f.property_id);
  const scope = String(service.scope || "").split("\n").map((s) => s.trim()).filter(Boolean);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createRequest({
        kind: "service", service_id: service.id, property_id: f.property_id,
        description: f.notes, preferred_date: f.date, preferred_slot: f.slot,
      });
      await reloadRequests();
      toast("Booked — MovEazy will confirm the time with you");
      navigate(op(`/repairs/${id}`));
    } catch (e) {
      toast(friendlyError(e, "Could not book this service."), "error");
      setBusy(false);
    }
  };

  return (
    <Sheet title={service.title} onClose={onClose}>
      <div className="oz-pad">
        {step === "details" && (
          <>
            <div className="oz-row" style={{ marginBottom: 12 }}>
              <span className="oz-svc-ic"><ServiceIcon id={service.id} category={service.category} /></span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>From {inr(service.from_price)}</div>
                <div className="oz-meta">{service.summary}{service.duration ? ` · ${service.duration}` : ""}</div>
              </div>
            </div>
            {scope.length > 0 && (
              <div className="oz-section" style={{ marginBottom: 12 }}>
                <h2 className="oz-h2" style={{ fontSize: 14 }}>What's included</h2>
                {scope.map((s) => <div key={s} className="oz-row" style={{ gap: 8, padding: "3px 0", fontSize: 14 }}><Check size={15} color="var(--em)" /> {s}</div>)}
              </div>
            )}
            <p className="oz-hint" style={{ margin: "0 0 14px" }}>
              The final price is confirmed before any work starts. Verified MovEazy professionals only.
            </p>
            {(properties ?? []).length === 0 ? (
              <Link to={op("/properties/new")} className="oz-btn oz-btn--primary oz-btn--block">Add a property to book</Link>
            ) : (
              <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={() => setStep("when")}>Book {service.title}</button>
            )}
          </>
        )}
        {step === "when" && (
          <>
            <div className="oz-field">
              <label className="oz-label" htmlFor="bk-prop">Property</label>
              <select id="bk-prop" className="oz-select" value={f.property_id} onChange={(e) => set({ property_id: e.target.value })}>
                {(properties ?? []).map((x) => <option key={x.property_id} value={x.property_id}>{propertyName(x)}</option>)}
              </select>
            </div>
            <WhenPicker date={f.date} slot={f.slot} onDate={(d) => set({ date: d })} onSlot={(s) => set({ slot: s })} />
            <div className="oz-field">
              <label className="oz-label" htmlFor="bk-notes">Anything the professional should know?</label>
              <textarea id="bk-notes" className="oz-textarea" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })}
                placeholder="2 split ACs in the bedrooms; tenant will be home" />
            </div>
            <div className="oz-grid2">
              <button type="button" className="oz-btn" onClick={() => setStep("details")}>Back</button>
              <button type="button" className="oz-btn oz-btn--primary" onClick={() => setStep("confirm")}>Continue</button>
            </div>
          </>
        )}
        {step === "confirm" && (
          <>
            <div className="oz-section">
              <div className="oz-kv">
                <div>Service</div><div>{service.title}</div>
                <div>Property</div><div>{p ? propertyName(p) : "—"}</div>
                <div>When</div><div>{fmtDate(f.date, { weekday: "short", day: "numeric", month: "short" })} · {SLOTS.find((s) => s[0] === f.slot)?.[1]}</div>
                <div>Price</div><div>From {inr(service.from_price)}</div>
              </div>
            </div>
            <div className="oz-grid2">
              <button type="button" className="oz-btn" onClick={() => setStep("when")} disabled={busy}>Back</button>
              <button type="button" className="oz-btn oz-btn--primary" onClick={submit} disabled={busy}>{busy ? "Booking…" : "Confirm booking"}</button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

export default function ServicesHome() {
  const { requests } = useOwner();
  const [catalogue, setCatalogue] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("popular");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetchCatalogue().then(setCatalogue, (e) => { setCatalogue([]); setError(friendlyError(e, "Could not load services.")); });
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (catalogue ?? []).filter((s) => {
      if (needle) return [s.title, s.summary, s.scope, s.category].join(" ").toLowerCase().includes(needle);
      return tab === "popular" ? s.popular : s.category === tab;
    });
  }, [catalogue, tab, q]);
  const active = requests.filter((r) => !["resolved", "cancelled"].includes(r.status)).length;

  return (
    <>
      <TopBar title="Home Services" right={
        <button type="button" className="oz-iconbtn" aria-label="Search services" onClick={() => setSearching((s) => !s)}><Search size={20} /></button>
      } />
      <div className="oz-pad" style={{ paddingTop: 0 }}>
        {searching && (
          <div className="oz-search" style={{ marginBottom: 10 }}>
            <Search size={17} />
            <input className="oz-input" type="search" autoFocus placeholder="AC, cleaning, leak…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <Link to={op("/repairs")} className="oz-card oz-row" style={{ padding: 12, marginBottom: 12, color: "inherit", textDecoration: "none" }}>
          <span className="oz-avatar" style={{ background: "var(--emt)" }}><ClipboardList size={18} /></span>
          <span style={{ flex: 1 }}><strong style={{ display: "block" }}>Repairs & requests</strong>
            <span className="oz-meta">{active ? `${active} in progress` : "Raise a repair or track a booking"}</span></span>
          <ChevronRight size={18} color="#94A09B" />
        </Link>
        {!q && (
          <div className="oz-chips oz-chips--scroll" style={{ marginBottom: 12 }}>
            {SERVICE_TABS.map((t) => <Chip key={t.key} on={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</Chip>)}
          </div>
        )}
        {catalogue === null ? <Loading /> : error ? <Empty>{error}</Empty> : rows.length === 0 ? (
          <Empty>{q ? "No service matches that." : "Nothing in this category yet."}</Empty>
        ) : (
          <div className="oz-list">
            {rows.map((s) => (
              <button key={s.id} type="button" className="oz-card oz-row" onClick={() => setOpen(s)}
                style={{ padding: 12, width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", color: "inherit" }}>
                <span className="oz-svc-ic"><ServiceIcon id={s.id} category={s.category} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 15.5 }}>{s.title}</strong>
                  <span style={{ display: "block", fontSize: 14, color: "var(--em)", fontWeight: 600 }}>From {inr(s.from_price)}</span>
                  <span className="oz-meta">{s.summary}</span>
                </span>
                <ChevronRight size={18} color="#94A09B" />
              </button>
            ))}
          </div>
        )}
      </div>
      {open && <BookSheet service={open} onClose={() => setOpen(null)} />}
    </>
  );
}
