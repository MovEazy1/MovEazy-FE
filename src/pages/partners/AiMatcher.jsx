/**
 * AI Property Matcher — every home the broker can see, matched against every
 * client at once. Each client gets a ready shortlist (the best ten); one tap
 * turns it into a curated list and sends it (lib/partnerCurated.js).
 *
 * It is the headline feature, so it works without a plan too: in demo mode the
 * sample clients (and the partner's own) are matched against what they can
 * see, and "Send shortlist" opens a live preview of the client's swipe screen —
 * with the notifications the broker would get — instead of sending.
 *
 * The card sits on top of the home screen and shrinks to a slim sticky bar
 * under the header once it scrolls away (InventoryHome).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, Crown, Heart, MapPin, Sparkles, WandSparkles, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, Sheet, TopBar, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import ShareOptions from "./ShareOptions";
import { requirementLine } from "./leadBits";
import { DEMO_LEADS, DemoBanner, demoRows } from "./demoMode";
import { bhkLabel, friendlyError, inr, pp } from "../../lib/partners";
import { hasRequirement, matchesForLead } from "../../lib/partnerMatch";
import { createCuratedList, curatedMessage, curatedUrl, fetchMyCuratedLists } from "../../lib/partnerCurated";

const TOP = 10;

/** What the matcher can pick from: the partner's inventory, plus the sample network and groups in demo mode. */
export function useMatchPool() {
  const { inventory, demo } = usePartner();
  return useMemo(() => {
    const base = inventory ?? [];
    if (!demo) return base;
    const d = demoRows(base);
    return [...base, ...d.broker, ...d.group];
  }, [inventory, demo]);
}

/** Every active client with a requirement, and their best matches. */
function useShortlists() {
  const { leads, demo } = usePartner();
  const pool = useMatchPool();
  return useMemo(() => {
    const clients = demo ? [...leads, ...DEMO_LEADS] : leads;
    const active = clients.filter((l) => l.status !== "closed");
    const ready = active.filter(hasRequirement).map((lead) => {
      const matches = matchesForLead(lead, pool);
      return { lead, matches, top: matches.slice(0, TOP) };
    }).sort((a, b) => b.top.length - a.top.length);
    return { ready, needs: active.filter((l) => !hasRequirement(l)), homes: pool.length };
  }, [leads, pool, demo]);
}

