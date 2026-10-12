/**
 * On a flat's page (PropertyDetail): for the partner's own flats, how complete
 * its details are and who it went to, opened it, liked it; for any flat, the
 * tenants it suits best — their own and MovEazy's — each one tap from getting
 * it as a tracked list (likes and opens come back to the partner).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Heart, Send, Users } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { toast } from "./partnerUi";
import { MzBadge, ShareListSheet } from "./AiMatcher";
import { useMatcherData } from "./matcherData";
import { useTenants } from "./tenantData";
import { friendlyError, pp } from "../../lib/partners";
import { leadsForListing } from "../../lib/partnerMatch";
import { keyToSlug, matcherTenants, sendCuratedTo } from "../../lib/partnerMatcher";
import { fetchFlatInterest, flatDetailScore } from "../../lib/partnerTenants";

const ACTION = { liked: ["♥ Liked", "#E11D48"], skipped: ["Skipped", "var(--dim)"], opened: ["Opened", "#4F46E5"], sent: ["Sent", "var(--dim)"] };

export default function FlatCare({ listing: l, mine, onAddDetails }) {
  const { me, leads } = usePartner();
  const md = useMatcherData();
  const { reload } = useTenants();
  const [interest, setInterest] = useState(null);
  const [busy, setBusy] = useState("");
  const [share, setShare] = useState(null);
  const sc = flatDetailScore(l);

  const loadInterest = () => fetchFlatInterest(l.property_id).then(setInterest, () => setInterest(null));
  useEffect(() => { if (mine) loadInterest(); }, [l.property_id, mine]); // eslint-disable-line react-hooks/exhaustive-deps

  const tenants = useMemo(() => matcherTenants(leads, md.assigned), [leads, md.assigned]);
  // The tenants it suits, minus anyone who's already been sent or seen it.
  const fits = useMemo(() => leadsForListing(l, tenants)
    .filter((m) => !(md.seen[m.lead.key] ?? []).includes(l.property_id))
    .slice(0, 6), [l, tenants, md.seen]);

  const send = async (t) => {
    setBusy(t.key);
    try {
      const list = await sendCuratedTo(t, [l.property_id]);
      setShare({ lead: t, list });
      md.reload(); reload(); if (mine) loadInterest();
    } catch (e) {
      toast(friendlyError(e, "Could not send it."), "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      {mine && (
        <div className="pz-section">
          <h2><span className="pz-row" style={{ gap: 6 }}><ClipboardList size={17} /> Details</span><span className="pz-meta">{sc.done}/{sc.total}</span></h2>
          <div className="fc-bar"><i style={{ width: `${(sc.done / sc.total) * 100}%` }} /></div>
          {sc.missing.length ? (
            <>
              <p className="pz-hint" style={{ margin: "6px 0 8px" }}>
                Add {sc.missing.slice(0, 3).join(", ").toLowerCase()}{sc.missing.length > 3 ? ` and ${sc.missing.length - 3} more` : ""} — the more details, the better the AI matches it to the right tenant.
              </p>
              <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={onAddDetails}>Add details</button>
            </>
          ) : <p className="pz-hint" style={{ margin: "6px 0 0" }}>Every detail is in — it matches as well as it can.</p>}
        </div>
      )}

      {mine && interest && (
        <div className="pz-section">
          <h2><span className="pz-row" style={{ gap: 6 }}><Heart size={17} /> Interest</span></h2>
          <div className="fc-stats">
            <div><b>{interest.sent}</b><span>sent to</span></div>
            <div><b>{interest.opened}</b><span>opened</span></div>
            <div><b style={{ color: "#E11D48" }}>{interest.liked}</b><span>liked</span></div>
          </div>
          {interest.tenants.slice(0, 8).map((x, i) => {
            const [label, color] = ACTION[x.action] ?? ACTION.sent;
            const row = <><span style={{ flex: 1 }}>{x.name}</span><span style={{ color, fontWeight: 700, fontSize: 12.5 }}>{label}</span></>;
            return x.slug
              ? <Link key={i} to={pp(`/tenants/${x.slug}`)} className="pz-row fc-who">{row}</Link>
              : <div key={i} className="pz-row fc-who">{row}</div>;
          })}
          {interest.sent === 0 && <p className="pz-hint" style={{ margin: 0 }}>Not sent to anyone yet — send it to the tenants below.</p>}
        </div>
      )}

      <div className="pz-section">
        <h2><span className="pz-row" style={{ gap: 6 }}><Users size={17} /> Tenants it suits</span><span className="pz-meta">{fits.length}</span></h2>
        {fits.length === 0 ? (
          <span className="pz-meta">None of your tenants fits this flat yet{tenants.length ? "" : " — add tenants in Leads"}.</span>
        ) : fits.map((m) => (
          <div key={m.lead.key} className="pz-row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
            <span className="pz-score">{m.score}</span>
            <Link to={pp(`/tenants/${keyToSlug(m.lead.key)}`)} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 4 }}>{m.lead.name}{m.lead.kind === "moveazy" && <MzBadge />}</strong>
              <span className="pz-meta">{m.reasons.slice(0, 3).join(" · ")}</span>
            </Link>
            <button type="button" className="pz-btn pz-btn--sm pz-btn--ai" disabled={busy === m.lead.key} onClick={() => send(m.lead)}>
              <Send size={14} /> {busy === m.lead.key ? "…" : "Send"}
            </button>
          </div>
        ))}
        <p className="pz-hint" style={{ margin: "8px 0 0" }}>They get it as a swipe card — you see when they open it and if they like it.</p>
      </div>

      {share && <ShareListSheet lead={share.lead} list={share.list} brokerName={me?.partner?.name} onClose={() => setShare(null)} />}
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
.fc-bar { height: 7px; border-radius: 99px; background: var(--line); overflow: hidden; }
.fc-bar i { display: block; height: 100%; background: var(--goldg); border-radius: 99px; }
.fc-stats { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-bottom: 6px; }
.fc-stats b { display: block; font-size: 20px; }
.fc-stats span { font-size: 12px; color: var(--dim); }
.fc-who { padding: 7px 0; border-top: 1px solid var(--line); color: inherit; text-decoration: none; font-size: 14px; }
`;
