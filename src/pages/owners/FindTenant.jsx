/**
 * Find a Tenant, for one vacant flat.
 *
 *   1. Listing: live on moveazy.co.in and the broker partner app, or not.
 *   2. Visit times: the same hourly slots the site books against
 *      (lib/visitSchedule.js), set as "every day / weekdays / weekends, from–to".
 *   3. Broker calls: Premium partner brokers call or WhatsApp the owner
 *      directly, or — switched off — MovEazy's visits desk takes them.
 *   4. Interested renters: booked, asked, liked, or sent by the MovEazy team —
 *      first name and initial with what they want. MovEazy coordinates, so no
 *      contact details reach the owner (owner_property_candidates()).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, Check, Circle, Clock, ExternalLink, Info, Phone, Share2, Users } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Chip, Confirm, Empty, Loading, Pill, TopBar, WhatsAppIcon, toast } from "./ownerUi";
import {
  CANDIDATE_LABEL, bhkLabel, fetchCandidates, fmtDateTime, friendlyError, inrShort, occupancyOf, op, ownerListingLink,
  propertyName, teamWa, updateProperty, waLink,
} from "../../lib/owners";
import { fetchSlotsForProperty, deleteVisitSlot } from "../../lib/visits";
import { VISITS_DESK, fetchBrokerContact, setBrokerContact } from "../../lib/partnerContact";
import { DEFAULT_VISIT_RULE, VISIT_MODES, applyVisitRule, readVisitRule, rememberVisitRule } from "../../lib/visitSchedule";

const HOURS = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`);
const hourLabel = (h) => new Date(`2000-01-01T${h}`).toLocaleTimeString("en-IN", { hour: "numeric", hour12: true });
const BADGE_TONE = { visit_booked: "green", visited: "blue", visit_requested: "amber", shortlisted: "champ", liked: "grey" };

/**
 * Whether MovEazy's partner brokers may call or WhatsApp the owner about this
 * flat. On, they reach the owner and see the visit times above; off, every
 * call and message goes to MovEazy's visits desk, which passes the flat and
 * the visit wanted on.
 */
function BrokerCalls({ propertyId }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchBrokerContact(propertyId).then(setOn, () => setOn(true)); }, [propertyId]);

  const flip = async () => {
    const next = !on;
    setBusy(true);
    try {
      await setBrokerContact(propertyId, next);
      setOn(next);
      toast(next ? "Brokers can call and WhatsApp you" : "Brokers' calls go to MovEazy now");
    } catch (e) {
      toast(friendlyError(e, "Could not change it."), "error");
    } finally {
      setBusy(false);
    }
  };
  const desk = VISITS_DESK.replace(/(\d{5})(\d{5})/, "$1 $2");

  return (
    <div className="oz-section">
      <div className="oz-between" style={{ alignItems: "flex-start", gap: 12 }}>
        <span style={{ flex: 1 }}>
          <h2 className="oz-h2" style={{ margin: 0 }}><span className="oz-row" style={{ gap: 6 }}><Phone size={17} /> Calls from brokers</span></h2>
          <p className="oz-meta" style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
            {on === null ? "Loading…" : on
              ? "MovEazy partner brokers can call or WhatsApp you directly to fix a visit, at the times above."
              : `Brokers' calls and messages go to MovEazy (${desk}) with the flat and the visit they want. We pass it on to you.`}
          </p>
        </span>
        <button type="button" role="switch" aria-checked={Boolean(on)} aria-label="Let brokers call or WhatsApp me"
          onClick={flip} disabled={busy || on === null}
          style={{
            flex: "none", width: 50, height: 30, borderRadius: 99, border: "none", padding: 3, cursor: "pointer",
            background: on ? "var(--em)" : "#CBD5E1", transition: "background .2s", marginTop: 2,
          }}>
          <span style={{
            display: "block", width: 24, height: 24, borderRadius: 99, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)",
            transform: on ? "translateX(20px)" : "none", transition: "transform .2s",
          }} />
        </button>
      </div>
    </div>
  );
}

