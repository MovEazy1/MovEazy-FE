/**
 * Things waiting on the team, on a screen of their own.
 *
 * "Slot required" is the first of them: tenants who asked to see a flat that
 * has no visit times on it. That queue used to be a four-line amber strip on
 * the Clients tab, showing notification text and a "Done" button — which
 * cleared the alert without arranging anything. It never said which flat, never
 * showed the flat, and gave nobody a way to answer the person waiting.
 *
 * Grouped by property, because that is the shape of the work: a flat needs
 * times put on it once, however many people are waiting, and four faces against
 * one address is the argument for doing it now.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCrm } from "./CrmShell";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, inr, shortDate } from "./crmUi";
import { setInventoryStatus } from "../../lib/inventory";
import { propertyLink, whatsappUrl } from "../../lib/crmSettings";
import {
  askPreferredTimeMessage, fetchPendingSlotRequests, fetchSlotsFor, formatSlot,
  groupRequestsByProperty, resolveSlotRequest, slotsAvailableMessage,
} from "../../lib/crmSlotRequests";
import { fetchProfilesFor } from "../../lib/crmVisits";
import CrmDailyTasks from "./CrmDailyTasks";
import CrmPropertyFollowUp from "./CrmPropertyFollowUp";

/** A tenant with no number can't be messaged, only called back by email. */
function WaitingRow({ person, group, nameFor, onMessaged }) {
  const name = nameFor(person);
  const hasSlots = group.slots.length > 0;

  const message = hasSlots
    ? slotsAvailableMessage({
        name, title: group.title, propertyId: group.propertyId,
        slots: group.slots, link: propertyLink(group.propertyId),
      })
    : askPreferredTimeMessage({ name, title: group.title, propertyId: group.propertyId });

  const href = whatsappUrl(person.phone, message);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
      borderTop: `1px solid ${C.lineSoft}`,
    }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.text }}>
          {name}
          {person.asks > 1 && (
            <span className="crm-mute" style={{ fontWeight: 600 }}> · asked {person.asks}×</span>
          )}
        </span>
        <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
          {person.phone || person.email || "no contact"}
          {person.preferred ? ` · wants ${person.preferred}` : ""}
          {` · ${shortDate(person.askedAt)}`}
        </span>
        {person.notes && (
          <span className="crm-mute" style={{ display: "block", fontSize: 11, fontStyle: "italic" }}>
            “{person.notes}”
          </span>
        )}
      </span>

      {href ? (
        <a
          className={`crm-btn crm-btn--sm ${hasSlots ? "crm-btn--wa" : ""}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
          onClick={() => onMessaged(person)}
          // The label is the whole difference between the two states: before
          // times exist we are asking them a question, after they exist we are
          // answering one.
          title={hasSlots ? "Tell them times are open" : "Ask which time suits them"}
        >
          {hasSlots ? "Notify" : "Ask time"}
        </a>
      ) : (
        <span className="crm-mute" style={{ fontSize: 11 }}>no number</span>
      )}
    </div>
  );
}

function PropertyCard({ group, nameFor, canWrite, onChanged }) {
  const [busy, setBusy] = useState(false);
  const listing = group.listing;
  const cover = listing?.cover_image_url || (listing?.images ?? [])[0] || "";
  const hasSlots = group.slots.length > 0;

  const markSoldOut = async () => {
    if (busy) return;
    // Irreversible from this screen's point of view, and it takes the flat off
    // the site for everyone — worth one deliberate confirmation.
    const ok = window.confirm(
      `Mark ${group.propertyId} as rented?\n\nIt comes off the site, and the ${group.waiting.length} ` +
      `${group.waiting.length === 1 ? "person" : "people"} waiting will stop being shown here.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await setInventoryStatus(group.propertyId, "rented");
      // The asks are closed too: the flat is gone, so nobody is still waiting
      // on a time for it.
      // "cancelled", not "closed": the fetch excludes cancelled and done, and
      // a status outside that pair would leave every row right where it was.
      await Promise.all(group.waiting.map((w) => resolveSlotRequest(w.id, "cancelled")));
      onChanged();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div style={{
      border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden",
      background: C.bg, display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", gap: 11, padding: 11 }}>
        {cover ? (
          <img
            src={cover}
            alt=""
            style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 9, flex: "none", background: C.surfaceAlt }}
          />
        ) : (
          <div style={{
            width: 84, height: 64, borderRadius: 9, flex: "none", background: C.surfaceAlt,
            display: "flex", alignItems: "center", justifyContent: "center",
          }} className="crm-mute">
            <span style={{ fontSize: 10.5 }}>no photo</span>
          </div>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{group.title}</div>
          <div className="crm-mute crm-num" style={{ fontSize: 11, marginTop: 2 }}>
            <span style={{ color: C.accent }}>{group.propertyId}</span>
            {listing?.area ? ` · ${listing.area}` : ""}
            {listing?.rent ? ` · ${inr(listing.rent)}` : ""}
          </div>
          <div style={{ marginTop: 5 }}>
            {hasSlots ? (
              <span className="crm-chip crm-chip--on" style={{ pointerEvents: "none" }}>
                {group.slots.length} time{group.slots.length === 1 ? "" : "s"} open · next {formatSlot(group.slots[0].slot_at)}
              </span>
            ) : (
              <span className="crm-chip" style={{ pointerEvents: "none", borderColor: C.gold, color: C.gold }}>
                No times yet
              </span>
            )}
          </div>
        </div>
      </div>

      {canWrite && (
        <div style={{ display: "flex", gap: 6, padding: "0 11px 10px", flexWrap: "wrap" }}>
          {/* Reuses the property form's own visit-time editor rather than a
              second one here: one place that knows how a slot is created. */}
          <Link
            to={`/crm/properties/${group.propertyId}/edit#slots`}
            className="crm-btn crm-btn--sm crm-btn--primary"
            style={{ textDecoration: "none" }}
          >
            {hasSlots ? "Add another slot" : "Add slot"}
          </Link>
          <Btn sm variant="danger" disabled={busy} onClick={markSoldOut}>
            {busy ? "Saving…" : "Mark sold out"}
          </Btn>
        </div>
      )}

      <div style={{ padding: "0 11px 10px" }}>
        <span className="crm-label" style={{ fontSize: 10.5 }}>
          Waiting · {group.waiting.length}
        </span>
        {group.waiting.map((p) => (
          <WaitingRow key={p.key} person={p} group={group} nameFor={nameFor} onMessaged={() => {}} />
        ))}
      </div>
    </div>
  );
}

/** The two queues this tab holds, in the order they get worked. */
const SECTIONS = [
  { id: "tasks", label: "Daily tasks" },
  { id: "slots", label: "Flat slots required" },
  { id: "props", label: "Prop follow-up" },
];

export default function CrmNotificationsPage() {
  const { inventory, clients, access } = useCrm();
  const canWrite = access.has(SCOPES.PROPERTIES_WRITE);

  // Daily tasks first: it is the one with somebody waiting on a reply, and a
  // queue nobody opens is a queue nobody clears.
  const [section, setSection] = useState("tasks");

  const [requests, setRequests] = useState([]);
  const [slots, setSlots] = useState(new Map());
  const [profiles, setProfiles] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchPendingSlotRequests();
    setRequests(rows);
    // A booking carries a user_id and nothing else about the person, so the
    // name and number an agent needs come from the profile.
    const [slotRows, profileRows] = await Promise.all([
      fetchSlotsFor(rows.map((r) => r.property_id)),
      fetchProfilesFor(rows.map((r) => r.user_id)),
    ]);
    setSlots(slotRows);
    setProfiles(new Map((profileRows ?? []).map((p) => [p.id, p])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const listingsById = useMemo(
    () => new Map(inventory.map((l) => [l.property_id, l])),
    [inventory],
  );

  const groups = useMemo(
    () => groupRequestsByProperty(requests, listingsById, slots, profiles),
    [requests, listingsById, slots, profiles],
  );

  /**
   * The best name we have for whoever is waiting. The request itself carries
   * only an email, so a CRM client on the same number or address gives us a
   * real name to open a message with.
   */
  const nameFor = useMemo(() => {
    const byPhone = new Map();
    const byEmail = new Map();
    for (const c of clients) {
      if (c.phone) byPhone.set(String(c.phone).replace(/\D/g, "").slice(-10), c.name);
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c.name);
    }
    return (person) => {
      // Their profile name first — it is the one they gave us themselves.
      if (person.name) return person.name;
      const viaPhone = person.phone ? byPhone.get(String(person.phone).replace(/\D/g, "").slice(-10)) : "";
      const viaEmail = person.email ? byEmail.get(person.email.toLowerCase()) : "";
      return viaPhone || viaEmail || (person.email ? person.email.split("@")[0] : "Tenant");
    };
  }, [clients]);

  const waitingCount = groups.reduce((n, g) => n + g.waiting.length, 0);

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div className="crm-col" style={{ flex: 1 }}>
        <div
          className="crm-colhead"
          style={{ gap: 6, justifyContent: "flex-start" }}
        >
          {SECTIONS.map((s) => (
            <Chip key={s.id} on={section === s.id} onClick={() => setSection(s.id)}>
              {s.label}
              {s.id === "slots" && groups.length > 0 ? ` · ${groups.length}` : ""}
            </Chip>
          ))}
        </div>

        {section === "tasks" ? (
          <CrmDailyTasks />
        ) : section === "props" ? (
          <CrmPropertyFollowUp />
        ) : (
        <>
        <div className="crm-colhead">
          <span className="crm-label">
            Slot required · {groups.length} {groups.length === 1 ? "flat" : "flats"}
            {waitingCount ? ` · ${waitingCount} waiting` : ""}
          </span>
          <Btn sm onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Btn>
        </div>

        <div className="crm-scroll" style={{ flex: 1, padding: 12 }}>
          {loading && groups.length === 0 ? (
            <Empty>Loading…</Empty>
          ) : groups.length === 0 ? (
            <Empty>Nobody is waiting on a visit time.</Empty>
          ) : (
            <div style={{
              display: "grid", gap: 11,
              gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
            }}>
              {groups.map((g) => (
                <PropertyCard
                  key={g.propertyId}
                  group={g}
                  nameFor={nameFor}
                  canWrite={canWrite}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
