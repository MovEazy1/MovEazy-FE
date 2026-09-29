/**
 * AI Property Matcher — every home the broker can see, matched against every
 * client at once. Each client gets a ready shortlist (the best ten); one tap
 * turns it into a curated list and sends it (lib/partnerCurated.js). The card
 * sits on top of the home screen.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Sparkles, WandSparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar, Empty, Loading, Sheet, TopBar, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import ShareOptions from "./ShareOptions";
import { requirementLine } from "./leadBits";
import { DEMO_LEADS } from "./demoMode";
import { friendlyError, pp } from "../../lib/partners";
import { hasRequirement, matchesForLead } from "../../lib/partnerMatch";
import { createCuratedList, curatedMessage, curatedUrl, fetchMyCuratedLists } from "../../lib/partnerCurated";

const TOP = 10;

/** Every active client with a requirement, and their best matches. */
function useShortlists() {
  const { leads, inventory, demo } = usePartner();
  return useMemo(() => {
    const pool = demo ? [...leads, ...DEMO_LEADS] : leads;
    const active = pool.filter((l) => l.status !== "closed");
    const ready = active.filter(hasRequirement).map((lead) => {
      const matches = matchesForLead(lead, inventory ?? []);
      return { lead, matches, top: matches.slice(0, TOP) };
    }).sort((a, b) => b.top.length - a.top.length);
    return { ready, needs: active.filter((l) => !hasRequirement(l)), homes: (inventory ?? []).length };
  }, [leads, inventory, demo]);
}

export function AiMatcherCard() {
  const navigate = useNavigate();
  const { demo, explain } = usePartner();
  const { ready, homes } = useShortlists();
  const matched = ready.filter((r) => r.top.length).length;
  return (
    <button type="button" className="aim-card" onClick={() => (demo ? explain("ai_match") : navigate(pp("/ai-matcher")))}>
      <style>{CSS}</style>
      <span className="aim-ic"><WandSparkles size={22} /></span>
      <span className="aim-txt">
        <b>AI Property Matcher</b>
        <span>{ready.length ? `${matched} of ${ready.length} clients have a shortlist ready · ${homes.toLocaleString("en-IN")} homes scanned` : "Add a client's requirement and get a shortlist in seconds"}</span>
      </span>
      <ChevronRight size={20} />
    </button>
  );
}

export default function AiMatcher() {
  const navigate = useNavigate();
  const { me, inventory, demo, explain } = usePartner();
  const { ready, needs, homes } = useShortlists();
  const [sent, setSent] = useState({}); // lead id → latest list
  const [busy, setBusy] = useState("");
  const [share, setShare] = useState(null);

  useEffect(() => {
    if (demo) return;
    fetchMyCuratedLists().then((lists) => {
      const by = {};
      for (const l of lists) if (l.lead_id && !by[l.lead_id]) by[l.lead_id] = l;
      setSent(by);
    }, () => {});
  }, [demo]);

  const send = async (r) => {
    if (demo || r.lead.demo) { explain("curated"); return; }
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
        <div className="aim-hero">
          <Sparkles size={20} />
          <div>
            <b>{homes.toLocaleString("en-IN")} homes scanned for {ready.length} client{ready.length === 1 ? "" : "s"}</b>
            <span>The best {TOP} for each, ranked on budget, area, BHK and furnishing. Send each client their own list — they swipe, you see every like.</span>
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
                <button type="button" className="pz-btn" onClick={() => (r.lead.demo ? explain("ai_match") : navigate(pp(`/leads/${r.lead.id}/matches`)))}>Review</button>
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
.aim-card { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px; border-radius: 18px; border: 0; cursor: pointer;
  font: inherit; color: #fff; background: radial-gradient(120% 140% at 0% 0%, #8B6DFF, #5B3FE0 45%, #2B1B7A); box-shadow: 0 12px 28px rgba(75,48,201,.35); position: relative; overflow: hidden; }
.aim-card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.18) 50%, transparent 65%); transform: translateX(-100%); animation: aimshine 5s ease-in-out infinite; }
@keyframes aimshine { 55%, 100% { transform: translateX(100%); } }
.aim-ic { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; flex: none; background: rgba(255,255,255,.16); }
.aim-txt { flex: 1; min-width: 0; }
.aim-txt b { display: block; font-size: 16px; letter-spacing: -0.01em; }
.aim-txt span { display: block; font-size: 12.5px; opacity: .85; margin-top: 2px; }
.aim-hero { display: flex; gap: 12px; padding: 14px; border-radius: 16px; background: var(--ail); color: var(--ai2); margin-bottom: 12px; }
.aim-hero b { display: block; color: var(--ink); font-size: 15px; }
.aim-hero span { display: block; font-size: 13px; color: var(--dim); margin-top: 3px; line-height: 1.45; }
.aim-row { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px; margin-bottom: 10px; }
.aim-count { display: grid; justify-items: center; font-size: 18px; font-weight: 800; color: var(--ai2); line-height: 1; }
.aim-count small { font-size: 10.5px; font-weight: 600; color: var(--dim); margin-top: 3px; }
.aim-thumbs { display: flex; gap: 6px; margin-top: 10px; }
.aim-th { position: relative; width: 54px; height: 54px; border-radius: 10px; overflow: hidden; background: #E9E6DF; flex: none; }
.aim-th img, .aim-th video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.aim-th i { position: absolute; right: 3px; bottom: 3px; font-style: normal; font-size: 10px; font-weight: 800; color: #fff; background: var(--ai); border-radius: 6px; padding: 1px 4px; }
.aim-more { width: 54px; height: 54px; border-radius: 10px; display: grid; place-items: center; background: var(--ail); color: var(--ai2); font-weight: 800; font-size: 13px; }
.aim-last { margin: 8px 0 0; font-size: 12.5px; color: var(--dim); }
.aim-last a { color: var(--ai2); font-weight: 700; }
`;
