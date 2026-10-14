/**
 * Home (the Square Connect-style dashboard): the partner's card — name, areas,
 * plan, rating, profile strength — then every part of the app as a 3×3 grid
 * of tiles with live counts, today's visits and follow-ups, more ways to grow,
 * and the AI matcher and lifetime-commission banners. The inventory itself is
 * its own tab now (InventoryHome.jsx).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Bookmark, Building2, ChevronRight, Crown, Home, Infinity as InfinityIcon, MessageCircle, QrCode, Star, Target,
  UserRound, Wallet, WandSparkles } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Avatar } from "./partnerUi";
import { PartnerHeader } from "./PartnerChrome";
import { CompleteProfileSheet } from "./PremiumJourney";
import { PaymentCheckBanner, TrialBanner } from "./TrialPremium";
import { InstallBanner } from "./InstallApp";
import NewLeadCard from "./NewLeadCard";
import { TodayPanel } from "./TenantKit";
import { useTenants } from "./tenantData";
import { useMatcherRows } from "./AiMatcher";
import { DEMO_COUNTS } from "./demoMode";
import { hasRequirement } from "../../lib/partnerMatch";
import { fetchLeadStats } from "../../lib/partnerLeads";
import { fetchMyRating, fetchMyStorefront } from "../../lib/storefront";
import { stageCounts } from "../../lib/partnerTenants";
import { pp } from "../../lib/partners";

const shortDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
const n = (v) => Number(v || 0).toLocaleString("en-IN");
const plural = (k, one, many = `${one}s`) => `${n(k)} ${Number(k) === 1 ? one : many}`;
const seenMoveazy = (id) => { try { return localStorage.getItem(`pz-mzleads-seen:${id}`) === "1"; } catch { return true; } };

/** Profile strength: name, mobile, areas, RERA (the completed profile) and a photo — a fifth each. */
export function profileStrength(partner, status, photoUrl) {
  const parts = [
    Boolean(String(partner?.name || "").trim()),
    Boolean(String(partner?.phone || "").trim()),
    (partner?.operational_areas ?? []).length > 0,
    Boolean(status?.profile?.completed_at),
    Boolean(photoUrl),
  ];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}

function Tile({ to, onClick, icon, tone = "", title, sub, badge }) {
  const inner = (
    <>
      {badge && <span className="ph-badge">{badge}</span>}
      <span className={`ph-ic${tone ? ` ph-ic--${tone}` : ""}`}>{icon}</span>
      <b>{title}</b>
      <span className="ph-sub">{sub}</span>
    </>
  );
  return onClick
    ? <button type="button" className="ph-tile" onClick={onClick}>{inner}</button>
    : <Link to={to} className="ph-tile">{inner}</Link>;
}

/** The dark AI matcher banner: how many clients have a shortlist waiting. */
function AiBanner() {
  const { rows } = useMatcherRows(0);
  const ready = rows.filter((r) => hasRequirement(r.lead));
  const waiting = ready.filter((r) => r.picks.length && !r.lists.length).length;
  return (
    <Link to={pp("/ai-matcher")} className="ph-ai">
      <span className="ph-ai-ic" aria-hidden><WandSparkles size={26} /></span>
      <small>AI PROPERTY MATCHER</small>
      <b>10 best flats for every client, ready to send</b>
      <span className="ph-ai-line">
        {waiting ? `${plural(waiting, "client has", "clients have")} a fresh shortlist waiting` : ready.length ? "Every client's shortlist, one tap away" : "Add a client with their budget and area to start"}
      </span>
      <span className="ph-ai-cta">{waiting ? "Review shortlists" : "Open the matcher"}</span>
    </Link>
  );
}

