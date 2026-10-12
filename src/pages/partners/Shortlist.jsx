/**
 * One tenant's shortlist (/ai-matcher/<lead-…|asg-…>) — what the AI matcher
 * picked, in the partner's hands. Their own clients and MovEazy's alike.
 *
 *   New list   the AI's ten, each with its score. Remove one (never suggested
 *              to this tenant again — undo while it's on screen) or mark it
 *              sold (own flat let out; anyone else's flagged for everyone).
 *              Below ten, "Add N more to keep 10": one tap on a backup — the
 *              next ten matches — or Auto-fill. Browse all matches, with
 *              filters, for anything else. Then send.
 *   Sent       each list already shared: what they liked, disliked, haven't
 *              seen. Unseen flats can come out; any flat can be marked sold;
 *              backups go in. Save, then tell them on WhatsApp — the link
 *              shows the new flats next time it opens.
 *
 * Rules: MovEazy-BE/supabase/partner_matcher_edit.sql.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Check, ChevronRight, Heart, Plus, RotateCcw, SlidersHorizontal, Sparkles, ThumbsDown, Wand2, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Chip, Empty, Loading, Sheet, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { requirementLine } from "./leadBits";
import FilterSheet from "./FilterSheet";
import { MATCHER_CSS, MzBadge, ShareListSheet, useMatcherRows } from "./AiMatcher";
import { friendlyError, pp, waLink } from "../../lib/partners";
import { curatedUrl } from "../../lib/partnerCurated";
import { matchesForLead } from "../../lib/partnerMatch";
import { EMPTY_FILTERS, activeFilterCount, applyFilters } from "../../lib/partnerFilters";
import {
  SHORTLIST_SIZE, autoFill, backupsFor, editCuratedList, excludeForTenant, flatLine, freshPicks, keyToSlug, listUpdatedMessage,
  markSold, sendCuratedTo, slugToKey,
} from "../../lib/partnerMatcher";

const RANK_DEPTH = 60;
const SOURCE = { mine: "Your flat", moveazy: "MovEazy", broker: "Broker" };
const ACTION = {
  liked: [<Heart key="h" size={12} fill="currentColor" />, "Liked", "sl-st--liked"],
  skipped: [<ThumbsDown key="d" size={12} />, "Disliked", "sl-st--no"],
};

/** One flat on the list (or a backup), with what can be done to it. */
function Row({ l, pid, m, status, onRemove, onSold, onAdd, removeHint }) {
  const sold = l && (l.status !== "published" || l.rent_flag);
  return (
    <div className={`sl-row${sold ? " sl-row--sold" : ""}`}>
      <Link to={pp(`/property/${pid}`)} className="sl-thumb">{l ? <SmartListingImage listing={l} thumb /> : null}</Link>
      <Link to={pp(`/property/${pid}`)} className="sl-main">
        <strong>{l ? flatLine(l) : "No longer available"}</strong>
        <span className="sl-tags">
          {m && <span className="sl-score">{m.score}</span>}
          {m?.near && <span className="sl-tag">Near match</span>}
          {l?.source && <span className="sl-tag">{SOURCE[l.source] || "Broker"}</span>}
          {status && ACTION[status] ? <span className={`sl-st ${ACTION[status][2]}`}>{ACTION[status][0]} {ACTION[status][1]}</span>
            : status === "unseen" ? <span className="sl-st">Not seen yet</span> : null}
          {sold && <span className="sl-st sl-st--sold">{l.status === "rented" ? "Let out" : "Marked sold"}</span>}
        </span>
      </Link>
      <span className="sl-acts">
        {onAdd && <button type="button" className="pz-btn pz-btn--sm pz-btn--primary" onClick={onAdd}><Plus size={14} /> Add</button>}
        {onSold && !sold && <button type="button" className="sl-sold" aria-label="Mark sold" onClick={onSold}><Ban size={13} /> Sold</button>}
        {onRemove && <button type="button" className="pz-iconbtn" title={removeHint || "Remove"} aria-label="Remove" onClick={onRemove}><X size={18} /></button>}
      </span>
    </div>
  );
}

