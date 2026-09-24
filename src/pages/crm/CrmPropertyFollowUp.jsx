/**
 * Is this flat still going?
 *
 * A listing goes up and stays up. Nobody ever asked the owner whether it had
 * been let, so the board fills with flats gone weeks ago — and the person who
 * finds out is a tenant who asked to see one, which costs far more than the
 * listing was worth.
 *
 * Published, over a week old, not confirmed in the last week. Ask the owner,
 * record what they said, and the row leaves until it is due again.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, C, Empty, inr } from "./crmUi";
import { whatsappUrl } from "../../lib/crmSettings";
import {
  FOLLOW_UP_OUTCOMES, STALE_AFTER_DAYS, ageInDays, availabilityMessage, checkedLabel,
  fetchDueForFollowUp, recordFollowUp,
} from "../../lib/crmPropertyFollowUp";

function FollowUpRow({ listing, onAnswer, busy }) {
  const cover = listing.cover_image_url || (listing.images ?? [])[0] || "";
  const age = ageInDays(listing.created_at);
  const href = whatsappUrl(
    listing.phone,
    availabilityMessage({
      posterName: listing.poster_name,
      propertyId: listing.property_id,
      title: listing.title,
      area: listing.area,
    }),
  );

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 12px", borderBottom: `1px solid ${C.lineSoft}`,
    }}>
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, flex: "none", background: C.surfaceAlt }}
        />
      ) : (
        <span
          className="crm-mute"
          style={{
            width: 54, height: 54, borderRadius: 8, flex: "none", background: C.surfaceAlt,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5,
          }}
        >
          no photo
        </span>
      )}

      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.text }}>
          {listing.title || listing.flat_type || listing.property_id}
        </span>
        <span className="crm-mute crm-num" style={{ display: "block", fontSize: 11, marginTop: 2 }}>
          <span style={{ color: C.accent }}>{listing.property_id}</span>
          {listing.area ? ` · ${listing.area}` : ""}
          {listing.rent ? ` · ${inr(listing.rent)}` : ""}
        </span>
        <span className="crm-mute crm-num" style={{ display: "block", fontSize: 11 }}>
          {listing.poster_name || "Owner"}
          {listing.phone ? ` · ${listing.phone}` : " · no number"}
        </span>
        {/* Both halves of why it is here: how long it has been up, and how
            long since anyone asked. */}
        <span style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
          <span className="crm-chip" style={{ pointerEvents: "none", fontSize: 10, borderColor: C.gold, color: C.gold }}>
            {age === null ? "age unknown" : `up ${age} days`}
          </span>
          <span className="crm-chip" style={{ pointerEvents: "none", fontSize: 10 }}>
            {checkedLabel(listing.availability_checked_at)}
          </span>
        </span>
      </span>

      <span style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {href ? (
          <a
            className="crm-btn crm-btn--sm crm-btn--wa"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            Ask
          </a>
        ) : (
          <span className="crm-mute" style={{ fontSize: 11 }}>no number</span>
        )}
        {FOLLOW_UP_OUTCOMES.map((o) => (
          <Btn
            key={o.id}
            sm
            disabled={busy}
            // Only the answer that keeps it live is the quiet one; taking a
            // flat off the site should not be the easiest button to hit.
            variant={o.id === "available" ? "primary" : o.id === "rented" ? undefined : "danger"}
            onClick={() => onAnswer(listing, o)}
            title={o.note}
          >
            {o.label}
          </Btn>
        ))}
      </span>
    </div>
  );
}

export default function CrmPropertyFollowUp() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchDueForFollowUp();
    if (!alive.current) return;
    setRows(data);
    setLastLoadedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    // Loaded on open and on request, like the rest of this tab. A weekly
    // question does not need a poll behind it.
    return () => { alive.current = false; };
  }, [load]);

  const onAnswer = async (listing, outcome) => {
    if (outcome.status) {
      const ok = window.confirm(
        `${outcome.label}: ${listing.property_id}\n\n` +
        "This takes the flat off the site for tenants. It stays in the CRM and can be published again.",
      );
      if (!ok) return;
    }
    setBusy(listing.property_id);
    await recordFollowUp(listing.property_id, outcome.id);
    // Straight out of the list rather than waiting on a refetch: the answer is
    // recorded, and an agent working down a queue should see it shorten.
    if (alive.current) setRows((list) => list.filter((r) => r.property_id !== listing.property_id));
    setBusy("");
  };

  const checkedLabelText = useMemo(
    () => (lastLoadedAt ? new Date(lastLoadedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : ""),
    [lastLoadedAt],
  );

  return (
    <>
      <div className="crm-colhead">
        <span className="crm-label">
          Needs a check · {rows.length}
          {checkedLabelText && (
            <span className="crm-mute" style={{ fontWeight: 600 }}> · loaded {checkedLabelText}</span>
          )}
        </span>
        <Btn sm onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Btn>
      </div>

      <div className="crm-scroll" style={{ flex: 1 }}>
        {loading && rows.length === 0 ? (
          <Empty>Loading…</Empty>
        ) : rows.length === 0 ? (
          <Empty>
            Every listing over {STALE_AFTER_DAYS} days old has been checked this week.
          </Empty>
        ) : (
          rows.map((l) => (
            <FollowUpRow
              key={l.property_id}
              listing={l}
              busy={busy === l.property_id}
              onAnswer={onAnswer}
            />
          ))
        )}
      </div>
    </>
  );
}
