/**
 * AI Property Matcher — every home the broker can see, matched against every
 * client at once: their own clients and the MovEazy tenants assigned to them.
 * Fresh tenants (never sent a list) get a ready shortlist of ten, one tap to
 * send. Existing ones open their own page (MatcherTenant.jsx): what they liked,
 * visits, and ten more. A flat is never suggested twice — not one this broker
 * sent, one the same tenant swiped on any partner's list, or one they turned
 * down on MovEazy (lib/partnerMatcher.js).
 *
 * It is the headline feature, so it works without a plan too: in demo mode the
 * sample clients (and the partner's own) are matched against what they can
 * see, and "Send shortlist" opens a live preview of the client's swipe screen —
 * with the notifications the broker would get — instead of sending.
 *
 * The card sits on top of the home screen and shrinks to a slim sticky bar
 * under the header once it scrolls away (InventoryHome).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CalendarClock, Check, ChevronRight, Crown, Heart, MapPin, RefreshCw, Sparkles, WandSparkles, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, Sheet, TopBar, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import ShareOptions from "./ShareOptions";
import { requirementLine } from "./leadBits";
import { DEMO_COUNTS, DEMO_LEADS, DemoBanner, demoHomesFor, demoRows } from "./demoMode";
import { useMatcherData } from "./matcherData";
import logo from "../../assets/logo/moveazy-logo-mint-dark.png";
import { bhkLabel, friendlyError, inr, pp } from "../../lib/partners";
import { hasRequirement } from "../../lib/partnerMatch";
import { curatedMessage, curatedUrl } from "../../lib/partnerCurated";
import {
  FRESH_COUNT, freshPicks, keyToSlug, likedFlats, listsFor, matcherTenants, sendCuratedTo, splitTenants,
} from "../../lib/partnerMatcher";

const TOP = FRESH_COUNT;

/**
 * What the matcher can pick from: the partner's inventory — or in demo mode,
 * sample homes shaped around each of `forLeads` (tagged `for_lead`), so every
 * client gets a real-looking shortlist, with a real spread of scores, from the
 * real engine. `seed` reshuffles the samples.
 */
export function useMatchPool(forLeads = [], seed = 0) {
  const { inventory, demo } = usePartner();
  return useMemo(() => {
    const base = inventory ?? [];
    if (!demo) return base;
    const d = demoRows(base);
    const photos = [...base, ...d.broker, ...d.group];
    return forLeads.filter(hasRequirement).flatMap((lead) => demoHomesFor(lead, photos, seed));
  }, [inventory, demo, forLeads, seed]);
}

/**
 * Every tenant the matcher works on, each with their next ten: never a flat in
 * their "seen" set. In demo mode the broker's own (and sample) clients are
 * matched against sample homes; MovEazy tenants are real, against real flats.
 */
export function useMatcherRows(seed = 0) {
  const { leads, inventory } = usePartner();
  const md = useMatcherData();
  // Real tenants and real flats, free or Premium: a free partner's pool is their
  // own flats and MovEazy's (what partner_inventory shows them).
  const tenants = useMemo(() => matcherTenants(leads, md.assigned), [leads, md.assigned]);
  return useMemo(() => {
    const rows = tenants.map((t) => {
      const pool = inventory ?? [];
      const lists = listsFor(t, md.lists);
      return { lead: t, lists, ...freshPicks(t, pool, new Set(md.seen[t.key] ?? [])) };
    });
    const { fresh, existing } = splitTenants(tenants, md.lists);
    const byKey = new Map(rows.map((r) => [r.lead.key, r]));
    const homes = (inventory ?? []).length;
    return {
      rows,
      byKey,
      fresh: fresh.map((t) => byKey.get(t.key)).filter((r) => hasRequirement(r.lead) || r.lead.kind === "moveazy")
        .sort((x, y) => (y.lead.kind === "moveazy") - (x.lead.kind === "moveazy") || y.picks.length - x.picks.length),
      existing: existing.map((t) => byKey.get(t.key))
        .sort((x, y) => String(y.lists[0]?.created_at).localeCompare(String(x.lists[0]?.created_at))),
      needs: fresh.filter((t) => t.kind === "own" && !hasRequirement(t)),
      homes,
      loaded: md.loaded && inventory != null,
      md,
    };
  }, [tenants, inventory, md, seed]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The MovEazy mark on a tenant MovEazy gave them. */
export function MzBadge() {
  // Styled inline: it shows on pages that don't load the matcher's CSS (Leads, Home, flats).
  return (
    <span className="aim-mz" title="A MovEazy tenant" style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginLeft: 6,
      padding: "3px 7px", borderRadius: 99, background: "#0B0B0F", flex: "none" }}>
      <img src={logo} alt="MovEazy" style={{ height: 10, width: "auto", display: "block" }} />
    </span>
  );
}