export default function PartnerHome() {
  const navigate = useNavigate();
  const { me, inventory, groups, saved, status, reloadStatus, demo, explain } = usePartner();
  const { board } = useTenants();
  const p = me?.partner ?? {};
  const [rating, setRating] = useState(null);
  const [leadTotal, setLeadTotal] = useState(null);
  const [sf, setSf] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMyRating().then((r) => alive && setRating(r?.rating ?? null), () => {});
    fetchLeadStats().then((s) => alive && setLeadTotal(s?.total ?? null), () => {});
    fetchMyStorefront().then((s) => alive && setSf(s), () => {});
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => stageCounts(board), [board]);
  const myLive = useMemo(() => (inventory ?? []).filter((l) => l.source === "mine" && l.status === "published").length, [inventory]);
  const flats = demo ? DEMO_COUNTS.moveazy + DEMO_COUNTS.broker + DEMO_COUNTS.group : (inventory ?? []).length;
  const strength = profileStrength(p, status, sf?.photo_url);
  const plan = status?.plan?.active ? { label: `Premium · till ${shortDate(status.plan.until)}`, on: true }
    : status?.trial?.active ? { label: `Trial · ${plural(status.trial.days_left, "day")} left`, on: true }
      : { label: "Free plan · Go Premium", on: false };
  const areas = (p.operational_areas ?? []).slice(0, 2).join(" · ");

  const improve = () => {
    if (!status?.profile?.completed_at) setProfileOpen(true);
    else if (!sf?.photo_url) navigate(pp("/qr"));
  };

  return (
    <>
      <style>{CSS}</style>
      <PartnerHeader />
      <div className="pz-pad ph">
        <PaymentCheckBanner payment={status?.payment} />
        <TrialBanner trial={status?.trial} />
        <NewLeadCard />
        <InstallBanner />

        <section className="ph-me" aria-label="Your profile">
          {Number(rating) > 0 && (
            <span className="ph-ribbon" aria-label={`Rated ${Number(rating).toFixed(1)}`}><Star size={13} fill="currentColor" />{Number(rating).toFixed(1)}</span>
          )}
          <div className="ph-me-top">
            <Avatar name={p.name || "You"} size="lg" />
            <span style={{ minWidth: 0 }}>
              <b className="ph-name">{p.name || "Partner"}</b>
              <span className="ph-areas">{areas || p.agency || "Add the areas you work in"}</span>
              <Link to={pp("/premium")} className={`ph-plan${plan.on ? "" : " ph-plan--off"}`}>{plan.label}</Link>
            </span>
          </div>
          <div className="ph-me-foot">
            <Link to={pp("/insights")} onClick={demo ? (e) => { e.preventDefault(); explain("insights"); } : undefined} className="ph-perf">
              <BarChart3 size={16} /> My performance
            </Link>
            <button type="button" className="ph-ring" onClick={improve} disabled={strength >= 100}
              aria-label={`Profile strength ${strength}%${strength < 100 ? ", tap to complete" : ""}`}>
              <span className="ph-ring-c" style={{ background: `conic-gradient(var(--g) 0 ${strength}%, #E7E4DD ${strength}% 100%)` }}>
                <span>{strength}%</span>
              </span>
              <span className="ph-ring-l">Profile<br />strength</span>
            </button>
          </div>
        </section>

        <nav className="ph-grid" aria-label="Everything in the app">
          <Tile to={pp("/inventory")} icon={<Building2 size={24} />} title="Inventory" sub={plural(flats, "flat")} />
          <Tile to={pp("/leads")} icon={<UserRound size={24} />} title="My Leads" sub={`${n(counts.open)} in play`} />
          <Tile to={pp("/leads?tab=moveazy")} icon={<Target size={24} />} tone="gold" title="MovEazy Leads"
            sub={leadTotal != null ? plural(leadTotal, "tenant") : "Tenants looking now"} badge={seenMoveazy(p.user_id) ? null : "NEW"} />
          <Tile to={pp("/ai-matcher")} icon={<WandSparkles size={24} />} tone="ai" title="AI Matcher" sub="Shortlist in seconds" />
          <Tile to={pp("/my-flats")} icon={<Home size={24} />} title="My Flats" sub={`${n(myLive)} live`} />
          <Tile to={pp("/groups")} icon={<MessageCircle size={24} />} title="Groups" sub={plural(groups.length, "broker group")} />
          <Tile to={pp("/qr")} icon={<QrCode size={24} />} tone="red" title="To-Let Poster"
            sub={sf ? `${plural(sf.scans_week, "scan")} this week` : "Your QR poster"} />
          <Tile to={pp("/referrals")} icon={<Wallet size={24} />} tone="gold" title="Refer & Earn" sub="Lifetime 10%" />
          <Tile to={pp("/premium")} icon={<Crown size={24} />} tone="gold" title="Premium"
            sub={status?.plan?.active ? `Till ${shortDate(status.plan.until)}` : status?.trial?.active ? `${plural(status.trial.days_left, "day")} of trial` : "Plans & benefits"} />
        </nav>

        <TodayPanel />

        <h2 className="ph-h">Grow your business</h2>
        <nav className="ph-grid ph-grid--grow" aria-label="Grow your business">
          <Tile to={pp("/insights")} onClick={demo ? () => explain("insights") : undefined} icon={<BarChart3 size={22} />} tone="soft" title="Leads dashboard" sub="Scans by area" />
          <Tile to={pp("/building-leads")} icon={<Building2 size={22} />} tone="soft" title="Building visits" sub="Owner flats for you" />
          <Tile to={pp("/saved")} icon={<Bookmark size={22} />} tone="soft" title="Saved flats" sub={`${n(saved.size)} saved`} />
        </nav>

        <AiBanner />

        <Link to={pp("/referrals")} className="ph-ref">
          <InfinityIcon size={26} color="#8A6419" />
          <span style={{ flex: 1 }}><b>Earn 10% for life</b><span>on every deal the partners you bring in close</span></span>
          <ChevronRight size={18} />
        </Link>
      </div>
      {profileOpen && <CompleteProfileSheet onClose={() => setProfileOpen(false)} onDone={reloadStatus} />}
    </>
  );
}

