/**
 * Booked visits — the CRM's day, three ways.
 *
 * By date is the agenda: who is standing outside which flat, and when.
 * By client answers "what have I promised this person", and is where the
 * reminder and confirmation go out from, because a message is addressed to a
 * person, not to a date.
 * By property is the batching view: four visits to one flat is one trip.
 *
 * Sending is a WhatsApp hand-off, as everywhere else in this CRM — the message
 * is composed here and opened in WhatsApp. Clicking marks it sent, which is a
 * record that the agent was handed the message, not proof it was delivered;
 * the UI says "marked", never "delivered".
 *
 * Needs MovEazy-BE/supabase/crm_visits_access.sql. Without it visit_bookings
 * has no staff read policy and this page is simply empty.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import {
  clearConfirmationSent, clearReminderSent, dayKey, dueState, fetchProfilesFor,
  fetchVisitBookings, groupBy, markConfirmationSent, markReminderSent, summariseVisits,
} from "../../lib/crmVisits";
import { buildTemplateVars, renderTemplate, whatsappUrl } from "../../lib/crmSettings";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, Loading, Toast, inr } from "./crmUi";

const VIEWS = [
  { id: "date", label: "By date" },
  { id: "client", label: "By client" },
  { id: "property", label: "By property" },
];

const FILTERS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "due", label: "Needs a message" },
  { id: "unscheduled", label: "Needs a time" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

/** Where the visit time lives on a joined row, for the grouper's sort. */
const rowTime = (r) => r?.booking?.slot_at;

const timeOf = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }) : "";

