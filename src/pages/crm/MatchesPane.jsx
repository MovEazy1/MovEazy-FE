/**
 * The right pane: which flats fit this client, ranked, re-ranked the moment the
 * requirement beside it changes.
 *
 * The scoring is lib/inventoryMatch.js — the same engine the public site uses,
 * so a score here means what it means everywhere else. This pane only exposes
 * it and puts three actions next to each result.
 */
import { useMemo, useState } from "react";
import { matchRequirementToListings } from "../../lib/inventoryMatch";
import {
  buildTemplateVars, generateShareToken, propertyLink, renderTemplate, whatsappUrl,
} from "../../lib/crmSettings";
import { logActivity, recordClientReaction, upsertShortlist } from "../../lib/crmClients";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, ScoreRing, inr, relTime } from "./crmUi";

const REACTIONS = [
  { id: "like", label: "Like", color: C.accent },
  { id: "okay", label: "Okay", color: C.textDim },
  { id: "dislike", label: "Dislike", color: C.coral },
];

/** First usable photo — a listing may have a cover set, images only, or neither. */
function coverOf(listing) {
  return listing?.cover_image_url || (listing?.images ?? [])[0] || "";
}

function MatchCard({ match, shortlist, canWrite, onSend, onShortlist, onReact, busy, selecting, checked, onToggle }) {
  const { listing, score, reasons, blockers } = match;
  const sent = shortlist?.shared_at;
  const cover = coverOf(listing);

  return (
    <div
      onClick={selecting ? () => onToggle(listing.property_id) : undefined}
      style={{
        display: "flex", gap: 10, padding: "11px 12px",
        borderBottom: `1px solid ${C.lineSoft}`,
        cursor: selecting ? "pointer" : "default",
        background: selecting && checked ? C.accentSoft : "transparent",
      }}
    >
      {selecting && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(listing.property_id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${listing.flat_type || "home"} in ${listing.area || ""}`}
          style={{ flex: "none", marginTop: 14, width: 16, height: 16, accentColor: C.accent }}
        />
      )}
      <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <ScoreRing score={score} />
        {/* Five near-identical "Room in Preoccupied flat · Bellandur" rows are
            impossible to tell apart by text; the photo is what an agent recognises. */}
        <div
          style={{
            width: 42, height: 42, borderRadius: 7, overflow: "hidden", flex: "none",
            background: C.surfaceAlt, border: `1px solid ${C.line}`,
            display: "grid", placeItems: "center",
          }}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="crm-mute" style={{ fontSize: 8, letterSpacing: ".06em" }}>NO PIC</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
          {listing.flat_type || "Home"} · {listing.area || "—"}
        </span>
        <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
          {inr(listing.rent)} · {listing.property_id} · {listing.furnishing || "—"}
        </span>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {reasons.slice(0, 3).map((r) => (
            <span key={r} className="crm-chip crm-chip--on" style={{ pointerEvents: "none" }}>{r}</span>
          ))}
          {blockers.map((b) => (
            <span key={b} className="crm-chip crm-chip--bad" style={{ pointerEvents: "none" }}>{b}</span>
          ))}
        </div>

        {canWrite && !selecting && (
          <div style={{ display: "flex", gap: 5, marginTop: 2, flexWrap: "wrap" }}>
            <Btn sm variant={sent ? undefined : "wa"} disabled={busy} onClick={() => onSend(match)}>
              {sent ? `Sent ${relTime(shortlist.shared_at)}` : "Send"}
            </Btn>
            <Btn sm disabled={busy} onClick={() => onShortlist(match)}>
              {shortlist ? "Shortlisted" : "Shortlist"}
            </Btn>
            <a className="crm-btn crm-btn--sm" href={propertyLink(listing.property_id)}
               target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              Open
            </a>
          </div>
        )}

        {sent && (
          <span
            className="crm-num"
            style={{ fontSize: 10.5, color: shortlist.open_count > 0 ? C.accent : C.textMute }}
          >
            {shortlist.open_count > 0
              ? `Opened ${shortlist.open_count}× · last ${relTime(shortlist.last_opened_at)}`
              : "Not opened yet"}
          </span>
        )}

        {canWrite && sent && !selecting && (
          <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
            <span className="crm-mute" style={{ fontSize: 10 }}>Replied:</span>
            {REACTIONS.map((r) => {
              const on =
                (r.id === "like" && shortlist?.status === "liked") ||
                (r.id === "okay" && shortlist?.status === "okay") ||
                (r.id === "dislike" && shortlist?.status === "disliked");
              return (
                <Btn key={r.id} sm disabled={busy} onClick={() => onReact(match, r.id)}
                  style={on ? { borderColor: r.color, color: r.color, background: `${r.color}18` } : undefined}>
                  {r.label}
                </Btn>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchesPane({
  client, requirement, inventory, shortlists, settings, access, actorEmail, agentName,
  onShortlistsChanged, onToast,
}) {
  const [availableOnly, setAvailableOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());

  const togglePicked = (propertyId) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });

  const cancelSelecting = () => { setSelecting(false); setPicked(new Set()); };

  const canWrite = access.has(SCOPES.CLIENTS_WRITE);
  const minScore = requirement?.min_score ?? 60;

  const pool = useMemo(
    () => (availableOnly ? inventory.filter((l) => l.status === "published") : inventory),
    [inventory, availableOnly],
  );

  const matches = useMemo(
    () => matchRequirementToListings(requirement, pool, { min: minScore }),
    [requirement, pool, minScore],
  );

  const byProperty = useMemo(() => {
    const m = new Map();
    for (const s of shortlists) if (s.client_id === client.id) m.set(s.property_id, s);
    return m;
  }, [shortlists, client.id]);

  const sendTemplate = useMemo(() => {
    const list = settings?.templates ?? [];
    return list.find((t) => t.id === "send_property") ?? list[0];
  }, [settings]);

  const handleSend = async (match) => {
    if (!client.phone) return onToast("No phone number on this client", "error");
    // Reuse the token if this property was shared before, so a re-send keeps
    // counting against the same row instead of orphaning the earlier opens.
    const existing = byProperty.get(match.listing.property_id);
    const shareToken = existing?.share_token || generateShareToken();

    const vars = buildTemplateVars({ client, requirement, agentName, property: match.listing, shareToken });
    const url = whatsappUrl(client.phone, renderTemplate(sendTemplate?.body ?? "", vars));
    window.open(url, "_blank", "noopener");

    setBusy(true);
    try {
      await upsertShortlist(client.id, match.listing.property_id, {
        status: "shared",
        score_at_share: match.score,
        shared_by: actorEmail,
        shared_at: new Date().toISOString(),
        share_token: shareToken,
      });
      await logActivity(client.id, {
        type: "whatsapp",
        body: `Sent ${match.listing.property_id} (${match.score}% match)`,
        meta: { property_id: match.listing.property_id, score: match.score },
        actorEmail,
      });
      await onShortlistsChanged();
    } catch (e) {
      onToast(e?.message || "Sent, but could not log it", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleShortlist = async (match) => {
    setBusy(true);
    try {
      await upsertShortlist(client.id, match.listing.property_id, {
        status: "shortlisted",
        score_at_share: match.score,
      });
      await onShortlistsChanged();
    } catch (e) {
      onToast(e?.message || "Could not shortlist", "error");
    } finally {
      setBusy(false);
    }
  };

  /** What the client said on WhatsApp, typed in by the agent — the browser can
   *  never read their reply itself, so this is the capture point. */
  const handleReact = async (match, reaction) => {
    setBusy(true);
    try {
      await recordClientReaction(client, match.listing.property_id, reaction, { actorEmail });
      await onShortlistsChanged();
      onToast(`Recorded "${reaction}"`);
    } catch (e) {
      onToast(e?.message || "Could not record the reply", "error");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Send a set the agent chose, rather than whatever the top five happened to
   * be. Every property still gets its own tracked link.
   */
  const handleSendSelected = async () => {
    if (!client.phone) return onToast("No phone number on this client", "error");
    const top = matches.filter((m) => picked.has(m.listing.property_id));
    if (top.length < 2) return onToast("Pick at least two properties", "error");
    const template = (settings?.templates ?? []).find((t) => t.id === "share_matches");
    const shareTokens = Object.fromEntries(
      top.map((m) => [
        m.listing.property_id,
        byProperty.get(m.listing.property_id)?.share_token || generateShareToken(),
      ]),
    );
    const vars = buildTemplateVars({ client, requirement, agentName, matches: top, shareTokens });
    window.open(whatsappUrl(client.phone, renderTemplate(template?.body ?? "", vars)), "_blank", "noopener");

    setBusy(true);
    try {
      for (const m of top) {
        await upsertShortlist(client.id, m.listing.property_id, {
          status: "shared", score_at_share: m.score, shared_by: actorEmail,
          shared_at: new Date().toISOString(),
          share_token: shareTokens[m.listing.property_id],
        });
      }
      await logActivity(client.id, {
        type: "whatsapp",
        body: `Shared ${top.length} properties`,
        meta: { property_ids: top.map((m) => m.listing.property_id) },
        actorEmail,
      });
      await onShortlistsChanged();
      cancelSelecting();
    } catch (e) {
      onToast(e?.message || "Sent, but could not log it", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="crm-col" style={{ width: 300, flex: "none" }}>
      <div className="crm-colhead">
        <span className="crm-label">
          {selecting ? `Selected · ${picked.size}` : `Matches · ${matches.length}`}
        </span>
        {canWrite && matches.length > 0 && (
          selecting ? (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn
                sm
                variant="wa"
                onClick={handleSendSelected}
                disabled={busy || picked.size < 2}
                title={picked.size < 2 ? "Pick at least two" : `Send ${picked.size} properties`}
              >
                Send {picked.size || ""}
              </Btn>
              <Btn sm onClick={cancelSelecting}>Cancel</Btn>
            </div>
          ) : (
            <Btn sm onClick={() => setSelecting(true)}>Send multiple</Btn>
          )
        )}
      </div>

      <div style={{ padding: "8px 12px", display: "flex", gap: 6, flexWrap: "wrap", flex: "none" }}>
        <span className="crm-chip" style={{ pointerEvents: "none" }}>≥ {minScore}%</span>
        <Chip on={availableOnly} onClick={() => setAvailableOnly((v) => !v)}>Available now</Chip>
      </div>

      {selecting && (
        <p
          className="crm-mute"
          style={{ fontSize: 11, margin: 0, padding: "0 12px 8px", lineHeight: 1.45 }}
        >
          {picked.size < 2
            ? "Tap the properties to include — at least two."
            : `${picked.size} selected. They go in one message, each with its own tracked link.`}
        </p>
      )}

      <div className="crm-scroll" style={{ flex: 1 }}>
        {matches.length === 0 ? (
          <Empty>
            Nothing clears {minScore}%. Loosen the score in the requirement, widen the localities, or mark
            them “More inventory required” so new listings ping you.
          </Empty>
        ) : (
          matches.map((m) => (
            <MatchCard
              key={m.listing.property_id}
              match={m}
              shortlist={byProperty.get(m.listing.property_id)}
              canWrite={canWrite}
              busy={busy}
              onSend={handleSend}
              onShortlist={handleShortlist}
              onReact={handleReact}
              selecting={selecting}
              checked={picked.has(m.listing.property_id)}
              onToggle={togglePicked}
            />
          ))
        )}
      </div>
    </div>
  );
}