const CSS = `
.ph { display: flex; flex-direction: column; gap: 12px; padding-top: 14px; }
.ph-me { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 14px 14px;
  box-shadow: 0 2px 10px rgba(22,20,28,.05); }
.ph-ribbon { position: absolute; top: -1px; right: 16px; width: 54px; padding: 7px 0 13px; background: var(--gold); color: #1F1605;
  display: grid; justify-items: center; gap: 1px; font-weight: 800; font-size: 15px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%); }
.ph-me-top { display: flex; gap: 12px; align-items: center; padding-right: 62px; }
.ph-me-top .pz-avatar--lg { width: 58px; height: 58px; font-size: 20px; }
.ph-name { display: block; font-size: 18px; }
.ph-areas { display: block; font-size: 13px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ph-plan { display: inline-block; margin-top: 4px; padding: 2px 9px; border-radius: 999px; background: #F6E7BF; color: #7A5A12;
  font-size: 11.5px; font-weight: 800; text-decoration: none; }
.ph-plan--off { background: var(--noir); color: #F0CF7C; }
.ph-me-foot { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.ph-perf { flex: 1; height: 42px; border-radius: 999px; border: 1.5px solid var(--line); display: flex; align-items: center; justify-content: center;
  gap: 6px; font-size: 14px; font-weight: 800; color: var(--g); text-decoration: none; }
.ph-ring { display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 0; font: inherit; cursor: pointer; color: inherit; }
.ph-ring:disabled { cursor: default; }
.ph-ring-c { width: 46px; height: 46px; border-radius: 999px; display: grid; place-items: center; }
.ph-ring-c span { width: 36px; height: 36px; border-radius: 999px; background: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 800; }
.ph-ring-l { font-size: 12px; line-height: 1.3; color: var(--dim); text-align: left; }
.ph-grid { background: var(--card); border: 1px solid var(--line); border-radius: 18px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden; }
.ph-tile { position: relative; padding: 14px 6px 13px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
  text-decoration: none; color: var(--ink); background: none; border: 0; font: inherit; cursor: pointer;
  border-right: 1px solid #EFECE6; border-bottom: 1px solid #EFECE6; }
.ph-tile:nth-child(3n) { border-right: 0; }
.ph-tile:nth-last-child(-n+3) { border-bottom: 0; }
.ph-tile:active { background: var(--bg); }
.ph-tile b { font-size: 14.5px; line-height: 1.2; }
.ph-sub { font-size: 12px; color: var(--dim); line-height: 1.3; }
.ph-ic { width: 50px; height: 50px; border-radius: 999px; border: 1.5px solid var(--line); display: grid; place-items: center; color: var(--g); margin-bottom: 2px; }
.ph-ic--gold { border-color: #F1D99B; background: #FEF7E6; color: #8A6419; }
.ph-ic--ai { border-color: #DCD5FF; background: #F3F0FF; color: #6B4EFF; }
.ph-ic--red { border-color: #F5C2C4; background: #FFF1F1; color: #E3141B; }
.ph-ic--soft { width: 46px; height: 46px; border: 0; background: var(--gl); }
.ph-badge { position: absolute; top: 8px; right: 10px; padding: 2px 6px; border-radius: 999px; background: #E3141B; color: #fff; font-size: 10px; font-weight: 800; }
.ph-h { margin: 6px 0 0; font-size: 19px; font-weight: 800; }
.ph .tk-today { margin: 0; }
.ph-ai { position: relative; display: block; border-radius: 20px; padding: 18px; background: var(--noir); color: #fff; text-decoration: none; overflow: hidden; }
.ph-ai-ic { position: absolute; right: 16px; top: 16px; width: 54px; height: 54px; border-radius: 999px; background: var(--noir3); display: grid;
  place-items: center; color: #C9BEFF; }
.ph-ai small { font-size: 12px; font-weight: 800; letter-spacing: .1em; color: #C9BEFF; }
.ph-ai b { display: block; margin-top: 6px; font-size: 21px; line-height: 1.22; padding-right: 64px; }
.ph-ai-line { display: block; margin-top: 8px; font-size: 13.5px; color: rgba(255,255,255,.72); }
.ph-ai-cta { display: inline-flex; margin-top: 12px; height: 38px; padding: 0 16px; border-radius: 999px; background: #fff; color: var(--noir);
  font-size: 14px; font-weight: 800; align-items: center; }
.ph-ref { display: flex; gap: 12px; align-items: center; border-radius: 18px; padding: 14px 16px; text-decoration: none; color: #1F1605;
  background: linear-gradient(160deg, #FFFBEB, #F7E9C6 60%, #EBC66E); border: 1px solid #E4B659; margin-bottom: 8px; }
.ph-ref b { display: block; font-size: 15.5px; }
.ph-ref span span { font-size: 13px; }
`;
