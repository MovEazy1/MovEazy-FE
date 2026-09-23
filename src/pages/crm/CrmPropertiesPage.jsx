/**
 * Inventory list — and the reverse view of the matching engine: open a flat and
 * see every client it fits, ranked. That's how a new listing turns into four
 * WhatsApp messages in a minute.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
import { COLUMNS, matchesFilters, optionsFor } from "./propertyColumns";

// One stable empty set, so an unfiltered column does not hand ColumnFilter a
// brand-new Set on every render and re-run its effects for nothing.
const EMPTY = new Set();
import { splitMedia } from "../../lib/listingMedia";
import { mapInventoryToListing } from "../../lib/inventory";
import PropertyModal from "../../components/PropertyModal";
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
/**
 * Up to four photos of a flat, as a 2x2 the width of an id.
 *
 * The id column was a column of MZ- codes. Nobody recognises a flat from its
 * code, so finding one meant opening rows until the right one appeared — the
 * photos are what an agent actually recognises, and they cost one cell.
 *
 * Videos are dropped: a listing's media array holds both, and a <video> in a
 * 54px tile is a black square. The id stays underneath, because it is what the
 * search box matches and what every share link and WhatsApp message quotes.
 */
/**
 * A tick-list of every value this column actually holds.
 *
 * Options come from the rows the search box and status chips already left, not
 * from the whole table — a filter offering areas that cannot appear is one that
 * returns nothing and says nothing about why. They deliberately do not narrow
 * as sibling columns are ticked: options vanishing underneath somebody while
 * they are still choosing is worse than an occasional empty result.
 */
function ColumnFilter({ column, values, picked, onChange }) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = needle
    ? values.filter((v) => v.toLowerCase().includes(needle.trim().toLowerCase()))
    : values;

  const toggle = (v) => {
    const next = new Set(picked);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };

  const on = picked.size > 0;

  return (
    <span ref={box} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="crm-btn crm-btn--sm"
        style={{
          fontWeight: 600, padding: "2px 7px", gap: 4,
          borderColor: on ? C.accent : undefined, color: on ? C.accent : undefined,
        }}
        title={`Filter by ${column.label}`}
      >
        {on ? `${picked.size} picked` : "All"}
        <span aria-hidden="true" style={{ fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <span
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60,
            width: 218, maxHeight: 280, overflow: "auto", padding: 8,
            background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10,
            boxShadow: "0 12px 30px rgba(4,33,29,0.14)",
            display: "flex", flexDirection: "column", gap: 6,
          }}
        >
          {values.length > 8 && (
            <input
              className="crm-input"
              style={{ fontSize: 11.5, padding: "5px 8px" }}
              placeholder={`Search ${column.label.toLowerCase()}…`}
              value={needle}
              onChange={(e) => setNeedle(e.target.value)}
              autoFocus
            />
          )}

          <span style={{ display: "flex", gap: 6 }}>
            <Btn sm onClick={() => onChange(new Set(shown))}>All shown</Btn>
            <Btn sm onClick={() => onChange(new Set())} disabled={!on}>Clear</Btn>
          </span>

          {shown.length === 0 ? (
            <span className="crm-mute" style={{ fontSize: 11 }}>Nothing matches.</span>
          ) : (
            shown.map((v) => (
              <label
                key={v}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, cursor: "pointer" }}
              >
                <input type="checkbox" checked={picked.has(v)} onChange={() => toggle(v)} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {v}
                </span>
              </label>
            ))
          )}
        </span>
      )}
    </span>
  );
}