/** Every match not on the list, with the partner's filters — for anything the AI's ten and backups don't cover. */
function BrowseSheet({ tenant, pool, exclude, onAdd, onClose }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  const all = useMemo(() => matchesForLead(tenant, pool.filter((l) => !exclude.has(l.property_id) && l.status === "published" && !l.rent_flag)), [tenant, pool, exclude]);
  const rows = useMemo(() => {
    const keep = new Set(applyFilters(all.map((m) => m.listing), filters).map((l) => l.property_id));
    return all.filter((m) => keep.has(m.listing.property_id));
  }, [all, filters]);
  const n = activeFilterCount(filters);
  return (
    <Sheet title="All matches" onClose={onClose} action={
      <button type="button" className="pz-iconbtn" aria-label="Filter" onClick={() => setOpen(true)} style={n ? { color: "var(--g)" } : undefined}><SlidersHorizontal size={20} /></button>
    }>
      <div className="pz-pad" style={{ paddingTop: 0 }}>
        <p className="pz-meta" style={{ margin: "0 0 8px" }}>{rows.length} match{rows.length === 1 ? "" : "es"}{n ? " with your filters" : ""}, best first.</p>
        {rows.length === 0 ? <Empty>{all.length ? "Nothing with those filters." : "Nothing else matches right now."}</Empty>
          : rows.slice(0, 80).map((m) => (
            <Row key={m.listing.property_id} l={m.listing} pid={m.listing.property_id} m={m} onAdd={() => onAdd(m.listing.property_id)} />
          ))}
      </div>
      {open && <FilterSheet value={filters} rows={all.map((m) => m.listing)} onApply={(f) => { setFilters(f); setOpen(false); }} onClose={() => setOpen(false)} />}
    </Sheet>
  );
}

