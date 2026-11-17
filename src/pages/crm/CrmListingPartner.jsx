/**
 * CRM → Properties: which MovEazy partner a listing belongs to
 * (crm_listing_set_partner, partner_referral_mapping.sql).
 *
 * A flat a partner added in the partner app is theirs and shows read-only.
 * Any other flat gets a dropdown of approved partners (Premium first, marked):
 * picking one makes it that partner's listing — in their app, shared with all
 * brokers at the program's share — and tells them. A CRM-made mapping can be
 * changed or cleared. It stays theirs if their Premium ends.
 */
import { useEffect, useState } from "react";
import { C } from "./crmUi";
import { adminListPartners, describeSharing, friendlyError } from "../../lib/partners";
import { crmSetListingPartner } from "../../lib/partnerPlans";

let partnersOnce = null;
/** Approved partners, Premium first, fetched once per CRM session. */
export function usePartnerOptions(enabled) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    partnersOnce = partnersOnce || adminListPartners().then((rows) => rows
      .filter((p) => p.status === "approved")
      .map((p) => ({ id: p.user_id, name: p.name || p.phone || "Partner", premium: Boolean(p.premium_until || p.trial_until) }))
      .sort((a, b) => (b.premium - a.premium) || a.name.localeCompare(b.name)), (e) => { partnersOnce = null; throw e; });
    partnersOnce.then((r) => alive && setList(r), () => {});
    return () => { alive = false; };
  }, [enabled]);
  return list;
}

export default function ListingPartner({ propertyId, info, partners, canEdit, onChanged, onToast, small }) {
  const [busy, setBusy] = useState(false);
  const fs = small ? 10.5 : 11.5;
  // Added in the partner app: theirs, not ours to move.
  if (info && !info.mappedBy) {
    return (
      <div style={{ fontSize: fs, color: C.accent, marginTop: 2 }} title="Added in the partner app — it stays theirs">
        Partner app · {info.broker?.name || "Partner"} · {describeSharing(info)}
      </div>
    );
  }
  const current = info?.brokerId || "";
  if (!canEdit) {
    return info ? <div style={{ fontSize: fs, color: C.accent, marginTop: 2 }}>MovEazy partner · {info.broker?.name || "Partner"}</div> : null;
  }
  const known = partners.some((p) => p.id === current);
  const change = async (id) => {
    const next = partners.find((p) => p.id === id);
    const msg = next
      ? `Give ${propertyId} to ${next.name}${next.premium ? "" : " (not on Premium)"}? It becomes their listing in the partner app, shared with all brokers, and they're told.`
      : `Take ${propertyId} back from ${info?.broker?.name || "the partner"}? It goes back to being a MovEazy flat.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await crmSetListingPartner(propertyId, id || null);
      onToast?.(next ? `${propertyId} → ${next.name}` : `${propertyId} is a MovEazy flat again`);
      onChanged?.(propertyId);
    } catch (e) {
      onToast?.(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <select className="crm-input" value={current} disabled={busy} onChange={(e) => change(e.target.value)}
      style={{ marginTop: 4, width: "100%", maxWidth: 220, fontSize: fs, padding: "3px 6px", color: current ? C.accent : C.textMute }}
      aria-label={`MovEazy partner for ${propertyId}`} title="Map this listing to a MovEazy partner">
      <option value="">Map to a partner…</option>
      {current && !known && <option value={current}>{info?.broker?.name || "Partner"}</option>}
      {partners.map((p) => <option key={p.id} value={p.id}>{p.premium ? "★ " : ""}{p.name}</option>)}
    </select>
  );
}