const RUN_STEPS = (clients, homes) => [
  `Reading ${clients} client requirement${clients === 1 ? "" : "s"}`,
  `Scanning ${homes.toLocaleString("en-IN")} homes`,
  "Matching budget, area, BHK and furnishing",
  `Ranking the best ${TOP} for each client`,
];

/** The matcher at work: four steps, then the results. */
function MatcherRun({ clients, homes, onDone }) {
  const [step, setStep] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const steps = RUN_STEPS(clients, homes);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= steps.length) { clearInterval(id); setTimeout(() => done.current(), 350); }
      setStep(i);
    }, 520);
    return () => clearInterval(id);
  }, [clients, homes]);
  const steps = RUN_STEPS(clients, homes);
  return (
    <div className="amr">
      <div className="amr-orb"><WandSparkles size={26} /></div>
      <b>AI Property Matcher is running</b>
      <div className="amr-bar"><i style={{ width: `${Math.min(100, (step / steps.length) * 100)}%` }} /></div>
      <ul>
        {steps.map((t, k) => (
          <li key={t} className={k < step ? "ok" : k === step ? "now" : ""}>
            <span>{k < step ? <Check size={13} /> : k === step ? <i className="amr-spin" /> : null}</span>{t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The card on the home screen; `compact` is the slim sticky bar it becomes on scroll. */
export function AiMatcherCard({ compact = false }) {
  const navigate = useNavigate();
  const { rows, homes } = useMatcherRows(0);
  const ready = rows.filter((r) => hasRequirement(r.lead));
  const matched = ready.filter((r) => r.picks.length).length;
  const go = () => navigate(pp("/ai-matcher"));
  if (compact) {
    return (
      <button type="button" className="aim-bar" onClick={go}>
        <style>{CSS}</style>
        <WandSparkles size={16} />
        <b>AI Property Matcher</b>
        <span>{matched ? `${matched} shortlist${matched === 1 ? "" : "s"} ready` : "Match clients"}</span>
        <ChevronRight size={16} />
      </button>
    );
  }
  return (
    <button type="button" className="aim-card" onClick={go}>
      <style>{CSS}</style>
      <span className="aim-ic"><WandSparkles size={22} /></span>
      <span className="aim-txt">
        <small>AI Property Matcher</small>
        <b>{ready.length ? `${matched} of ${ready.length} client${ready.length === 1 ? "" : "s"} have a shortlist ready` : "A shortlist for every client, in seconds"}</b>
        <span>{homes.toLocaleString("en-IN")} homes scanned · tap to review and send</span>
      </span>
      <ChevronRight size={20} className="aim-go" />
    </button>
  );
}

/**
 * Demo mode: what "Send shortlist" does, played out. The client's swipe screen
 * with the real shortlist, and — as each home is liked or skipped — the
 * notifications the broker would get.
 */
export function DemoListPreview({ lead, homes, onClose }) {
  const navigate = useNavigate();
  const { me } = usePartner();
  const [i, setI] = useState(0);
  const [feed, setFeed] = useState([]);
  const first = String(lead?.name || "Your client").split(" ")[0];
  const h = homes[i];
  const liked = feed.filter((f) => f.kind === "liked").length;

  useEffect(() => {
    setFeed([{ kind: "opened", text: `${first} opened your list`, sub: `${homes.length} homes — likes and skips will show up here` }]);
  }, [first, homes.length]);

  const act = (kind) => {
    if (!h) return;
    const what = `${bhkLabel(h)} · ${h.area || "Bengaluru"}`;
    const next = [{ kind, text: `${first} ${kind === "liked" ? "liked" : "skipped"} ${what}`, sub: kind === "liked" ? `${inr(h.rent)}/month — call them now` : "" }, ...feed];
    if (i + 1 >= homes.length) {
      const l = next.filter((f) => f.kind === "liked").length;
      next.unshift({ kind: "done", text: `${first} finished your list`, sub: `♥ ${l} liked · ✕ ${homes.length - l} skipped` });
    }
    setFeed(next);
    setI((x) => x + 1);
  };

  return (
    <Sheet title="How your client sees it" onClose={onClose}>
      <style>{CSS}</style>
      <div className="pz-pad">
        <p className="pz-meta" style={{ margin: "0 0 12px" }}>This is a preview — nothing is sent. Swipe for {first} and watch what you’d be told.</p>
        <div className="dlp-phone">
          <div className="dlp-head">
            <b>{me?.partner?.name || "You"}</b>
            <span>picked {homes.length} homes for {first}</span>
          </div>
          {h ? (
            <div className="dlp-card">
              <div className="dlp-img"><SmartListingImage listing={h} /></div>
              <div className="dlp-body">
                <b>{inr(h.rent)} <small>/ month</small></b>
                <span><MapPin size={12} /> {bhkLabel(h)} · {h.area}</span>
              </div>
              <div className="dlp-acts">
                <button type="button" className="no" aria-label="Skip" onClick={() => act("skipped")}><X size={22} /></button>
                <span>{i + 1} / {homes.length}</span>
                <button type="button" className="yes" aria-label="Like" onClick={() => act("liked")}><Heart size={22} fill="currentColor" /></button>
              </div>
            </div>
          ) : (
            <div className="dlp-done"><Heart size={26} fill="#E11D48" color="#E11D48" /><b>{first} liked {liked} home{liked === 1 ? "" : "s"}</b><span>and you know exactly which ones.</span></div>
          )}
        </div>

        <span className="pz-label" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}><Bell size={14} /> What you’d get</span>
        <div className="dlp-feed">
          {feed.map((f, k) => (
            <div key={k} className={`dlp-n ${f.kind}`}>
              {f.kind === "liked" ? <Heart size={14} fill="#E11D48" color="#E11D48" /> : f.kind === "skipped" ? <X size={14} /> : <Sparkles size={14} />}
              <span><b>{f.text}</b>{f.sub && <small>{f.sub}</small>}</span>
            </div>
          ))}
        </div>
        <button type="button" className="pz-btn pz-btn--gold pz-btn--block" style={{ marginTop: 14 }} onClick={() => { onClose(); navigate(pp("/premium")); }}>
          <Crown size={18} /> Join Premium to send it for real
        </button>
      </div>
    </Sheet>
  );
}

export default function AiMatcher() {
  const navigate = useNavigate();
  const { me, demo } = usePartner();
  const [seed, setSeed] = useState(0);
  const [running, setRunning] = useState(true);
  const [tab, setTab] = useState("fresh");
  const { fresh, existing, needs, homes, loaded, md } = useMatcherRows(seed);
  const rerun = () => { if (demo) setSeed((x) => x + 1); setRunning(true); window.scrollTo(0, 0); };
  const [busy, setBusy] = useState("");
  const [share, setShare] = useState(null);
  const scanned = fresh.length + existing.length;

  const send = async (r) => {

    setBusy(r.lead.key);
    try {
      const list = await sendCuratedTo(r.lead, r.picks.map((m) => m.listing.property_id));
      setShare({ lead: r.lead, list });
      md.reload();
    } catch (e) {
      toast(friendlyError(e, "Could not make the list."), "error");
    } finally {
      setBusy("");
    }
  };

  const freshRow = (r, i) => (
    <div key={`${r.lead.key}-${seed}`} className="aim-row" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
      <div className="pz-row" style={{ alignItems: "flex-start" }}>
        <Avatar name={r.lead.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 15.5 }}>
            {r.lead.name}{r.lead.kind === "moveazy" && <MzBadge />}
            {r.lead.demo && <span className="pz-pill pz-pill--grey" style={{ marginLeft: 6, fontSize: 10.5 }}>Sample</span>}
          </strong>
          <span className="pz-meta">{[requirementLine(r.lead), (r.lead.localities ?? []).join(", ")].filter(Boolean).join(" · ") || "No requirement from MovEazy yet"}</span>
        </div>
        <span className="aim-count">{r.total}<small>matches</small></span>
      </div>
      {r.picks.length > 0 && (
        <div className="aim-thumbs">
          {r.picks.slice(0, 5).map((m) => <div key={m.listing.property_id} className="aim-th"><SmartListingImage listing={m.listing} thumb /><i>{m.score}</i></div>)}
          {r.picks.length > 5 && <div className="aim-more">+{r.picks.length - 5}</div>}
        </div>
      )}
      {r.near > 0 && <p className="aim-last">{r.near} of these {r.near === 1 ? "is a near match" : "are near matches"} — their area or BHK, a little off on the rest.</p>}
      <div className="pz-actions" style={{ gridTemplateColumns: "1fr auto" }}>
        <button type="button" className="pz-btn pz-btn--ai" disabled={!r.picks.length || busy === r.lead.key} onClick={() => send(r)}>
          <Sparkles size={16} /> {busy === r.lead.key ? "Making the list…" : r.picks.length ? `Send shortlist · ${r.picks.length}` : "No matches yet"}
        </button>
        <button type="button" className="pz-btn"
          onClick={() => navigate(pp(r.lead.kind === "moveazy" ? `/ai-matcher/${keyToSlug(r.lead.key)}` : `/leads/${r.lead.id}/matches`))}>
          Review
        </button>
      </div>
    </div>
  );

  const existingRow = (r, i) => {
    const last = r.lists[0];
    const liked = likedFlats(r.lists).length;
    const visits = md.visits.filter((v) => (r.lead.kind === "moveazy" ? v.assignment_id === r.lead.assignment_id : v.lead_id === r.lead.lead_id)).length;
    return (
      <Link key={r.lead.key} to={pp(`/ai-matcher/${keyToSlug(r.lead.key)}`)} className="aim-row aim-ex"
        style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
        <Avatar name={r.lead.name} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 15.5 }}>{r.lead.name}{r.lead.kind === "moveazy" && <MzBadge />}</strong>
          <span className="pz-meta" style={{ display: "block" }}>
            {r.lists.length} list{r.lists.length === 1 ? "" : "s"} · last {new Date(last.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {last.open_count ? "" : " · not opened yet"}
          </span>
          <span className="aim-ex-stats">
            <span className={liked ? "on" : ""}><Heart size={13} fill={liked ? "currentColor" : "none"} /> {liked} liked</span>
            {visits > 0 && <span className="on"><CalendarClock size={13} /> {visits} visit{visits === 1 ? "" : "s"}</span>}
            <span>{r.picks.length ? `${r.picks.length} new to send` : "nothing new right now"}</span>
          </span>
        </span>
        <ChevronRight size={18} color="var(--dim)" />
      </Link>
    );
  };

  return (
    <>
      <TopBar title="AI Property Matcher" back />
      <style>{CSS}</style>
      <div className="pz-pad">
        {demo && <DemoBanner>Send your own flats and MovEazy’s to every tenant. Other brokers’ flats come with Premium.</DemoBanner>}
        <div className="aim-hero">
          <span className="aim-ic sm"><WandSparkles size={18} /></span>
          <div>
            <b>{homes.toLocaleString("en-IN")} homes scanned for {scanned} tenant{scanned === 1 ? "" : "s"}</b>
            <span>The best {TOP} for each, ranked on budget, area, BHK and furnishing — never a flat they’ve already seen or turned down. They swipe, you see every like.</span>
          </div>
        </div>

        <div className="aim-tabs" role="tablist">
          {[["fresh", "Fresh leads", fresh.length], ["existing", "Existing leads", existing.length]].map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label} <span>{n}</span>
            </button>
          ))}
        </div>

        {!loaded ? <Loading label="Matching…" /> : running && fresh.length + existing.length > 0 ? (
          <MatcherRun clients={fresh.length + existing.length} homes={homes} onDone={() => setRunning(false)} />
        ) : tab === "fresh" ? (
          fresh.length === 0 ? (
            <Empty action={<Link className="pz-btn pz-btn--primary" to={pp("/leads/new")}>Add a client</Link>}>
              {existing.length ? "Everyone has had a list — open Existing leads to send more." : "Add a client with a budget, area or BHK and the matcher builds their shortlist."}
            </Empty>
          ) : fresh.map(freshRow)
        ) : existing.length === 0 ? (
          <Empty>No lists sent yet. Send one from Fresh leads — the tenant then shows up here, with every like.</Empty>
        ) : existing.map(existingRow)}

        {!running && tab === "fresh" && fresh.length > 0 && (
          <button type="button" className="pz-btn pz-btn--ai pz-btn--block" style={{ marginTop: 4 }} onClick={rerun}>
            <RefreshCw size={16} /> Run AI matcher again
          </button>
        )}

        {tab === "fresh" && needs.length > 0 && (
          <div className="pz-section" style={{ marginTop: 12 }}>
            <h2>Need a requirement ({needs.length})</h2>
            {needs.slice(0, 8).map((l) => (
              <Link key={l.id} to={pp(`/leads/${l.id}/edit`)} className="pz-row" style={{ padding: "8px 0", color: "inherit", textDecoration: "none" }}>
                <Avatar name={l.name} /><span style={{ flex: 1 }}>{l.name}</span><span className="pz-btn pz-btn--sm">Add</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {share && <ShareListSheet lead={share.lead} list={share.list} brokerName={me?.partner?.name} onClose={() => setShare(null)} />}
    </>
  );
}

/** After sending: the link, on WhatsApp or anywhere. */
export function ShareListSheet({ lead, list, brokerName, onClose }) {
  return (
    <Sheet title={`Send to ${lead.no_name ? "your client" : String(lead.name || "your client").split(" ")[0]}`} onClose={onClose}>
      <div className="pz-pad">
        <p className="pz-meta" style={{ margin: "0 0 14px" }}>{list.count} homes. You’ll hear when they open it, every like, and a summary when they finish.</p>
        <ShareOptions url={curatedUrl(list.token)} phone={lead.phone}
          message={curatedMessage(list.token, { leadName: lead.no_name ? "" : lead.name, count: list.count, brokerName })}
          post={`${list.count} verified rental homes picked for you — swipe and tap ♥ on the ones you like.`} />
      </div>
    </Sheet>
  );
}

export const MATCHER_CSS = () => CSS;

const CSS = `
.aim-card { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px; border-radius: 18px; cursor: pointer;
  font: inherit; color: #fff; border: 1px solid rgba(212,164,55,.35); position: relative; overflow: hidden;
  background: radial-gradient(130% 160% at 0% 0%, #235C49 0%, #14372B 38%, #0E0D12 78%); box-shadow: 0 12px 28px rgba(14,13,18,.28); }
.aim-card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(240,207,124,.16) 50%, transparent 65%); transform: translateX(-100%); animation: aimshine 5s ease-in-out infinite; }
@keyframes aimshine { 55%, 100% { transform: translateX(100%); } }
.aim-ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; flex: none; color: #1F1605; background: var(--goldg); box-shadow: 0 6px 16px rgba(212,164,55,.35); }
.aim-ic.sm { width: 36px; height: 36px; border-radius: 11px; }
.aim-txt { flex: 1; min-width: 0; }
.aim-txt small { display: block; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--gold); }
.aim-txt b { display: block; font-size: 15px; letter-spacing: -0.01em; margin-top: 2px; }
.aim-txt span { display: block; font-size: 12.5px; color: rgba(255,255,255,.7); margin-top: 2px; }
.aim-go { color: var(--gold); flex: none; }
.aim-bar { width: 100%; display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 12px; border-radius: 12px; cursor: pointer; font: inherit;
  color: #fff; border: 1px solid rgba(212,164,55,.4); background: linear-gradient(90deg, #1C4F3E, #14372B 60%, #1C1A24); animation: aimin .2s ease; }
.aim-bar svg:first-child { color: var(--gold); }
.aim-bar b { font-size: 13.5px; }
.aim-bar span { flex: 1; text-align: right; font-size: 12px; color: var(--gold); font-weight: 700; }
@keyframes aimin { from { opacity: 0; transform: translateY(-6px); } }
.aim-hero { display: flex; gap: 12px; padding: 14px; border-radius: 16px; margin-bottom: 12px; color: #fff;
  background: radial-gradient(130% 160% at 0% 0%, #235C49 0%, #14372B 40%, #0E0D12 85%); border: 1px solid rgba(212,164,55,.3); }
.aim-hero b { display: block; font-size: 15px; }
.aim-hero span { display: block; font-size: 13px; color: rgba(255,255,255,.72); margin-top: 3px; line-height: 1.45; }
.aim-row { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px; margin-bottom: 10px; animation: amrin .35s ease both; }
@keyframes amrin { from { opacity: 0; transform: translateY(10px); } }
.amr { display: grid; justify-items: center; gap: 12px; padding: 26px 18px; border-radius: 18px; color: #fff; text-align: center;
  background: radial-gradient(130% 160% at 50% 0%, #235C49 0%, #14372B 40%, #0E0D12 85%); border: 1px solid rgba(212,164,55,.3); }
.amr-orb { width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; color: #1F1605; background: var(--goldg);
  box-shadow: 0 0 0 0 rgba(212,164,55,.5); animation: amrpulse 1.4s ease-out infinite; }
@keyframes amrpulse { 70% { box-shadow: 0 0 0 16px rgba(212,164,55,0); } 100% { box-shadow: 0 0 0 0 rgba(212,164,55,0); } }
.amr b { font-size: 16px; }
.amr-bar { width: 100%; height: 6px; border-radius: 99px; background: rgba(255,255,255,.12); overflow: hidden; }
.amr-bar i { display: block; height: 100%; background: var(--goldg); border-radius: 99px; transition: width .45s ease; }
.amr ul { list-style: none; margin: 0; padding: 0; width: 100%; display: grid; gap: 8px; text-align: left; }
.amr li { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: rgba(255,255,255,.45); transition: color .2s; }
.amr li.now { color: #fff; font-weight: 700; }
.amr li.ok { color: rgba(255,255,255,.8); }
.amr li > span { width: 20px; height: 20px; border-radius: 99px; display: grid; place-items: center; flex: none; border: 1.5px solid rgba(255,255,255,.25); }
.amr li.ok > span { background: var(--gold); border-color: var(--gold); color: #1F1605; }
.amr-spin { width: 12px; height: 12px; border-radius: 99px; border: 2px solid rgba(255,255,255,.25); border-top-color: var(--gold); animation: amrspin .7s linear infinite; }
@keyframes amrspin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .amr-orb, .aim-row { animation: none; } }
.aim-count { display: grid; justify-items: center; font-size: 18px; font-weight: 800; color: var(--ai2); line-height: 1; }
.aim-count small { font-size: 10.5px; font-weight: 600; color: var(--dim); margin-top: 3px; }
.aim-thumbs { display: flex; gap: 6px; margin-top: 10px; }
.aim-th { position: relative; width: 54px; height: 54px; border-radius: 10px; overflow: hidden; background: #E9E6DF; flex: none; }
.aim-th img, .aim-th video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.aim-th i { position: absolute; right: 3px; bottom: 3px; font-style: normal; font-size: 10px; font-weight: 800; color: #1F1605; background: var(--gold); border-radius: 6px; padding: 1px 4px; }
.aim-more { width: 54px; height: 54px; border-radius: 10px; display: grid; place-items: center; background: var(--ail); color: var(--ai2); font-weight: 800; font-size: 13px; }
.aim-last { margin: 8px 0 0; font-size: 12.5px; color: var(--dim); }
.aim-last a { color: var(--ai2); font-weight: 700; }
.dlp-phone { border-radius: 22px; padding: 10px; background: var(--noir); box-shadow: 0 14px 30px rgba(14,13,18,.25); }
.dlp-head { color: #fff; padding: 4px 6px 10px; }
.dlp-head b { display: block; font-size: 14px; }
.dlp-head span { font-size: 12px; color: var(--gold); }
.dlp-card { background: #fff; border-radius: 16px; overflow: hidden; }
.dlp-img { height: 170px; background: #E9E6DF; overflow: hidden; }
.dlp-img img, .dlp-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.dlp-body { padding: 10px 12px 4px; }
.dlp-body b { display: block; font-size: 19px; }
.dlp-body b small { font-size: 12px; color: var(--dim); font-weight: 600; }
.dlp-body span { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; margin-top: 2px; }
.dlp-acts { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 12px; }
.dlp-acts span { font-size: 12px; color: var(--dim); font-weight: 700; }
.dlp-acts button { width: 52px; height: 52px; border-radius: 99px; border: 0; display: grid; place-items: center; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,.15); }
.dlp-acts .no { background: #fff; color: #E11D48; border: 1px solid var(--line); }
.dlp-acts .yes { background: linear-gradient(135deg, #16A34A, #0B6E4F); color: #fff; }
.dlp-done { background: #fff; border-radius: 16px; padding: 28px 16px; display: grid; justify-items: center; gap: 6px; text-align: center; }
.dlp-done span { font-size: 13px; color: var(--dim); }
.dlp-feed { display: grid; gap: 6px; max-height: 220px; overflow: auto; }
.dlp-n { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; background: #fff; border: 1px solid var(--line); animation: aimin .25s ease; }
.dlp-n.liked { background: #FFF1F3; border-color: #FBCFD8; }
.dlp-n.done, .dlp-n.opened { background: var(--ail); border-color: #CFE3D8; color: var(--ai2); }
.dlp-n b { display: block; font-size: 13.5px; color: var(--ink); }
.dlp-n small { display: block; font-size: 12px; color: var(--dim); margin-top: 1px; }
.aim-mz { display: inline-flex; align-items: center; vertical-align: middle; margin-left: 6px; padding: 3px 7px; border-radius: 99px; background: #0B0B0F; }
.aim-mz img { height: 10px; width: auto; display: block; }
.aim-tabs { display: flex; gap: 4px; padding: 4px; margin: 0 0 12px; border-radius: 12px; background: var(--bg); border: 1px solid var(--line); }
.aim-tabs button { flex: 1; padding: 9px 6px; border: 0; border-radius: 9px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer;
  background: transparent; color: var(--dim); }
.aim-tabs button span { display: inline-block; min-width: 20px; margin-left: 4px; padding: 1px 6px; border-radius: 99px; font-size: 12px; background: var(--line); color: var(--ink); }
.aim-tabs button.on { background: #C62828; color: #fff; box-shadow: 0 0 0 2px var(--gold); }
.aim-tabs button.on span { background: #fff; color: #C62828; }
.aim-ex { display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.aim-ex-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; font-size: 12.5px; color: var(--dim); }
.aim-ex-stats > span { display: inline-flex; align-items: center; gap: 4px; }
.aim-ex-stats .on { color: #E11D48; font-weight: 700; }
`;
