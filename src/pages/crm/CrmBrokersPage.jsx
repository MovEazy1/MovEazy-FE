/**
 * Brokers: who they are, how to reach them, and what each has been worth.
 *
 * Every broker ever picked on the upload form is here, plus anyone added by
 * hand. Per broker: flats shared, how many are still live, visits those flats
 * drew, deals closed on them, and the brokerage those deals brought in — each
 * worked out by following the visit or the deal back to the flat, so the
 * numbers can't drift from the data.
 *
 * Staff only. The directory lives in crm_brokers, which no signed-out visitor
 * and no tenant account can read (crm_property_internal.sql).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Toast, inr, shortDate } from "./crmUi";
import { SCOPES } from "../../lib/adminScopes";
import { whatsappUrl } from "../../lib/crmSettings";
import { formatForDisplay, normalizeIndianMobile } from "../../lib/mobile";
import { fetchBrokers, upsertBroker } from "../../lib/crmPropertyInternal";
import {
  BROKER_SORTS, brokerStats, fetchAllVisitBookings, fetchBrokerLinks, inrShort, inventoryRequestMessage,
  sortBrokers,
} from "../../lib/crmBrokers";

const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

function NewBrokerForm({ actorEmail, onSaved, onCancel, onToast }) {
  const [f, setF] = useState({ name: "", phone: "", agency: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return onToast("A broker needs a name", "error");
    if (f.phone.trim() && !normalizeIndianMobile(f.phone)) {
      return onToast("That doesn't look like a 10-digit mobile number", "error");
    }
    setSaving(true);
    try {
      const row = await upsertBroker(f, actorEmail);
      if (!row?.id) throw new Error("Could not save this broker");
      onSaved(row);
    } catch (err) {
      onToast(err?.message || "Could not save this broker", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="crm-card" style={{ margin: "0 12px 12px", display: "grid", gap: 8,
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      <input className="crm-input" placeholder="Name *" value={f.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
      <input className="crm-input" placeholder="Mobile" inputMode="numeric" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
      <input className="crm-input" placeholder="Agency" value={f.agency} onChange={(e) => set({ agency: e.target.value })} />
      <input className="crm-input" placeholder="Email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
      <input className="crm-input" placeholder="Notes — areas they cover, how they like to be reached" value={f.notes}
        onChange={(e) => set({ notes: e.target.value })} style={{ gridColumn: "1 / -1" }} />
      <div style={{ display: "flex", gap: 6, alignItems: "center", gridColumn: "1 / -1" }}>
        <Btn variant="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save broker"}</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
        {/* Matched on the number, so re-adding someone never makes a second row. */}
        <span className="crm-mute" style={{ fontSize: 11 }}>A broker already saved with this number is reused, not duplicated.</span>
      </div>
    </form>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ padding: "8px 12px", minWidth: 0 }}>
      <div className="crm-label">{label}</div>
      <div className="crm-num" style={{ fontSize: 17, fontWeight: 800, color: C.text, marginTop: 2 }}>{value}</div>
      {sub && <div className="crm-mute crm-num" style={{ fontSize: 10.5 }}>{sub}</div>}
    </div>
  );
}