function VisitTimes({ propertyId }) {
  const [rule, setRule] = useState(() => {
    const r = readVisitRule(propertyId);
    return r && r.mode !== "custom" ? r : { ...DEFAULT_VISIT_RULE, fromT: "10:00", toT: "19:00" };
  });
  const [slots, setSlots] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clear, setClear] = useState(false);

  const load = useCallback(() => fetchSlotsForProperty(propertyId).then(setSlots, () => setSlots([])), [propertyId]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of slots ?? []) {
      const d = new Date(s.slot_at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(s);
    }
    return [...m.entries()].slice(0, 7);
  }, [slots]);

  const save = async () => {
    if (rule.toT <= rule.fromT) return toast("The end time must be after the start time", "error");
    setSaving(true);
    try {
      const res = await applyVisitRule(propertyId, rule);
      rememberVisitRule(propertyId, rule);
      if (res.failed && !res.added) throw res.lastError || new Error("Could not save the visit times.");
      toast(res.added ? "Visit times saved for the next 7 days" : "Those times were already open");
      await load();
    } catch (e) {
      toast(friendlyError(e, "Could not save the visit times."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setSaving(true);
    try {
      for (const s of slots ?? []) await deleteVisitSlot(s.id);
      rememberVisitRule(propertyId, null);
      setClear(false);
      toast("Upcoming visit times cleared");
      await load();
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oz-section">
      <h2 className="oz-h2"><span className="oz-row" style={{ gap: 6 }}><Clock size={17} /> Visit times</span></h2>
      <p className="oz-meta" style={{ margin: "0 0 12px" }}>When renters can come and see it. MovEazy confirms every visit with you first.</p>
      <div className="oz-chips" style={{ marginBottom: 12 }}>
        {VISIT_MODES.map(([k, label]) => <Chip key={k} on={rule.mode === k} onClick={() => setRule((r) => ({ ...r, mode: k }))}>{label}</Chip>)}
      </div>
      <div className="oz-grid2">
        <div className="oz-field">
          <label className="oz-label" htmlFor="vt-from">From</label>
          <select id="vt-from" className="oz-select" value={rule.fromT} onChange={(e) => setRule((r) => ({ ...r, fromT: e.target.value }))}>
            {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </div>
        <div className="oz-field">
          <label className="oz-label" htmlFor="vt-to">Until</label>
          <select id="vt-to" className="oz-select" value={rule.toT} onChange={(e) => setRule((r) => ({ ...r, toT: e.target.value }))}>
            {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </div>
      </div>
      <button type="button" className="oz-btn oz-btn--primary" style={{ width: "100%" }} onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save visit times"}
      </button>

      <div style={{ marginTop: 14 }}>
        {slots === null ? <span className="oz-meta">Loading times…</span> : byDay.length === 0 ? (
          <span className="oz-meta">No visit times open yet.</span>
        ) : (
          <>
            {byDay.map(([day, list]) => (
              <div key={day} className="oz-between" style={{ padding: "7px 0", borderTop: "1px solid var(--line2)" }}>
                <strong style={{ fontWeight: 600, fontSize: 14 }}>{day}</strong>
                <span className="oz-meta">
                  {new Date(list[0].slot_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                  {" – "}
                  {new Date(list[list.length - 1].slot_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                  {" · "}{list.length} slot{list.length > 1 ? "s" : ""}
                </span>
              </div>
            ))}
            <button type="button" className="oz-btn oz-btn--ghost" style={{ color: "var(--red)", marginTop: 4 }} onClick={() => setClear(true)}>
              Clear upcoming times
            </button>
          </>
        )}
      </div>
      {clear && (
        <Confirm title="Clear upcoming visit times?" busy={saving} danger confirmLabel="Clear times" onClose={() => setClear(false)}
          body="Renters won't be able to pick a time until you set new ones. Visits already booked stay booked." onConfirm={clearAll} />
      )}
    </div>
  );
}

export default function FindTenant() {
  const { id } = useParams();
  const { byId, properties, tenants, reloadProperties } = useOwner();
  const p = byId.get(id);
  const [candidates, setCandidates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    fetchCandidates(id).then(setCandidates, () => setCandidates([]));
  }, [id]);

  if (!properties) return <><TopBar title="Find a Tenant" back /><Loading /></>;
  if (!p) return <><TopBar title="Find a Tenant" back={op("/properties")} /><Empty>That property isn't in your account.</Empty></>;

  const occ = occupancyOf(p, tenants);
  const listed = p.status === "published";
  const photos = (p.images ?? []).length;
  const checklist = [
    { ok: photos >= 3, label: photos ? `${photos} photo${photos > 1 ? "s" : ""} — 3 or more get far more visits` : "Add at least 3 photos" },
    { ok: Number(p.rent) >= 1000, label: "Monthly rent" },
    { ok: Boolean(p.available_from), label: "Available-from date" },
    { ok: Boolean((p.description || "").trim()), label: "A short description" },
  ];

  const setListed = async (on) => {
    setBusy(true);
    try {
      await updateProperty(id, { status: on ? "published" : "paused" });
      await reloadProperties();
      toast(on ? "Live on MovEazy — we'll share interested renters here" : "Taken off MovEazy");
      setConfirm(false);
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const shareText = `${bhkLabel(p)} for rent in ${p.area} — ${inrShort(p.rent)}/month.\n${ownerListingLink(id)}`;

  return (
    <>
      <TopBar title="Find a Tenant" back={op(`/properties/${id}`)} />
      <div className="oz-pad">
        <p className="oz-meta" style={{ margin: "0 0 10px" }}>{propertyName(p)}</p>

        <div className="oz-section" style={listed ? { borderColor: "#BFE3D0", background: "linear-gradient(180deg,#F1F8F4,#fff)" } : undefined}>
          {listed ? (
            <>
              <div className="oz-between">
                <h2 className="oz-h2" style={{ margin: 0 }}><span className="oz-row" style={{ gap: 6 }}><Check size={18} color="var(--em)" /> Live on MovEazy</span></h2>
                <Pill tone="green">Listed</Pill>
              </div>
              <p className="oz-meta" style={{ margin: "8px 0 12px", lineHeight: 1.55 }}>
                Renters on moveazy.co.in and MovEazy's broker network can see it. Enquiries come to MovEazy, and we coordinate every visit with you.
              </p>
              <div className="oz-grid2">
                <a className="oz-btn" href={waLink("", shareText)} target="_blank" rel="noreferrer"><Share2 size={16} /> Share</a>
                <a className="oz-btn" href={ownerListingLink(id, "open")} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View page</a>
              </div>
              <button type="button" className="oz-btn oz-btn--ghost" style={{ marginTop: 6 }} onClick={() => setConfirm(true)}>Take it off MovEazy</button>
            </>
          ) : (
            <>
              <h2 className="oz-h2">{occ === "occupied" ? "This flat is marked occupied" : "Not listed yet"}</h2>
              <p className="oz-meta" style={{ margin: "0 0 12px", lineHeight: 1.55 }}>
                List it and it goes live on moveazy.co.in and to MovEazy's broker network. You don't take calls — MovEazy screens renters and books visits in your times.
              </p>
              <div style={{ marginBottom: 12 }}>
                {checklist.map((c) => (
                  <div key={c.label} className="oz-row" style={{ gap: 8, padding: "4px 0", fontSize: 14 }}>
                    {c.ok ? <Check size={16} color="var(--em)" /> : <Circle size={16} color="#C9C3B3" />}
                    <span style={{ color: c.ok ? "var(--ink)" : "var(--dim)" }}>{c.label}</span>
                  </div>
                ))}
                {checklist.some((c) => !c.ok) && <Link to={op(`/properties/${id}/edit`)} className="oz-btn oz-btn--ghost" style={{ paddingLeft: 0 }}>Complete the listing</Link>}
              </div>
              <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={() => setListed(true)} disabled={busy}>
                {busy ? "Listing…" : occ === "occupied" ? "Mark vacant & list it" : "List on MovEazy"}
              </button>
            </>
          )}
        </div>

        <VisitTimes propertyId={id} />
        <BrokerCalls propertyId={id} />

        <div className="oz-section">
          <h2 className="oz-h2"><span className="oz-row" style={{ gap: 6 }}><Users size={17} /> Interested renters</span>
            {candidates && <span className="oz-hint">{candidates.length}</span>}
          </h2>
          {candidates === null ? <span className="oz-meta">Loading…</span> : candidates.length === 0 ? (
            <p className="oz-meta" style={{ margin: 0, lineHeight: 1.55 }}>
              {listed ? "No one yet. Renters who like it, ask to visit or book a time will appear here." : "Once it's listed, renters who like it or book a visit appear here."}
            </p>
          ) : candidates.map((c) => {
            const want = [
              (c.occupants ?? []).slice(0, 2).join(", "),
              c.budget_max ? `up to ${inrShort(c.budget_max)}` : "",
              (c.flat_types ?? []).slice(0, 2).join("/"),
            ].filter(Boolean).join(" · ");
            return (
              <div key={c.key} className="oz-row" style={{ padding: "10px 0", borderTop: "1px solid var(--line2)", alignItems: "flex-start" }}>
                <Avatar name={c.display_name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="oz-between" style={{ alignItems: "flex-start" }}>
                    <strong>{c.display_name}</strong>
                    <Pill tone={BADGE_TONE[c.best]}>{CANDIDATE_LABEL[c.best]}</Pill>
                  </div>
                  {c.next_visit && (
                    <div className="oz-row" style={{ gap: 5, fontSize: 13.5, color: "var(--em)", fontWeight: 600, marginTop: 3 }}>
                      <CalendarClock size={14} /> {fmtDateTime(c.next_visit)}
                    </div>
                  )}
                  {want && <div className="oz-meta" style={{ marginTop: 2 }}>{want}</div>}
                  <a className="oz-btn oz-btn--ghost" style={{ paddingLeft: 0, marginTop: 2 }} target="_blank" rel="noreferrer"
                    href={teamWa(`Hi MovEazy, about ${c.display_name} for my ${propertyName(p)} (${id}) — `)}>
                    <WhatsAppIcon size={15} /> Ask MovEazy about {c.display_name.split(" ")[0]}
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <p className="oz-hint oz-row" style={{ gap: 6, alignItems: "flex-start" }}>
          <Info size={14} style={{ flex: "none", marginTop: 2 }} />
          Renters' numbers stay with MovEazy — we screen them and confirm visits, so you're never cold-called.
        </p>
      </div>
      {confirm && (
        <Confirm title="Take it off MovEazy?" busy={busy} confirmLabel="Take it off" onClose={() => setConfirm(false)}
          body="Renters and brokers stop seeing it. Visits already booked are not cancelled." onConfirm={() => setListed(false)} />
      )}
    </>
  );
}