function PropertyThumbs({ listing, onOpen }) {
  const { photos } = splitMedia([listing.cover_image_url, ...(listing.images ?? [])].filter(Boolean));
  const shown = photos.slice(0, 4);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open ${listing.property_id}`}
      style={{
        display: "flex", flexDirection: "column", gap: 4, padding: 0,
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      {shown.length ? (
        <span
          style={{
            display: "grid", width: 54, height: 54, borderRadius: 7, overflow: "hidden",
            // One photo fills the tile; two, three or four share it, so a
            // half-photographed listing never renders as gaps.
            gridTemplateColumns: shown.length === 1 ? "1fr" : "1fr 1fr",
            gridTemplateRows: shown.length <= 2 ? "1fr" : "1fr 1fr",
            gap: 1, background: C.line, flex: "none",
          }}
        >
          {shown.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              loading="lazy"
              style={{
                width: "100%", height: "100%", objectFit: "cover", display: "block",
                background: C.surfaceAlt,
                // Three photos: the first takes the full left column, so the
                // odd one out is the feature rather than a gap.
                ...(shown.length === 3 && i === 0 ? { gridRow: "span 2" } : {}),
              }}
            />
          ))}
        </span>
      ) : (
        <span
          className="crm-mute"
          style={{
            width: 54, height: 54, borderRadius: 7, background: C.surfaceAlt, flex: "none",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5,
          }}
        >
          no photo
        </span>
      )}
      <span className="crm-num" style={{ color: C.accent, fontSize: 10.5, fontWeight: 600 }}>
        {listing.property_id}
      </span>
    </button>
  );
}

function SocialShare({ listing }) {
  const { marketingChannels } = useCrm();
  const [openPlatform, setOpenPlatform] = useState("");

  if (listing.status !== "published") return null;
  const title = socialShareTitle(listing);

  const channelList = marketingChannels || [];
  const byPlatform = groupByPlatform(channelList);

  // Channels whose platform had to be guessed and couldn't be — they exist and
  // are tracked, but no menu claims them. Surfaced so a missing channel reads
  // as a missing channel rather than as one that was never created.
  const unplaced = channelList.filter((c) => c.platform_derived && c.platform === "other");
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
                    // C.bg, not C.card — there is no C.card, and an undefined
                    // background renders transparent, which put this menu's text
                    // straight on top of the rows behind it.
                    background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8,
                    padding: 6, minWidth: 210, maxWidth: 280,
                    display: "flex", flexDirection: "column", gap: 4,
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

                  {/* The platform column is what says "Rishav's group is posted
                      to Facebook"; without it that channel can only be guessed
                      at from its source and ends up unplaced. Name the missing
                      channels rather than the migration — an agent can act on
                      "Rishav's group is missing", not on a filename. */}
                  {unplaced.length > 0 && (
                    <span
                      className="crm-mute"
                      style={{
                        fontSize: 10.5, lineHeight: 1.4, padding: "4px 4px 2px",
                        borderTop: `1px solid ${C.lineSoft}`, marginTop: 2,
                      }}
                    >
                      Not placed yet: {unplaced.map((c) => c.label).join(", ")}
                    </span>
                  )}
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
  // The full property card, opened from a thumbnail. Rendered here rather than
  // sending the agent to a new tab: they are working down a list, and a tab
  // switch loses their place in it.
  const [previewId, setPreviewId] = useState("");
  /** Ticked values per column; an absent or empty set means "no filter". */
  const [filters, setFilters] = useState({});

  const clientByReq = useMemo(() => {
    const byId = new Map(clients.map((c) => [c.id, c]));
    return (req) => byId.get(req.client_id);
  }, [clients]);

  // What the search box and the status chips leave. The column tick-lists are
  // built from this, so they only ever offer values that can actually appear.
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inventory.filter((l) => {
      if (status && l.status !== status) return false;
      if (!needle) return true;
      return [l.property_id, l.area, l.title, l.flat_type, l.poster_name, l.phone]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [inventory, q, status]);

  const options = useMemo(() => optionsFor(base), [base]);

  const anyFilter = useMemo(
    () => Object.values(filters).some((s) => s && s.size > 0),
    [filters],
  );

  // Any ticked value within a column, every ticked column at once — which is
  // how somebody reads them: "2 or 3 BHK, in HSR".
  const rows = useMemo(
    () => base.filter((l) => matchesFilters(l, filters)),
    [base, filters],
  );

  // mapInventoryToListing is what PropertyPage feeds the modal too, so the
  // card renders from the same shape in both places.
  const previewListing = useMemo(
    () => {
      const row = inventory.find((l) => l.property_id === previewId);
      return row ? mapInventoryToListing(row) : null;
    },
    [inventory, previewId],
  );

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
                  {COLUMNS.map((col) => <th key={col.key}>{col.label}</th>)}
                  <th />
                </tr>
                {/* A second header row rather than a panel above the table: a
                    filter belongs under the heading it filters, where the
                    column it applies to cannot be mistaken. */}
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key} style={{ paddingTop: 0, fontWeight: 400 }}>
                      <ColumnFilter
                        column={col}
                        values={options[col.key] || []}
                        picked={filters[col.key] || EMPTY}
                        onChange={(next) => setFilters((f) => ({ ...f, [col.key]: next }))}
                      />
                    </th>
                  ))}
                  <th style={{ paddingTop: 0 }}>
                    {anyFilter && <Btn sm onClick={() => setFilters({})}>Reset</Btn>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.property_id}>
                    <td>
                      <PropertyThumbs listing={l} onOpen={() => setPreviewId(l.property_id)} />
                    </td>
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

      {previewListing && (
        /* The same card the public site shows, so an agent checking a flat
           sees exactly what a tenant sees. manageHistory={false}: the CRM
           owns nothing in the URL here, and the modal's own history entry
           would put a back press between the agent and their list. */
        <PropertyModal
          property={previewListing}
          onClose={() => setPreviewId("")}
          manageHistory={false}
        />
      )}
    </div>
  );
}