export default function Shortlist() {
  const { slug } = useParams();
  const key = slugToKey(slug);
  const { me, inventory, byId, reloadInventory } = usePartner();
  const { byKey, loaded, md } = useMatcherRows(0);
  const r = byKey.get(key);
  const tenant = r?.lead;
  const lists = useMemo(() => r?.lists ?? [], [r]);
  const [tab, setTab] = useState("new");
  const [draft, setDraft] = useState(null);
  const [removed, setRemoved] = useState([]);
  const [undo, setUndo] = useState(null);
  const [soldAsk, setSoldAsk] = useState(null); // { pid, inSent }
  const [browse, setBrowse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState(null);
  const [nudge, setNudge] = useState(null);
  const [sel, setSel] = useState(0);
  const [stage, setStage] = useState({ remove: [], add: [] });

  const seen = useMemo(() => new Set(md.seen[key] ?? []), [md.seen, key]);
  const ranked = useMemo(() => (tenant ? freshPicks(tenant, inventory ?? [], seen, RANK_DEPTH).picks : []), [tenant, inventory, seen]);
  const rankedIds = useMemo(() => ranked.map((m) => m.listing.property_id), [ranked]);
  const matchOf = useMemo(() => new Map(ranked.map((m) => [m.listing.property_id, m])), [ranked]);

  // The AI's ten, once everything's in.
  useEffect(() => {
    if (draft === null && loaded && tenant && inventory) setDraft(rankedIds.slice(0, SHORTLIST_SIZE));
  }, [draft, loaded, tenant, inventory, rankedIds]);
  useEffect(() => { setStage({ remove: [], add: [] }); }, [sel, tab]);

  if (!loaded || !inventory) return <><TopBar title="Shortlist" back={pp("/ai-matcher")} /><Loading label="Matching…" /></>;
  if (!tenant) {
    return (
      <>
        <TopBar title="Shortlist" back={pp("/ai-matcher")} />
        <Empty action={<Link className="pz-btn" to={pp(`/tenants/${slug}`)}>Open their page</Link>}>This tenant is closed or no longer with you.</Empty>
      </>
    );
  }

  const first = String(tenant.name || "").split(" ")[0] || "them";
  const list = lists[sel];
  const draftIds = draft ?? [];
  const sentNow = list ? [...list.property_ids.filter((p) => !stage.remove.includes(p)), ...stage.add] : [];
  const onScreen = tab === "new" ? draftIds : sentNow;
  const backups = backupsFor(rankedIds, onScreen, removed);
  // A sent list is kept at the size it went out with (up to ten); a new one at ten.
  const target = tab === "new" ? SHORTLIST_SIZE : Math.min(SHORTLIST_SIZE, list?.property_ids.length ?? SHORTLIST_SIZE);
  const short = Math.max(0, target - onScreen.length);
  const dirty = stage.remove.length + stage.add.length > 0;

  // ── New list ──
  const removeDraft = async (pid) => {
    setDraft((d) => d.filter((x) => x !== pid));
    setRemoved((x) => [...x, pid]);
    setUndo(pid);
    try { await excludeForTenant(tenant, pid); } catch (e) { toast(friendlyError(e), "error"); }
  };
  const undoRemove = async () => {
    const pid = undo;
    setUndo(null);
    setRemoved((x) => x.filter((p) => p !== pid));
    setDraft((d) => (d.includes(pid) ? d : [...d, pid]));
    try { await excludeForTenant(tenant, pid, true); md.reload(); } catch (e) { toast(friendlyError(e), "error"); }
  };
  const addTo = (pid) => {
    if (tab === "new") setDraft((d) => (d.includes(pid) || d.length >= 30 ? d : [...d, pid]));
    else setStage((s) => (sentNow.includes(pid) || sentNow.length >= 30 ? s : { ...s, add: [...s.add, pid] }));
  };
  const fill = () => {
    if (tab === "new") setDraft((d) => autoFill(d, backups));
    else setStage((s) => ({ ...s, add: [...s.add, ...backups.slice(0, short)] }));
  };
  const send = async () => {
    setBusy(true);
    try {
      const out = await sendCuratedTo(tenant, draftIds);
      setShare(out);
      md.reload();
      setDraft(null);
      setRemoved([]);
      setUndo(null);
    } catch (e) {
      toast(friendlyError(e, "Could not make the list."), "error");
    } finally {
      setBusy(false);
    }
  };

  // ── Sold, on either tab ──
  const confirmSold = async () => {
    const { pid, inSent } = soldAsk;
    setSoldAsk(null);
    try {
      const res = await markSold(pid);
      toast(res?.kind === "let_out" ? "Marked let out — it won't be suggested again" : "Flagged as rented — the listing broker or MovEazy confirms");
      if (!inSent) setDraft((d) => d.filter((x) => x !== pid));
      else if (!list.actions?.[pid]) setStage((s) => ({ ...s, remove: [...s.remove, pid] }));
      reloadInventory();
    } catch (e) {
      toast(friendlyError(e, "Could not mark it sold."), "error");
    }
  };

  // ── Sent ──
  const saveSent = async () => {
    setBusy(true);
    try {
      const out = await editCuratedList(list.id, stage.remove, stage.add);
      setStage({ remove: [], add: [] });
      md.reload();
      toast(`List updated · ${out.count} home${out.count === 1 ? "" : "s"}`);
      setNudge({ token: out.token, added: out.added });
    } catch (e) {
      toast(friendlyError(e, "Could not update the list."), "error");
    } finally {
      setBusy(false);
    }
  };

  const keepTen = short > 0 && (
    <div className="sl-keep">
      <span><b>Add {short} more to keep {target}.</b> Pick from the backups below, or let the AI fill it.</span>
      <button type="button" className="pz-btn pz-btn--sm pz-btn--ai" disabled={!backups.length} onClick={fill}><Wand2 size={14} /> Auto-fill</button>
    </div>
  );
  const backupBlock = (
    <div className="pz-section">
      <h2>Backups · next best matches</h2>
      {backups.length === 0 ? <p className="pz-hint" style={{ margin: 0 }}>No more matches right now. Browse all matches, or add a flat.</p>
        : backups.map((pid) => <Row key={pid} l={byId.get(pid)} pid={pid} m={matchOf.get(pid)} onAdd={() => addTo(pid)} />)}
      <button type="button" className="pz-btn pz-btn--block" style={{ marginTop: 10 }} onClick={() => setBrowse(true)}>
        <SlidersHorizontal size={16} /> Browse all matches
      </button>
    </div>
  );

  return (
    <>
      <TopBar title="Shortlist" back={pp("/ai-matcher")} />
      <style>{MATCHER_CSS()}</style>
      <style>{CSS}</style>
      <div className="pz-pad" style={{ paddingBottom: 120 }}>
        <Link to={pp(`/tenants/${keyToSlug(key)}`)} className="pz-section sl-who">
          <Avatar name={tenant.name} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "flex", alignItems: "center", fontSize: 16 }}>{tenant.name}{tenant.kind === "moveazy" && <MzBadge />}</strong>
            <span className="pz-meta">{[requirementLine(tenant), (tenant.localities ?? []).join(", ")].filter(Boolean).join(" · ") || "No requirement yet"}</span>
          </span>
          <ChevronRight size={18} color="var(--dim)" />
        </Link>

        <div className="aim-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "new"} className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>
            {lists.length ? "Next list" : "AI shortlist"} <span>{draftIds.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === "sent"} className={tab === "sent" ? "on" : ""} disabled={!lists.length} onClick={() => setTab("sent")}>
            Sent <span>{lists.length}</span>
          </button>
        </div>

        {tab === "new" ? (
          <>
            <p className="pz-hint" style={{ margin: "0 0 10px" }}>
              <Sparkles size={13} color="var(--gold)" style={{ verticalAlign: -2 }} /> The AI&apos;s best for {first} — never a flat they&apos;ve been sent, seen or turned down.
              Remove any that don&apos;t fit; mark sold any that are gone.
            </p>
            {undo && (
              <div className="sl-undo">
                <span>Removed — it won&apos;t be suggested to {first} again.</span>
                <button type="button" className="pz-btn pz-btn--sm" onClick={undoRemove}><RotateCcw size={14} /> Undo</button>
              </div>
            )}
            {keepTen}
            {draftIds.length === 0 ? (
              <Empty action={<Link className="pz-btn" to={tenant.lead_id ? pp(`/leads/${tenant.lead_id}/edit`) : pp("/add/property")}>{tenant.lead_id ? "Widen their requirement" : "Add a flat"}</Link>}>
                No new flats match {first} right now.
              </Empty>
            ) : (
              <div className="pz-card">
                {draftIds.map((pid) => (
                  <Row key={pid} l={byId.get(pid)} pid={pid} m={matchOf.get(pid)} removeHint="Remove — never suggest again"
                    onRemove={() => removeDraft(pid)} onSold={() => setSoldAsk({ pid, inSent: false })} />
                ))}
              </div>
            )}
            {backupBlock}
          </>
        ) : list && (
          <>
            {lists.length > 1 && (
              <div className="pz-chips" style={{ marginBottom: 10 }}>
                {lists.map((x, i) => (
                  <Chip key={x.id} on={sel === i} onClick={() => setSel(i)}>
                    {new Date(x.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {x.property_ids.length}
                  </Chip>
                ))}
              </div>
            )}
            <p className="pz-hint" style={{ margin: "0 0 10px" }}>
              Sent {new Date(list.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{list.open_count ? ` · opened ${list.open_count}×` : " · not opened yet"}.
              Flats they haven&apos;t seen can come out; any flat can be marked sold.
            </p>
            {keepTen}
            <div className="pz-card">
              {sentNow.map((pid) => {
                const a = list.actions?.[pid]?.action;
                const isNew = stage.add.includes(pid);
                return (
                  <Row key={pid} l={byId.get(pid)} pid={pid} m={matchOf.get(pid)} status={isNew ? null : a || "unseen"}
                    removeHint={isNew ? "Don't add" : "Take out — never suggest again"}
                    onRemove={a ? null : () => setStage((s) => (isNew ? { ...s, add: s.add.filter((p) => p !== pid) } : { ...s, remove: [...s.remove, pid] }))}
                    onSold={isNew ? null : () => setSoldAsk({ pid, inSent: true })} />
                );
              })}
            </div>
            {stage.remove.length > 0 && (
              <p className="pz-hint" style={{ margin: "8px 0 0" }}>
                Taking out {stage.remove.length} · <button type="button" className="sl-link" onClick={() => setStage((s) => ({ ...s, remove: [] }))}>keep them</button>
              </p>
            )}
            {backupBlock}
          </>
        )}
      </div>

      {/* The one big action */}
      {tab === "new" && draftIds.length > 0 && (
        <div className="sl-bar">
          <button type="button" className="pz-btn pz-btn--ai pz-btn--block" disabled={busy} onClick={send}>
            <Sparkles size={18} /> {busy ? "Making the list…" : `Send ${draftIds.length} flat${draftIds.length === 1 ? "" : "s"} to ${first}`}
          </button>
        </div>
      )}
      {tab === "sent" && dirty && (
        <div className="sl-bar">
          <button type="button" className="pz-btn pz-btn--primary pz-btn--block" disabled={busy || sentNow.length === 0} onClick={saveSent}>
            <Check size={18} /> {busy ? "Saving…" : `Save changes · ${sentNow.length} home${sentNow.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {soldAsk && (
        <Sheet title="Mark it sold?" onClose={() => setSoldAsk(null)}>
          <div className="pz-pad">
            <p style={{ margin: "0 0 6px", fontWeight: 700 }}>{flatLine(byId.get(soldAsk.pid)) || soldAsk.pid}</p>
            <p className="pz-meta" style={{ margin: "0 0 14px" }}>
              {byId.get(soldAsk.pid)?.source === "mine"
                ? "Your flat is marked let out — off every list and the matcher. Make it available again from My flats."
                : "It's flagged as rented for every partner until the listing broker or MovEazy confirms."}
              {soldAsk.inSent && list?.actions?.[soldAsk.pid] ? ` It stays on ${first}'s list, shown as let out.` : ""}
            </p>
            <button type="button" className="pz-btn pz-btn--primary pz-btn--block" onClick={confirmSold}><Ban size={16} /> Mark sold</button>
          </div>
        </Sheet>
      )}
      {browse && (
        <BrowseSheet tenant={tenant} pool={inventory} exclude={new Set([...seen, ...onScreen, ...removed])}
          onAdd={(pid) => { addTo(pid); toast("Added to the list"); }} onClose={() => setBrowse(false)} />
      )}
      {share && <ShareListSheet lead={tenant} list={share} brokerName={me?.partner?.name} onClose={() => { setShare(null); setTab("sent"); setSel(0); }} />}
      {nudge && (
        <Sheet title={`Tell ${first}`} onClose={() => setNudge(null)}>
          <div className="pz-pad">
            <p className="pz-meta" style={{ margin: "0 0 14px" }}>Their link already shows the {nudge.added ? "new flats" : "change"}. A quick WhatsApp gets them to look again.</p>
            {tenant.phone ? (
              <a className="pz-btn pz-wa pz-btn--block" target="_blank" rel="noreferrer"
                href={waLink(tenant.phone, listUpdatedMessage(tenant.no_name ? "" : tenant.name, curatedUrl(nudge.token), nudge.added))}
                onClick={() => setNudge(null)}>
                <WhatsAppIcon size={18} /> Tell them on WhatsApp
              </a>
            ) : <p className="pz-hint">No number for this client — share the link: {curatedUrl(nudge.token)}</p>}
          </div>
        </Sheet>
      )}
    </>
  );
}

const CSS = `
.sl-who { display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; }
.sl-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--line); }
.pz-card > .sl-row:first-child, .pz-section > h2 + .sl-row { border-top: 0; }
.sl-row--sold { opacity: .6; }
.sl-thumb { width: 64px; height: 50px; border-radius: 8px; overflow: hidden; flex: none; background: #E9E6DF; }
.sl-thumb img, .sl-thumb video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.sl-main { flex: 1; min-width: 0; color: inherit; text-decoration: none; display: flex; flex-direction: column; gap: 4px; }
.sl-main strong { font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; }
.sl-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.sl-score { font-size: 11px; font-weight: 800; color: #fff; background: var(--g); border-radius: 6px; padding: 1px 6px; }
.sl-tag { font-size: 11px; font-weight: 700; color: var(--dim); background: var(--bg); border-radius: 99px; padding: 2px 7px; }
.sl-st { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 800; color: #6B7280; background: #F3F4F6; border-radius: 99px; padding: 2px 7px; }
.sl-st--liked { color: #BE123C; background: #FFE4E6; }
.sl-st--no { color: #6B7280; }
.sl-st--sold { color: #92400E; background: #FEF3C7; }
.sl-acts { display: flex; align-items: center; gap: 2px; flex: none; }
.sl-sold { display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--line); background: var(--card); color: var(--dim); border-radius: 99px; padding: 5px 9px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.sl-keep { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 10px; border-radius: 12px; background: #FFF7E6; border: 1px solid #F3D9A4; font-size: 13.5px; color: #6B4A0B; }
.sl-keep > span { flex: 1; }
.sl-undo { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; margin-bottom: 10px; border-radius: 12px; background: var(--ink, #111); color: #fff; font-size: 13.5px; }
.sl-undo .pz-btn { background: #fff; color: #111; }
.sl-link { border: 0; background: none; padding: 0; color: var(--g); font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline; }
.sl-bar { position: fixed; left: 0; right: 0; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 25; max-width: 520px; margin: 0 auto; padding: 10px 16px;
  background: linear-gradient(rgba(246,247,246,0), var(--bg) 30%); }
`;