export default function CrmBrokersPage() {
  const { inventory, clients, requirements, access, user } = useCrm();
  const actorEmail = access.email || user?.email || "";
  const agentName = user?.name || actorEmail.split("@")[0] || "the team";
  const canWrite = access.has(SCOPES.PROPERTIES_WRITE);

  const [brokers, setBrokers] = useState([]);
  const [links, setLinks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("flats");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState("");
  const [copied, setCopied] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Loaded when the tab opens, not with the rest of the CRM: nothing else needs
  // it, and every other tab would pay for three more requests otherwise.
  const load = useCallback(async () => {
    setLoading(true);
    const [b, l, v] = await Promise.all([fetchBrokers(), fetchBrokerLinks(), fetchAllVisitBookings()]);
    setBrokers(b);
    setLinks(l);
    setBookings(v);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(
    () => brokerStats({ brokers, links, inventory, bookings, clients }),
    [brokers, links, inventory, bookings, clients],
  );

  /**
   * Where our open demand is — the areas active clients are asking for — so
   * the inventory request asks for flats we can actually place.
   */
  const demandAreas = useMemo(() => {
    const open = new Set(clients.filter((c) => !["closed_by_us", "closed_outside"].includes(c.status)).map((c) => c.id));
    const n = new Map();
    for (const r of requirements) {
      if (!open.has(r.client_id)) continue;
      for (const a of r.localities ?? []) n.set(a, (n.get(a) || 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a);
  }, [clients, requirements]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? brokers.filter((b) => [b.name, b.agency, b.phone, b.email, b.notes].join(" ").toLowerCase().includes(needle))
      : brokers;
    return sortBrokers(list, stats, sort);
  }, [brokers, stats, q, sort]);

  const totals = useMemo(() => {
    const t = { flats: 0, active: 0, visits: 0, closures: 0, revenue: 0, received: 0 };
    for (const s of stats.values()) for (const k of Object.keys(t)) t[k] += s[k] || 0;
    return t;
  }, [stats]);

  const listingById = useMemo(() => new Map(inventory.map((f) => [f.property_id, f])), [inventory]);

  const call = async (b) => {
    const digits = normalizeIndianMobile(b.phone);
    if (!digits) return;
    if (isTouch) {
      window.location.assign(`tel:+91${digits}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(digits);
      setCopied(b.id);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      showToast("Could not copy the number", "error");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">Brokers · {brokers.length}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn sm onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Btn>
          {canWrite && (
            <Btn sm variant={adding ? undefined : "primary"} onClick={() => setAdding((v) => !v)}>
              {adding ? "Close" : "+ New broker"}
            </Btn>
          )}
        </div>
      </div>

      {/* Across every broker, the same six numbers as each row. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        borderBottom: `1px solid ${C.line}`, background: C.surface, flex: "none",
      }}>
        <Stat label="Flats shared" value={totals.flats} />
        <Stat label="Active" value={totals.active} />
        <Stat label="Visits" value={totals.visits} />
        <Stat label="Closures" value={totals.closures} />
        <Stat label="Revenue" value={inrShort(totals.revenue)} sub={`${inrShort(totals.received)} received`} />
      </div>

      <div style={{ padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
        <input className="crm-input" style={{ maxWidth: 280 }} placeholder="Search name, agency, phone…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="crm-label" style={{ flex: "none" }}>Sort</span>
          <select className="crm-input" value={sort} onChange={(e) => setSort(e.target.value)}>
            {BROKER_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        {demandAreas.length > 0 && (
          <span className="crm-mute" style={{ fontSize: 11 }}>
            &ldquo;Ask for flats&rdquo; asks about {demandAreas.join(", ")} — where open clients want to live.
          </span>
        )}
      </div>

      {adding && (
        <NewBrokerForm
          actorEmail={actorEmail}
          onToast={showToast}
          onCancel={() => setAdding(false)}
          onSaved={(row) => {
            const existed = brokers.some((b) => b.id === row.id);
            setBrokers((list) => (existed ? list.map((b) => (b.id === row.id ? { ...b, ...row } : b)) : [row, ...list]));
            setAdding(false);
            showToast(existed ? `${row.name} was already saved — reused` : `${row.name} added`);
          }}
        />
      )}

      <div className="crm-scroll" style={{ flex: 1 }}>
        {loading && brokers.length === 0 ? (
          <Empty>Loading…</Empty>
        ) : rows.length === 0 ? (
          <Empty>
            {q.trim() ? "No broker matches that."
              : "No brokers yet. Add one here, or pick “Broker” under Property via when uploading a flat."}
          </Empty>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Broker</th>
                <th>Phone</th>
                <th title="Flats credited to them — by the upload form, or posted from their number">Flats shared</th>
                <th title="Still published on the site">Active</th>
                <th title="Visits booked on their flats, not counting cancelled">Visits</th>
                <th title="Deals closed by us on their flats">Closures</th>
                <th title="Brokerage on those deals; the smaller figure is what has arrived">Revenue</th>
                <th>Last flat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const s = stats.get(b.id) ?? {};
                const open = openId === b.id;
                const wa = whatsappUrl(b.phone, inventoryRequestMessage({ brokerName: b.name, agentName, areas: demandAreas }));
                return [
                  <tr key={b.id}>
                    <td>
                      <button type="button" onClick={() => setOpenId(open ? "" : b.id)}
                        title={open ? "Hide their flats" : "Show their flats"}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit" }}>
                        <span style={{ display: "block", fontWeight: 700, color: C.text }}>
                          {open ? "▾ " : "▸ "}{b.name}
                        </span>
                        {(b.agency || b.notes) && (
                          <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>
                            {[b.agency, b.notes].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="crm-num">{b.phone ? formatForDisplay(b.phone) : <span className="crm-mute">—</span>}</td>
                    <td className="crm-num">{s.flats || 0}</td>
                    <td className="crm-num">{s.active || 0}</td>
                    <td className="crm-num">{s.visits || 0}</td>
                    <td className="crm-num">{s.closures || 0}</td>
                    <td className="crm-num">
                      {s.revenue ? inr(s.revenue) : "—"}
                      {s.revenue > 0 && (
                        <span className="crm-mute" style={{ display: "block", fontSize: 10.5 }}>
                          {inrShort(s.received)} received
                        </span>
                      )}
                    </td>
                    <td className="crm-mute crm-num">{s.lastSharedAt ? shortDate(new Date(s.lastSharedAt).toISOString()) : "never"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {wa ? (
                          <a className="crm-btn crm-btn--sm crm-btn--wa" href={wa} target="_blank" rel="noopener noreferrer"
                            style={{ textDecoration: "none" }} title="WhatsApp them asking for new flats">
                            Ask for flats
                          </a>
                        ) : (
                          <span className="crm-mute" style={{ fontSize: 11 }}>no number</span>
                        )}
                        {b.phone && (
                          <Btn sm onClick={() => call(b)}>{copied === b.id ? "Copied" : "Call"}</Btn>
                        )}
                      </div>
                    </td>
                  </tr>,
                  open && (
                    <tr key={`${b.id}-flats`}>
                      <td colSpan={9} style={{ background: C.surface }}>
                        {s.propertyIds?.length ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {s.propertyIds
                              .map((pid) => listingById.get(pid))
                              .filter(Boolean)
                              .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
                              .map((f) => (
                                <div key={f.property_id} className="crm-num" style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "baseline" }}>
                                  <Link to={`/crm/properties/${f.property_id}/edit`} style={{ color: C.accent, fontWeight: 700 }}>
                                    {f.property_id}
                                  </Link>
                                  <span>{f.flat_type || "—"} · {f.area || "—"} · {inr(f.rent)}</span>
                                  <Chip on={f.status === "published"} style={{ pointerEvents: "none", fontSize: 10 }}>{f.status}</Chip>
                                  <span className="crm-mute">{shortDate(f.created_at)}</span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <span className="crm-mute" style={{ fontSize: 12 }}>
                            No flats credited yet. Pick them as the broker under &ldquo;Property via&rdquo; when uploading.
                          </span>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>

      <Toast {...(toast ?? {})} />
    </div>
  );
}
