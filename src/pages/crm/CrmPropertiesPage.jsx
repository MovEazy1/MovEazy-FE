/**
 * Inventory list — and the reverse view of the matching engine: open a flat and
 * see every client it fits, ranked. That's how a new listing turns into four
 * WhatsApp messages in a minute.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import { matchListingToRequirements } from "../../lib/inventoryMatch";
import { propertyLink } from "../../lib/crmSettings";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, ScoreRing, inr, shortDate } from "./crmUi";

export default function CrmPropertiesPage() {
  const { inventory, requirements, clients, access } = useCrm();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("published");
  const [openId, setOpenId] = useState("");

  const clientByReq = useMemo(() => {
    const byId = new Map(clients.map((c) => [c.id, c]));
    return (req) => byId.get(req.client_id);
  }, [clients]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inventory.filter((l) => {
      if (status && l.status !== status) return false;
      if (!needle) return true;
      return [l.property_id, l.area, l.title, l.flat_type, l.poster_name, l.phone]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [inventory, q, status]);

  const openListing = useMemo(() => inventory.find((l) => l.property_id === openId), [inventory, openId]);

  const matches = useMemo(
    () => (openListing ? matchListingToRequirements(openListing, requirements, { min: 40 }) : []),
    [openListing, requirements],
  );

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div className="crm-col" style={{ flex: 1 }}>
        <div className="crm-colhead">
          <span className="crm-label">Properties · {rows.length}</span>
          {access.has(SCOPES.PROPERTIES_WRITE) && (
            <Link to="/crm/properties/new" className="crm-btn crm-btn--primary crm-btn--sm" style={{ textDecoration: "none" }}>
              + Add property
            </Link>
          )}
        </div>

        <div style={{ padding: "9px 12px", display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
          <input className="crm-input" style={{ maxWidth: 280 }} placeholder="Search id, area, title, owner…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          {["published", "paused", "rented", ""].map((s) => (
            <Chip key={s || "all"} on={status === s} onClick={() => setStatus(s)}>
              {s || "All"}
            </Chip>
          ))}
        </div>

        <div className="crm-scroll" style={{ flex: 1 }}>
          {rows.length === 0 ? (
            <Empty>No listings match that.</Empty>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Id</th><th>Home</th><th>Area</th><th>Rent</th><th>Owner</th>
                  <th>Source</th><th>Added</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.property_id}>
                    <td className="crm-num" style={{ color: C.mint }}>{l.property_id}</td>
                    <td>{l.flat_type || "—"}{l.furnishing ? ` · ${l.furnishing}` : ""}</td>
                    <td>{l.area || "—"}</td>
                    <td className="crm-num">{inr(l.rent)}</td>
                    <td className="crm-num">{l.poster_name || "—"}{l.phone ? ` · ${l.phone}` : ""}</td>
                    <td className="crm-mute">{l.source || "—"}</td>
                    <td className="crm-mute crm-num">{shortDate(l.created_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <Btn sm onClick={() => setOpenId(l.property_id)}>Who fits</Btn>
                        <a className="crm-btn crm-btn--sm" href={propertyLink(l.property_id)}
                           target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Open</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {openListing && (
        <div className="crm-col" style={{ width: 300, flex: "none" }}>
          <div className="crm-colhead">
            <span className="crm-label">Who fits · {matches.length}</span>
            <Btn sm onClick={() => setOpenId("")}>Close</Btn>
          </div>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.lineSoft}`, flex: "none" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{openListing.title || openListing.flat_type}</div>
            <div className="crm-mute crm-num" style={{ fontSize: 11 }}>
              {openListing.property_id} · {openListing.area} · {inr(openListing.rent)}
            </div>
          </div>
          <div className="crm-scroll" style={{ flex: 1 }}>
            {matches.length === 0 ? (
              <Empty>Nobody clears 40% on this one yet.</Empty>
            ) : (
              matches.map((m) => {
                const client = clientByReq(m.requirement);
                return (
                  <button key={m.requirement.client_id} type="button" className="crm-lead"
                    onClick={() => navigate(`/crm/clients?client=${m.requirement.client_id}`)}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <ScoreRing score={m.score} size={34} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.cream }}>
                          {client?.name || client?.email || "Client"}
                        </span>
                        <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
                          {(m.requirement.localities ?? []).slice(0, 2).join(", ") || "—"}
                          {m.requirement.budget_max ? ` · ₹${Math.round(m.requirement.budget_max / 1000)}k` : ""}
                        </span>
                      </span>
                    </span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                      {m.reasons.slice(0, 2).map((r) => (
                        <span key={r} className="crm-chip crm-chip--on" style={{ pointerEvents: "none" }}>{r}</span>
                      ))}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