const dayLabel = (key) => {
  if (!key) return "No time set yet";
  const d = new Date(`${key}T00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  const stamp = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
  if (diff === 0) return `Today · ${stamp}`;
  if (diff === 1) return `Tomorrow · ${stamp}`;
  if (diff === -1) return `Yesterday · ${stamp}`;
  return stamp;
};

function DueTag({ state, booking }) {
  const map = {
    unscheduled: ["Needs a time", C.coral],
    confirm: [booking?.confirmation_sent_at ? "Confirmed" : "Confirm now", C.gold],
    reminder: [booking?.reminder_sent_at ? "Reminded" : "Remind now", C.gold],
    past: ["Done", C.textMute],
    none: ["Scheduled", C.textMute],
  };
  const [label, color] = map[state] ?? map.none;
  const sent =
    (state === "confirm" && booking?.confirmation_sent_at) ||
    (state === "reminder" && booking?.reminder_sent_at);
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: sent ? C.accent : color }}>{label}</span>
  );
}

export default function CrmVisitsPage() {
  const crm = useCrm();
  const { clients, inventory, requirements, access, user, settings } = crm;
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [strangers, setStrangers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("date");
  const [filter, setFilter] = useState("upcoming");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const canSend = access.has(SCOPES.VISITS_WRITE);
  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2800);
  };

  // "Remind now" has to stop being true at some point without a page reload.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchVisitBookings();
    setBookings(rows);
    // Anyone who booked before crm_visit_sync.sql was running has no client
    // row; without their name and number this screen can't do its job.
    const known = new Set((clients ?? []).map((c) => c.user_id).filter(Boolean));
    const missing = rows.map((r) => r.user_id).filter((id) => id && !known.has(id));
    setStrangers(missing.length ? await fetchProfilesFor(missing) : []);
    setLoading(false);
  }, [clients]);

  useEffect(() => { load(); }, [load]);

  /* ── Joining the three tables this screen actually needs ────────────────── */

  const clientByUser = useMemo(() => {
    const m = new Map();
    for (const c of clients ?? []) if (c.user_id) m.set(c.user_id, c);
    return m;
  }, [clients]);

  const profileByUser = useMemo(
    () => new Map(strangers.map((p) => [p.id, p])),
    [strangers],
  );

  const listingById = useMemo(
    () => new Map((inventory ?? []).map((l) => [l.property_id, l])),
    [inventory],
  );

  const reqByClient = useMemo(
    () => new Map((requirements ?? []).map((r) => [r.client_id, r])),
    [requirements],
  );

  /** Everything one row needs to render and to message, resolved once. */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookings
      .map((b) => {
        const client = clientByUser.get(b.user_id) || null;
        const profile = profileByUser.get(b.user_id) || null;
        const listing = listingById.get(b.property_id) || null;
        return {
          booking: b,
          client,
          listing,
          name: client?.name || profile?.name || profile?.email || "Unknown visitor",
          phone: client?.phone || profile?.phone || "",
          state: dueState(b, now),
        };
      })
      .filter((r) => {
        if (filter === "upcoming" && !["none", "reminder", "confirm"].includes(r.state)) return false;
        if (filter === "past" && r.state !== "past") return false;
        if (filter === "unscheduled" && r.state !== "unscheduled") return false;
        if (filter === "due") {
          const dueReminder = r.state === "reminder" && !r.booking.reminder_sent_at;
          const dueConfirm = r.state === "confirm" && !r.booking.confirmation_sent_at;
          if (!dueReminder && !dueConfirm && r.state !== "unscheduled") return false;
        }
        if (!needle) return true;
        return [r.name, r.phone, r.booking.property_id, r.listing?.area, r.listing?.title]
          .join(" ").toLowerCase().includes(needle);
      });
  }, [bookings, clientByUser, profileByUser, listingById, filter, q, now]);

  const summary = useMemo(() => summariseVisits(bookings, now), [bookings, now]);

  /* ── Sending ───────────────────────────────────────────────────────────── */

  const template = (id) => (settings?.templates ?? []).find((t) => t.id === id);

  const send = async (row, kind) => {
    const { booking, client, listing, phone } = row;
    if (!phone) return showToast("No phone number on this client", "error");
    const tpl = template(kind === "reminder" ? "visit_reminder" : "visit_confirmation");
    if (!tpl) return showToast("That template is missing — add it in Settings", "error");

    const vars = buildTemplateVars({
      client: client ?? { name: row.name },
      requirement: client ? reqByClient.get(client.id) : null,
      agentName: (user?.email || "").split("@")[0],
      property: listing,
      visitTime: booking.slot_at
        ? `${dayLabel(dayKey(booking.slot_at)).split(" · ")[0]}, ${timeOf(booking.slot_at)}`
        : "a time we'll confirm",
    });
    const url = whatsappUrl(phone, renderTemplate(tpl.body, vars));
    if (!url) return showToast("That phone number isn't usable", "error");

    // Open first: a popup blocker fires on anything after an await.
    window.open(url, "_blank", "noopener,noreferrer");
    if (!canSend) return;

    setBusy(booking.id);
    try {
      const updated = kind === "reminder"
        ? await markReminderSent(booking.id, user?.email || "")
        : await markConfirmationSent(booking.id, user?.email || "");
      setBookings((cur) => cur.map((b) => (b.id === updated.id ? updated : b)));
      showToast(kind === "reminder" ? "Reminder marked sent" : "Confirmation marked sent");
    } catch (e) {
      showToast(e?.message || "WhatsApp opened, but marking it failed", "error");
    } finally {
      setBusy("");
    }
  };

  const unsend = async (row, kind) => {
    setBusy(row.booking.id);
    try {
      const updated = kind === "reminder"
        ? await clearReminderSent(row.booking.id)
        : await clearConfirmationSent(row.booking.id);
      setBookings((cur) => cur.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e) {
      showToast(e?.message || "Could not undo that", "error");
    } finally {
      setBusy("");
    }
  };

  /* ── Grouping ──────────────────────────────────────────────────────────── */

  const groups = useMemo(() => {
    if (view === "date") {
      return groupBy(rows, (r) => dayKey(r.booking.slot_at), rowTime)
        .sort((a, b) => (a.key === "" ? -1 : b.key === "" ? 1 : a.key.localeCompare(b.key)))
        .map((g) => ({ ...g, title: dayLabel(g.key), sub: `${g.items.length} visit${g.items.length === 1 ? "" : "s"}` }));
    }
    if (view === "client") {
      return groupBy(rows, (r) => r.booking.user_id || r.name, rowTime)
        .map((g) => ({
          ...g,
          title: g.items[0].name,
          sub: [g.items[0].phone, `${g.items.length} visit${g.items.length === 1 ? "" : "s"}`]
            .filter(Boolean).join(" · "),
          client: g.items[0].client,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
    }
    return groupBy(rows, (r) => r.booking.property_id, rowTime)
      .map((g) => {
        const l = g.items[0].listing;
        return {
          ...g,
          title: l ? `${l.flat_type || "Home"} · ${l.area || ""}`.trim() : g.key || "Unknown property",
          sub: [g.key, l ? inr(l.rent) : "", `${g.items.length} visit${g.items.length === 1 ? "" : "s"}`]
            .filter(Boolean).join(" · "),
        };
      })
      .sort((a, b) => b.items.length - a.items.length);
  }, [rows, view]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  const Line = ({ r, showClient, showProperty, showTime }) => {
    const b = r.booking;
    const working = busy === b.id;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "9px 0", borderTop: `1px solid ${C.lineSoft}`,
      }}>
        {showTime && (
          <span className="crm-num" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 74 }}>
            {b.slot_at ? timeOf(b.slot_at) : "—"}
          </span>
        )}
        {showClient && (
          <button type="button" style={{ fontSize: 12.5, fontWeight: 600, color: C.text, textAlign: "left" }}
            onClick={() => r.client && navigate(`/crm/clients?client=${r.client.id}`)}>
            {r.name}
          </button>
        )}
        {showProperty && (
          <span className="crm-num" style={{ fontSize: 11.5, color: C.accent }}>
            {b.property_id}
            {r.listing?.area ? <span className="crm-mute"> · {r.listing.area}</span> : null}
          </span>
        )}
        {!showTime && b.slot_at && (
          <span className="crm-mute crm-num" style={{ fontSize: 11.5 }}>
            {dayLabel(dayKey(b.slot_at)).split(" · ")[0]}, {timeOf(b.slot_at)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <DueTag state={r.state} booking={b} />

        {view === "client" && r.state !== "past" && (
          <span style={{ display: "flex", gap: 5 }}>
            {b.reminder_sent_at ? (
              <Btn sm disabled={working} onClick={() => unsend(r, "reminder")}
                title={`Marked by ${b.reminder_sent_by || "someone"}`}>
                Reminder ✓
              </Btn>
            ) : (
              <Btn sm disabled={working || !r.phone}
                variant={r.state === "reminder" ? "primary" : undefined}
                onClick={() => send(r, "reminder")}>
                Reminder
              </Btn>
            )}
            {b.confirmation_sent_at ? (
              <Btn sm disabled={working} onClick={() => unsend(r, "confirmation")}
                title={`Marked by ${b.confirmation_sent_by || "someone"}`}>
                Confirm ✓
              </Btn>
            ) : (
              <Btn sm disabled={working || !r.phone}
                variant={r.state === "confirm" ? "primary" : undefined}
                onClick={() => send(r, "confirmation")}>
                Confirm
              </Btn>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">Visits · {summary.upcoming} upcoming</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {summary.remindersDue > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>
              {summary.remindersDue} to remind
            </span>
          )}
          {summary.confirmsDue > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>
              {summary.confirmsDue} to confirm
            </span>
          )}
          {summary.unscheduled > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.coral }}>
              {summary.unscheduled} without a time
            </span>
          )}
          <Btn sm onClick={load}>Refresh</Btn>
        </div>
      </div>

      <div style={{ padding: "9px 12px", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
        {VIEWS.map((v) => (
          <Chip key={v.id} on={view === v.id} onClick={() => setView(v.id)}>{v.label}</Chip>
        ))}
        <span style={{ width: 10 }} />
        {FILTERS.map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
        ))}
        <input className="crm-input" style={{ maxWidth: 240 }} placeholder="Search name, phone, id, area…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="crm-scroll" style={{ flex: 1 }}>
        {loading ? (
          <Loading label="Loading visits…" />
        ) : groups.length === 0 ? (
          <Empty>
            {bookings.length === 0
              ? "No visits here yet. If you're expecting some, check that crm_visits_access.sql has been run — without it this screen can't read bookings."
              : "Nothing matches that filter."}
          </Empty>
        ) : (
          <div style={{ padding: "4px 14px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1000 }}>
            {view === "client" && !canSend && (
              <p className="crm-mute" style={{ fontSize: 11.5, margin: 0 }}>
                You can open WhatsApp from here, but marking a message sent needs crm.visits.write.
              </p>
            )}
            {groups.map((g) => (
              <div key={g.key || "none"} className="crm-card">
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{g.title}</span>
                  <span className="crm-mute crm-num" style={{ fontSize: 11.5 }}>{g.sub}</span>
                </div>
                {view === "client" && g.client && (
                  <div style={{ marginTop: 4 }}>
                    <Btn sm onClick={() => navigate(`/crm/clients?client=${g.client.id}`)}>Open record</Btn>
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  {g.items.map((r) => (
                    <Line
                      key={r.booking.id}
                      r={r}
                      showTime={view === "date"}
                      showClient={view !== "client"}
                      showProperty={view !== "property"}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast {...(toast ?? {})} />
    </div>
  );
}
