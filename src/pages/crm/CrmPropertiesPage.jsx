/**
 * Inventory list — and the reverse view of the matching engine: open a flat and
 * see every client it fits, ranked. That's how a new listing turns into four
 * WhatsApp messages in a minute.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import { matchListingToRequirements } from "../../lib/inventoryMatch";
import {
  SHARE_COMPOSERS,
  channelPropertyLink,
  propertyLink,
  socialShareTitle,
} from "../../lib/crmSettings";
import { groupByPlatform } from "../../lib/marketing";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, ScoreRing, inr, shortDate } from "./crmUi";

/** Platforms we show first, and what the button says. Anything else follows. */
const PLATFORM_ORDER = ["facebook", "reddit", "instagram", "whatsapp", "linkedin", "twitter"];
const PLATFORM_LABEL = {
  facebook: "Facebook",
  reddit: "Reddit",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  twitter: "X",
  other: "Other",
};
const PLATFORM_CLASS = { facebook: "crm-btn--fb", reddit: "crm-btn--reddit" };

/**
 * One tracked surface to post this flat to.
 *
 * The name opens the platform's composer with the channel's link already in it;
 * Copy hands over the same link for a surface with no composer worth using — a
 * Facebook group, where the sharer dialog is more friction than pasting.
 *
 * Both carry identical parameters. Which one an agent uses must not change what
 * the dashboard later sees, or the numbers would quietly depend on habit.
 */
function ChannelRow({ channel, listing, title, onPicked }) {
  const [copied, setCopied] = useState(false);
  const link = channelPropertyLink(listing.property_id, channel);
  const composer = SHARE_COMPOSERS[channel.platform];

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the composer link still works */
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {composer ? (
        <a
          className="crm-btn crm-btn--sm"
          href={composer.build(listing.property_id, title, channel)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onPicked}
          style={{ textDecoration: "none", flex: 1, justifyContent: "flex-start" }}
          title={link}
        >
          {channel.label}
        </a>
      ) : (
        <span className="crm-btn crm-btn--sm" style={{ flex: 1, justifyContent: "flex-start", cursor: "default" }}
              title={link}>
          {channel.label}
        </span>
      )}
      <button type="button" className="crm-btn crm-btn--sm" onClick={copy}
              title={`Copy the tracked link for ${channel.label}`}>
        {copied ? "✓" : "Copy"}
      </button>
    </div>
  );
}

/**
 * Post a flat to a marketing channel.
 *
 * One button per platform; opening it lists that platform's channels, because
 * "posted to Facebook" is not an answer anyone can act on — the page, the
 * founder's profile and Rishav's group are three different audiences with three
 * different costs, and the whole point of /marketing is telling them apart.
 * Picking one stamps its utm_campaign on the link, which is the key a signup is
 * credited by weeks later.
 *
 * The list comes from the database, so a channel added in /superadmin appears
 * here with no deploy. A platform with no channels yet still gets its plain
 * button, attributed to the platform and nothing finer — worse, but not broken.
 *
 * Only published listings get any of this. A paused or rented flat posted to a
 * public feed outlives the share: the post stays up, and people keep arriving
 * at something they cannot rent.
 */
function SocialShare({ listing }) {
  const { marketingChannels } = useCrm();
  const [openPlatform, setOpenPlatform] = useState("");

  if (listing.status !== "published") return null;
  const title = socialShareTitle(listing);

  const byPlatform = groupByPlatform(marketingChannels || []);
  const platforms = [
    ...PLATFORM_ORDER.filter((p) => byPlatform.has(p) || p === "facebook" || p === "reddit"),
    ...[...byPlatform.keys()].filter((p) => !PLATFORM_ORDER.includes(p)),
  ];

  return (
    <>
      {platforms.map((platform) => {
        const channels = byPlatform.get(platform) || [];
        const open = openPlatform === platform;

        // No channels for this platform yet: keep the original one-click share
        // rather than opening an empty menu.
        if (!channels.length) {
          const composer = SHARE_COMPOSERS[platform];
          if (!composer) return null;
          return (
            <a
              key={platform}
              className={`crm-btn crm-btn--sm ${PLATFORM_CLASS[platform] || ""}`}
              href={composer.build(listing.property_id, title, null)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
              title={`Share ${listing.property_id} on ${PLATFORM_LABEL[platform] || platform}`}
            >
              {PLATFORM_LABEL[platform] || platform}
            </a>
          );
        }

        return (
          <span key={platform} style={{ position: "relative" }}>
            <button
              type="button"
              className={`crm-btn crm-btn--sm ${PLATFORM_CLASS[platform] || ""}`}
              onClick={() => setOpenPlatform(open ? "" : platform)}
              title={`Post ${listing.property_id} to a tracked ${PLATFORM_LABEL[platform] || platform} channel`}
            >
              {PLATFORM_LABEL[platform] || platform} ▾
            </button>

            {open && (
              <>
                {/* Click-away. Sits under the menu, over everything else, so a
                    second click anywhere closes it without each row needing a
                    document listener. */}
                <span
                  onClick={() => setOpenPlatform("")}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <span
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 41,
                    background: C.card, border: `1px solid ${C.line}`, borderRadius: 8,
                    padding: 6, minWidth: 210, display: "flex", flexDirection: "column", gap: 4,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                  }}
                >
                  {channels.map((c) => (
                    <ChannelRow
                      key={c.slug}
                      channel={c}
                      listing={listing}
                      title={title}
                      onPicked={() => setOpenPlatform("")}
                    />
                  ))}
                </span>
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

export default function CrmPropertiesPage() {
  const { inventory, requirements, clients, access } = useCrm();
  const navigate = useNavigate();

  const canEdit = access.has(SCOPES.PROPERTIES_WRITE);

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
          {canEdit && (
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
                    <td className="crm-num" style={{ color: C.accent }}>{l.property_id}</td>
                    <td>{l.flat_type || "—"}{l.furnishing ? ` · ${l.furnishing}` : ""}</td>
                    <td>{l.area || "—"}</td>
                    <td className="crm-num">{inr(l.rent)}</td>
                    <td className="crm-num">{l.poster_name || "—"}{l.phone ? ` · ${l.phone}` : ""}</td>
                    <td className="crm-mute">{l.source || "—"}</td>
                    <td className="crm-mute crm-num">{shortDate(l.created_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <Btn sm onClick={() => setOpenId(l.property_id)}>Who fits</Btn>
                        {canEdit && (
                          <Link to={`/crm/properties/${l.property_id}/edit`}
                                className="crm-btn crm-btn--sm" style={{ textDecoration: "none" }}>Edit</Link>
                        )}
                        <a className="crm-btn crm-btn--sm" href={propertyLink(l.property_id)}
                           target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Open</a>
                        <SocialShare listing={l} />
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
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.text }}>
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