/** The card on the home screen; `compact` is the slim sticky bar it becomes on scroll. */
export function AiMatcherCard({ compact = false }) {
  const navigate = useNavigate();
  const { ready, homes } = useShortlists();
  const matched = ready.filter((r) => r.top.length).length;
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

        <span className="pz-label" style={{ marginTop: 14 }}><Bell size={14} style={{ verticalAlign: -2 }} /> What you’d get</span>
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
  const { me, inventory, demo } = usePartner();
  const { ready, needs, homes } = useShortlists();
  const [sent, setSent] = useState({}); // lead id → latest list
  const [busy, setBusy] = useState("");
  const [share, setShare] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (demo) return;
    fetchMyCuratedLists().then((lists) => {
      const by = {};
      for (const l of lists) if (l.lead_id && !by[l.lead_id]) by[l.lead_id] = l;
      setSent(by);
    }, () => {});
  }, [demo]);

  const send = async (r) => {
    if (demo || r.lead.demo) { setPreview(r); return; }
    setBusy(r.lead.id);
    try {
      const list = await createCuratedList(r.lead.id, r.top.map((m) => m.listing.property_id));
      setSent((s) => ({ ...s, [r.lead.id]: { ...list, created_at: new Date().toISOString(), open_count: 0, actions: {} } }));
      setShare({ lead: r.lead, list });
    } catch (e) {
      toast(friendlyError(e, "Could not make the list."), "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <TopBar title="AI Property Matcher" back />
      <style>{CSS}</style>
      <div className="pz-pad">
        {demo && <DemoBanner>Sample clients and homes — try it, then send for real with Premium.</DemoBanner>}
        <div className="aim-hero">
          <span className="aim-ic sm"><WandSparkles size={18} /></span>
          <div>
            <b>{homes.toLocaleString("en-IN")} homes scanned for {ready.length} client{ready.length === 1 ? "" : "s"}</b>
            <span>The best {TOP} for each, ranked on budget, area, BHK and furnishing. Send each client their own list — they swipe, you see every like and skip.</span>
          </div>
        </div>

        {!inventory ? <Loading label="Matching…" /> : ready.length === 0 ? (
          <Empty action={<Link className="pz-btn pz-btn--primary" to={pp("/leads/new")}>Add a client</Link>}>
            Add a client with a budget, area or BHK and the matcher builds their shortlist.
          </Empty>
        ) : ready.map((r) => {
          const last = sent[r.lead.id];
          const liked = last ? Object.values(last.actions || {}).filter((a) => a.action === "liked").length : 0;
          return (
            <div key={r.lead.id} className="aim-row">
              <div className="pz-row" style={{ alignItems: "flex-start" }}>
                <Avatar name={r.lead.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 15.5 }}>{r.lead.name}{r.lead.demo && <span className="pz-pill pz-pill--grey" style={{ marginLeft: 6, fontSize: 10.5 }}>Sample</span>}</strong>
                  <span className="pz-meta">{[requirementLine(r.lead), (r.lead.localities ?? []).join(", ")].filter(Boolean).join(" · ")}</span>
                </div>
                <span className="aim-count">{r.matches.length}<small>matches</small></span>
              </div>
              {r.top.length > 0 && (
                <div className="aim-thumbs">
                  {r.top.slice(0, 5).map((m) => <div key={m.listing.property_id} className="aim-th"><SmartListingImage listing={m.listing} /><i>{m.score}</i></div>)}
                  {r.top.length > 5 && <div className="aim-more">+{r.top.length - 5}</div>}
                </div>
              )}
              {last && <p className="aim-last">Last list {new Date(last.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {last.open_count ? `opened · ${liked} liked` : "not opened yet"}{last.id && <Link to={pp(`/curated/${last.id}`)}> · see responses</Link>}</p>}
              <div className="pz-actions" style={{ gridTemplateColumns: "1fr auto" }}>
                <button type="button" className="pz-btn pz-btn--ai" disabled={!r.top.length || busy === r.lead.id} onClick={() => send(r)}>
                  <Sparkles size={16} /> {busy === r.lead.id ? "Making the list…" : r.top.length ? `Send shortlist · ${r.top.length}` : "No matches yet"}
                </button>
                <button type="button" className="pz-btn" onClick={() => navigate(pp(`/leads/${r.lead.id}/matches`))}>Review</button>
              </div>
            </div>
          );
        })}

        {needs.length > 0 && (
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

      {preview && <DemoListPreview lead={preview.lead} homes={preview.top.map((m) => m.listing)} onClose={() => setPreview(null)} />}
      {share && (
        <Sheet title={`Send to ${share.lead.no_name ? "your client" : share.lead.name.split(" ")[0]}`} onClose={() => setShare(null)}>
          <div className="pz-pad">
            <p className="pz-meta" style={{ margin: "0 0 14px" }}>{share.list.count} homes. You’ll hear when they open it, every like, and a summary when they finish.</p>
            <ShareOptions url={curatedUrl(share.list.token)} phone={share.lead.phone}
              message={curatedMessage(share.list.token, { leadName: share.lead.no_name ? "" : share.lead.name, count: share.list.count, brokerName: me?.partner?.name })}
              post={`${share.list.count} verified rental homes picked for you — swipe and tap ♥ on the ones you like.`} />
          </div>
        </Sheet>
      )}
    </>
  );
}

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
.aim-row { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px; margin-bottom: 10px; }
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
`;
