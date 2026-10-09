/**
 * "Curate list" — building one client's shortlist, phone first.
 *
 *   ┌ header: who it's for · Save · Save & send
 *   ├ their requirement in a line · Modify requirements (re-ranks as you type)
 *   ├ the tray: what's in the list so far — pre-filled from lists made for
 *   │ anyone in the last 30 days that fit them (lib/curation.js), or their
 *   │ saved draft. Tap a flat to look at it, × to take it out.
 *   ├ recent lists: each with how many of its flats fit, one tap to add those
 *   └ the feed: every flat that fits, best match first — photos swipe, tap one
 *     for full screen — with Add · Pass · Sold out · Open on each card.
 *
 * Pass and Sold out leave the card where it is, greyed, with Undo, until the
 * screen closes. "Save" keeps the list on the client as a draft; "Save & send"
 * opens WhatsApp with its link, exactly as the Matches pane's send did.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  curationFeed, fittingFromList, preselect, recentLists, turnedDown,
} from "../../lib/curation";
import { coordsOf } from "../../lib/commute";
import { fetchClientPasses, logActivity, passFlat, unpassFlat, upsertShortlist } from "../../lib/crmClients";
import { fetchCuratedShares, fetchRecentCuratedShares, markCuratedSent, saveCuratedDraft } from "../../lib/curatedShares";
import { buildTemplateVars, renderTemplate, whatsappUrl } from "../../lib/crmSettings";
import { scoreMatch } from "../../lib/inventoryMatch";
import { SCOPES } from "../../lib/adminScopes";
import { listingMedia, listingCover, MediaItem } from "../partners/partnerMedia";
import ThumbImg from "../../components/ThumbImg";
import { useSnapTrack } from "../../hooks/useSnapTrack";
import { usePhotoViewer } from "../../hooks/usePhotoViewer";
import { useBackClose } from "../../hooks/useBackClose";
import RequirementFields from "./RequirementFields";
import PropertyQuickView, { QuickSoldOut } from "./PropertyQuickView";
import { Btn, C, ScoreRing, inr, relTime } from "./crmUi";

const PAGE = 20;

function reqLine(req) {
  const budget = req.budget_max ? `up to ${inr(req.budget_max)}` : req.budget_min ? `from ${inr(req.budget_min)}` : "";
  return [
    (req.flat_types ?? []).join(" / "),
    (req.localities ?? []).length ? `in ${req.localities.slice(0, 3).join(", ")}${req.localities.length > 3 ? ` +${req.localities.length - 3}` : ""}` : "",
    budget,
    req.furnishing,
    req.move_in ? `move-in ${req.move_in}` : "",
  ].filter(Boolean).join(" · ") || "No requirement yet — add one to rank the flats";
}

function CardPhotos({ listing, onOpen }) {
  const media = listingMedia(listing);
  const { index, trackProps } = useSnapTrack();
  const full = usePhotoViewer(media, `${listing.flat_type || "Home"} · ${listing.area || ""}`);
  if (!media.length) {
    return <div className="cs-ph cs-ph--none" onClick={onOpen}>No photos</div>;
  }
  return (
    <div className="cs-ph">
      <div className="mz-snap" {...trackProps} style={{ position: "absolute", inset: 0 }}>
        {media.map((src, i) => (
          <div key={`${src}-${i}`} style={{ height: "100%" }} onClick={() => full.open(i)}>
            {Math.abs(i - index) <= 1 ? <MediaItem src={src} /> : null}
          </div>
        ))}
      </div>
      {media.length > 1 && <span className="cs-count">{index + 1} / {media.length}</span>}
      {full.viewer}
    </div>
  );
}

function Card({ match, inList, passed, canWrite, onAdd, onPass, onUndoPass, onOpen, onPatch, onToast }) {
  const { listing, score, reasons } = match;
  const sold = listing.status === "rented";
  if (passed) {
    return (
      <div className="cs-card cs-card--gone">
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{listing.flat_type || "Home"} · {listing.area}</b> <span className="crm-mute">· passed</span>
        </span>
        <Btn sm onClick={() => onUndoPass(listing.property_id)}>Undo</Btn>
      </div>
    );
  }
  return (
    <div className={`cs-card${sold ? " cs-card--sold" : ""}${inList ? " cs-card--in" : ""}`}>
      <CardPhotos listing={listing} onOpen={() => onOpen(listing)} />
      <div className="cs-info" onClick={() => onOpen(listing)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen(listing)}>
        <ScoreRing score={score} size={38} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="cs-title">{listing.flat_type || "Home"} · {listing.area || "—"}</div>
          <div className="crm-num cs-sub">
            {inr(listing.rent)}{listing.deposit ? ` · dep ${inr(listing.deposit)}` : ""}
            {listing.furnishing ? ` · ${listing.furnishing}` : ""}
          </div>
          <div className="crm-mute crm-num" style={{ fontSize: 10.5 }}>{listing.property_id}</div>
        </div>
      </div>
      {reasons.length > 0 && (
        <div className="cs-reasons">
          {reasons.slice(0, 4).map((r) => <span key={r} className="crm-chip crm-chip--on" style={{ pointerEvents: "none" }}>{r}</span>)}
        </div>
      )}
      <div className="cs-actions">
        {canWrite && !sold && (
          <Btn variant={inList ? undefined : "primary"} onClick={() => onAdd(listing.property_id)}
            style={inList ? { borderColor: C.accent, color: C.accent } : undefined}>
            {inList ? "✓ In list" : "+ Add"}
          </Btn>
        )}
        {canWrite && !inList && !sold && <Btn onClick={() => onPass(listing.property_id)}>Pass</Btn>}
        <QuickSoldOut listing={listing} canEdit={canWrite} onPatch={onPatch} onToast={onToast} sm={false} />
        <Btn onClick={() => onOpen(listing)}>Open</Btn>
      </div>
    </div>
  );
}

export default function CurateScreen({
  client, requirement, onRequirementChange, office, inventory, shortlists, reactions, access, settings,
  actorEmail, agentName, onShortlistsChanged, onPatchListing, onToast, onClose,
}) {
  const canWrite = access.has(SCOPES.CLIENTS_WRITE);
  const canEditReq = access.has(SCOPES.REQUIREMENTS_WRITE);
  const [tray, setTray] = useState([]);
  const [draft, setDraft] = useState(null);
  const [origin, setOrigin] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lists, setLists] = useState([]);
  const [passes, setPasses] = useState([]);
  const [keep, setKeep] = useState(() => new Set());
  const [editing, setEditing] = useState(false);
  const [showLists, setShowLists] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState("");

  const close = useCallback(() => {
    if (dirty && !window.confirm("Leave without saving this list?")) return;
    onClose();
  }, [dirty, onClose]);
  useBackClose(true, close, "curate");

  const inventoryById = useMemo(() => new Map(inventory.map((l) => [l.property_id, l])), [inventory]);
  const down = useMemo(() => turnedDown(client.id, shortlists, reactions, passes), [client.id, shortlists, reactions, passes]);
  const radiusKm = requirement.office_radius_km ?? 8;
  const officeAt = coordsOf(office) ? office : null;
  const recent = useMemo(() => recentLists(lists, client.id), [lists, client.id]);
  const ctx = useMemo(
    () => ({ inventoryById, req: requirement, office: officeAt, radiusKm, down }),
    [inventoryById, requirement, officeAt, radiusKm, down],
  );

  // First: their saved draft if there is one, else what fits from recent lists.
  const seeded = useRef(false);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchCuratedShares(client.id), fetchRecentCuratedShares(30), fetchClientPasses(client.id)])
      .then(([mine, all, ps]) => {
        if (!alive) return;
        setLists(all);
        setPasses(ps);
        const d = mine.find((s) => s.status === "draft");
        if (d) { setDraft(d); setTray(d.property_ids ?? []); setOrigin(`Your saved draft from ${relTime(d.updated_at || d.created_at)}`); }
        setLoaded(true);
      });
    return () => { alive = false; };
  }, [client.id]);
  useEffect(() => {
    if (!loaded || seeded.current || draft) return;
    seeded.current = true;
    const ids = preselect(recent, ctx);
    if (ids.length) {
      setTray(ids);
      setDirty(true);
      setOrigin(`${ids.length} pre-selected from ${recent.length} recent list${recent.length === 1 ? "" : "s"} — they fit ${client.name || "this client"}`);
    }
  }, [loaded, draft, recent, ctx, client.name]);

  const feed = useMemo(
    () => curationFeed({ inventory, req: requirement, down, keep }),
    [inventory, requirement, down, keep],
  );
  const inTray = useMemo(() => new Set(tray), [tray]);

  const toggle = (pid) => {
    setTray((t) => (t.includes(pid) ? t.filter((x) => x !== pid) : [...t, pid]));
    setDirty(true);
  };
  const addMany = (ids) => {
    const fresh = ids.filter((id) => !inTray.has(id));
    if (!fresh.length) return onToast("Those are already in the list");
    setTray((t) => [...t, ...fresh]);
    setDirty(true);
    onToast(`Added ${fresh.length}`);
  };
  const pass = async (pid) => {
    setKeep((k) => new Set(k).add(pid));
    setPasses((p) => [...p, { property_id: pid }]);
    try { await passFlat(client.id, pid, { actorEmail }); } catch (e) {
      setPasses((p) => p.filter((x) => x.property_id !== pid));
      onToast(e?.message || "Couldn't save the pass", "error");
    }
  };
  const undoPass = async (pid) => {
    setPasses((p) => p.filter((x) => x.property_id !== pid));
    try { await unpassFlat(client.id, pid); } catch (e) { onToast(e?.message || "Couldn't undo", "error"); }
  };
  const patch = (pid, change) => {
    if (change.status === "rented") {
      setKeep((k) => new Set(k).add(pid));
      setTray((t) => t.filter((x) => x !== pid));
    }
    onPatchListing(pid, change);
  };

  const save = async () => {
    const row = await saveCuratedDraft({ id: draft?.id, clientId: client.id, propertyIds: tray, sharedBy: actorEmail, agentName });
    setDraft(row);
    setDirty(false);
    return row;
  };
  const onSave = async () => {
    if (!tray.length) return onToast("Add at least one flat first", "error");
    setBusy("save");
    try {
      await save();
      await logActivity(client.id, { type: "shortlist", body: `Saved a curated list of ${tray.length} (not sent)`, actorEmail }).catch(() => null);
      onToast(`List saved · ${tray.length} flat${tray.length === 1 ? "" : "s"}`);
    } catch (e) {
      onToast(e?.message || "Couldn't save the list", "error");
    } finally {
      setBusy("");
    }
  };
  const onSend = async () => {
    if (!client.phone) return onToast("No phone number on this client", "error");
    if (tray.length < 2) return onToast("Pick at least two flats to send as a list", "error");
    // Opened now, in the tap itself, or a popup blocker swallows it later.
    const waTab = window.open("about:blank", "_blank");
    if (waTab) waTab.opener = null;
    setBusy("send");
    try {
      const saved = await save();
      const share = await markCuratedSent(saved.id);
      const picked = tray.map((id) => inventoryById.get(id)).filter(Boolean)
        .map((l) => ({ listing: l, score: scoreMatch(l, requirement).score }));
      const template = (settings?.templates ?? []).find((t) => t.id === "share_curated")
        ?? (settings?.templates ?? []).find((t) => t.id === "share_matches");
      const vars = buildTemplateVars({ client, requirement, agentName, matches: picked, curatedLink: share.link });
      const url = whatsappUrl(client.phone, renderTemplate(template?.body ?? "", vars));
      if (waTab) waTab.location.replace(url); else window.open(url, "_blank", "noopener");
      const now = new Date().toISOString();
      for (const m of picked) {
        await upsertShortlist(client.id, m.listing.property_id, {
          status: "shared", score_at_share: m.score, shared_by: actorEmail, shared_at: now, curated_share_id: share.id,
        });
      }
      await logActivity(client.id, {
        type: "whatsapp", body: `Shared a curated shortlist of ${picked.length} properties`,
        meta: { property_ids: picked.map((m) => m.listing.property_id), curated_share_id: share.id }, actorEmail,
      });
      await onShortlistsChanged();
      setDirty(false);
      onToast(`Sent ${picked.length} homes as one link`);
      onClose();
    } catch (e) {
      waTab?.close();
      onToast(e?.message || "Couldn't send the list", "error");
    } finally {
      setBusy("");
    }
  };

  const passedSet = down.passed;
  return createPortal(
    <div className="crm cs" role="dialog" aria-modal="true" aria-label={`Curate a list for ${client.name || "client"}`}>
      <style>{CSS}</style>
      <header className="cs-head">
        <button type="button" className="cs-icon" aria-label="Back" onClick={close}><ArrowLeft size={20} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Curate for {client.name || "client"}
          </div>
          <div className="crm-mute" style={{ fontSize: 11 }}>{tray.length} in the list{dirty ? " · not saved" : draft ? " · saved" : ""}</div>
        </div>
        {canWrite && <Btn onClick={onSave} disabled={!!busy || !tray.length}>{busy === "save" ? "Saving…" : "Save"}</Btn>}
        {canWrite && <Btn variant="wa" onClick={onSend} disabled={!!busy || tray.length < 2}>{busy === "send" ? "Sending…" : "Save & send"}</Btn>}
      </header>

      <div className="cs-scroll">
        <section className="cs-req">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <p style={{ margin: 0, flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>{reqLine(requirement)}</p>
            <Btn sm onClick={() => setEditing((v) => !v)}>
              {editing ? <><ChevronUp size={13} /> Done</> : <><ChevronDown size={13} /> Modify requirements</>}
            </Btn>
          </div>
          {editing && (
            <div style={{ marginTop: 10 }}>
              <RequirementFields req={requirement} canEdit={canEditReq} onChange={onRequirementChange} office={office} compact />
            </div>
          )}
        </section>

        <section className="cs-tray">
          <div className="cs-row">
            <span className="crm-label">The list · {tray.length}</span>
            {tray.length > 0 && canWrite && <Btn sm onClick={() => { setTray([]); setDirty(true); }}>Clear</Btn>}
          </div>
          {origin && <div className="crm-mute" style={{ fontSize: 11, margin: "2px 0 6px" }}>{origin}</div>}
          {tray.length === 0 ? (
            <div className="crm-mute" style={{ fontSize: 12, padding: "6px 0" }}>
              {loaded ? "Nothing yet — tap + Add on the flats below." : "Loading…"}
            </div>
          ) : (
            <div className="cs-strip">
              {tray.map((id) => {
                const l = inventoryById.get(id);
                const cover = l ? listingCover(l) : "";
                return (
                  <div key={id} className={`cs-tile${l && l.status !== "published" ? " cs-tile--off" : ""}`}>
                    <button type="button" className="cs-tile-img" onClick={() => l && setPreview(l)} aria-label={`Look at ${id}`}>
                      {cover ? <ThumbImg src={cover} alt="" /> : <span>{l?.flat_type || id}</span>}
                    </button>
                    <span className="crm-num" style={{ fontSize: 10.5, fontWeight: 700 }}>{l ? inr(l.rent) : id}</span>
                    <span className="crm-mute" style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l ? `${l.flat_type || ""} · ${l.area || ""}` : "not in inventory"}
                    </span>
                    {canWrite && (
                      <button type="button" className="cs-tile-x" aria-label={`Remove ${id}`} onClick={() => toggle(id)}><X size={12} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section className="cs-lists">
            <button type="button" className="cs-row cs-toggle" onClick={() => setShowLists((v) => !v)}>
              <span className="crm-label">Recent lists · last 30 days · {recent.length}</span>
              {showLists ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {showLists && recent.slice(0, 30).map((s) => {
              const fit = fittingFromList(s, ctx);
              const fresh = fit.filter((id) => !inTray.has(id));
              return (
                <div key={s.id} className="cs-list">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {s.client_name || "A client"} <span className="crm-mute" style={{ fontWeight: 400 }}>· {relTime(s.created_at)}{s.status === "draft" ? " · draft" : ""}</span>
                    </div>
                    <div className="crm-mute" style={{ fontSize: 11 }}>
                      {fit.length} of {s.property_ids.length} fit{s.agent_name ? ` · by ${s.agent_name}` : ""}
                    </div>
                  </div>
                  {canWrite && <Btn sm disabled={!fresh.length} onClick={() => addMany(fresh)}>{fresh.length ? `Add ${fresh.length}` : "Added"}</Btn>}
                </div>
              );
            })}
          </section>
        )}

        <section className="cs-feed">
          <div className="cs-row" style={{ padding: "0 2px 8px" }}>
            <span className="crm-label">Flats that fit · {feed.length}</span>
            <span className="crm-mute" style={{ fontSize: 11 }}>best match first</span>
          </div>
          {feed.length === 0 && (
            <div className="crm-mute" style={{ fontSize: 12.5, lineHeight: 1.5, padding: "12px 4px" }}>
              Nothing live fits right now. Loosen the requirement (Modify requirements), or lower “Show matches above”.
            </div>
          )}
          <div className="cs-grid">
            {feed.slice(0, shown).map((m) => (
              <Card key={m.listing.property_id} match={m} inList={inTray.has(m.listing.property_id)}
                passed={passedSet.has(m.listing.property_id)} canWrite={canWrite}
                onAdd={toggle} onPass={pass} onUndoPass={undoPass} onOpen={setPreview} onPatch={patch} onToast={onToast} />
            ))}
          </div>
          {feed.length > shown && (
            <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 6px" }}>
              <Btn onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, feed.length - shown)} more</Btn>
            </div>
          )}
        </section>
      </div>

      {preview && (
        <PropertyQuickView listing={inventoryById.get(preview.property_id) || preview} canEdit={canWrite}
          onPatch={patch} onToast={onToast} onClose={() => setPreview(null)}
          extra={canWrite && (inventoryById.get(preview.property_id) || preview).status === "published" ? (
            <Btn variant={inTray.has(preview.property_id) ? undefined : "primary"} onClick={() => toggle(preview.property_id)}>
              {inTray.has(preview.property_id) ? "Remove from list" : "+ Add to list"}
            </Btn>
          ) : null} />
      )}
    </div>,
    document.body,
  );
}

const CSS = `
.crm.cs { position: fixed; min-height: 0; inset: 0; z-index: 1100; background: ${C.surfaceAlt}; display: flex; flex-direction: column; color: ${C.text}; }
.cs-head { display: flex; align-items: center; gap: 8px; padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px; background: ${C.bg};
  border-bottom: 1px solid ${C.line}; flex: none; }
.crm .cs-icon { width: 36px; height: 36px; border-radius: 99px; border: 1px solid ${C.line}; background: ${C.surface}; display: grid; place-items: center;
  cursor: pointer; color: ${C.text}; flex: none; }
.cs-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 12px calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; gap: 10px; }
.cs-scroll > section { max-width: 1100px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.cs-req, .cs-tray, .cs-lists { background: ${C.bg}; border: 1px solid ${C.line}; border-radius: 12px; padding: 10px 12px; }
.cs-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.crm .cs-toggle { width: 100%; background: none; border: 0; padding: 0; cursor: pointer; color: inherit; font: inherit; }
.cs-strip { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 2px; scrollbar-width: thin; }
.cs-tile { position: relative; flex: 0 0 104px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cs-tile--off { opacity: .45; }
.crm .cs-tile-img { width: 104px; height: 78px; border-radius: 9px; overflow: hidden; border: 1px solid ${C.line}; padding: 0; background: ${C.surfaceAlt};
  cursor: pointer; display: grid; place-items: center; font-size: 10px; color: ${C.textMute}; }
.cs-tile-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.crm .cs-tile-x { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 99px; border: 0; background: rgba(0,0,0,.6);
  color: #fff; display: grid; place-items: center; cursor: pointer; }
.cs-list { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid ${C.lineSoft}; }
.cs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
.cs-card { background: ${C.bg}; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.cs-card--in { border-color: ${C.accent}; box-shadow: 0 0 0 1px ${C.accent}; }
.cs-card--sold { opacity: .6; }
.cs-card--gone { flex-direction: row; align-items: center; gap: 8px; padding: 10px 12px; opacity: .75; font-size: 12.5; }
.cs-ph { position: relative; aspect-ratio: 4 / 3; background: #0b1f1b; }
.cs-ph--none { aspect-ratio: auto; height: 64px; display: grid; place-items: center; color: ${C.textMute}; background: ${C.surfaceAlt}; font-size: 12px; cursor: pointer; }
.cs-ph img, .cs-ph video { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; }
.cs-count { position: absolute; left: 8px; bottom: 8px; background: rgba(4,33,29,.75); color: #fff; font-size: 11px; font-weight: 700;
  border-radius: 6px; padding: 2px 7px; pointer-events: none; }
.cs-info { display: flex; gap: 10px; align-items: center; padding: 10px 12px 4px; cursor: pointer; }
.cs-title { font-size: 13.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-sub { font-size: 12px; color: ${C.textDim}; }
.cs-reasons { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px 12px 0; }
.cs-actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px 12px; margin-top: auto; }
.cs-actions > * { flex: 1 1 auto; justify-content: center; }
@media (max-width: 600px) {
  .cs-head .crm-btn { padding-left: 10px; padding-right: 10px; }
  .cs-grid { grid-template-columns: 1fr; }
}
`;
