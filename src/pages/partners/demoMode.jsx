/**
 * Demo mode — a partner without a plan sees the whole app, on sample data.
 *
 * The tabs show what a plan unlocks (1000 MovEazy listings, 300 from the
 * broker network, 6 groups of 20), each with a handful of sample cards built
 * from real MovEazy photos. Every premium action opens an explainer — what the
 * button does, and Join Premium. The partner's own listings and leads are real
 * (adding them is free); sharing, AI curated lists, groups and MovEazy stock
 * are not. Staff never see demo mode.
 */
import { useNavigate } from "react-router-dom";
import { Crown, Sparkles, X } from "lucide-react";
import { pp } from "../../lib/partners";

export const DEMO_COUNTS = { moveazy: 1000, mine: 20, broker: 300, group: 120 };

const BROKERS = [
  ["Rohit Verma", "Verma Realty"], ["Meera Nair", "Nair Homes"], ["Karan Patel", "Patel Estates"],
  ["Divya Rao", "Rao Properties"], ["Arjun Shetty", "Shetty & Co"], ["Sana Khan", "Urban Nest"],
];
export const DEMO_GROUPS = [
  "HSR Brokers Association", "Koramangala Rentals", "Bellandur Network", "Whitefield Partners", "Sarjapur Road Brokers", "Indiranagar Circle",
].map((name, i) => ({ id: `demo-g${i + 1}`, name, member_count: [18, 12, 15, 9, 21, 11][i], property_count: 20, demo: true }));

export const DEMO_LEADS = [
  ["Anjali Sharma", "2 BHK", "HSR Layout", 35000, "family"], ["Rahul Menon", "1 BHK", "Koramangala", 25000, "bachelor"],
  ["Priya Iyer", "3 BHK", "Bellandur", 55000, "family"], ["Vikram Singh", "1 RK", "BTM Layout", 15000, "bachelor"],
  ["Neha Gupta", "2 BHK", "Sarjapur Road", 30000, "family"], ["Aditya Rao", "1 BHK", "Indiranagar", 32000, "bachelor"],
].map(([name, bhk, area, budget, household], i) => ({
  id: `demo-l${i + 1}`, demo: true, name, phone: "", status: "active", household, gender_pref: "",
  flat_types: [bhk], localities: [area], budget_min: Math.round(budget * 0.7), budget_max: budget, furnishing: "",
  notes: "", last_contacted_at: null,
}));

/** Sample rows for the demo tabs, from the MovEazy listings every partner can already see (photos, rent, area). */
export function demoRows(inventory = []) {
  const withPhotos = inventory.filter((l) => l.source === "moveazy" && (l.cover_image_url || (l.images ?? []).length));
  const pool = withPhotos.length ? withPhotos : inventory.filter((l) => l.source === "moveazy");
  if (!pool.length) return { moveazy: [], broker: [], group: [], mine: [] };
  const pick = (i) => pool[i % pool.length];
  const as = (kind, i, extra) => ({
    ...pick(i), property_id: `DEMO-${kind}-${i}`, demo: true, locked: false, status: "published", ...extra,
  });
  return {
    moveazy: [0, 1, 2, 3, 4, 5].map((i) => ({ ...pick(i), demo: true, locked: true })),
    broker: [6, 7, 8, 9, 10, 11].map((i, k) => as("B", i, {
      source: "broker", on_platform: true, group_ids: [], brokerage_pct: 50, lister_name: BROKERS[k][0], lister_agency: BROKERS[k][1], lister_phone: "",
    })),
    group: [12, 13, 14, 15, 16, 17].map((i, k) => as("G", i, {
      source: "broker", on_platform: false, group_ids: [DEMO_GROUPS[k].id], brokerage_pct: 50, lister_name: BROKERS[(k + 2) % 6][0],
      lister_agency: DEMO_GROUPS[k].name, lister_phone: "",
    })),
    mine: [18, 19, 20, 21, 22].map((i) => as("M", i, { source: "mine", lister_name: "You", group_ids: [], brokerage_pct: null })),
  };
}

/** What each premium button does — shown instead of doing it, in demo mode. */
export const EXPLAIN = {
  whatsapp: ["WhatsApp the lister", "Sends the listing broker a ready message asking if the flat is still available and for its exact location. One tap, nothing to type."],
  details: ["Full details & owner contact", "Opens the exact address, the map pin, every photo and the owner or point-of-contact number, so you can close the deal yourself."],
  moveazy: ["1000+ MovEazy listings", "MovEazy's own inventory, verified and updated daily, with owner contacts. You keep your share of the brokerage on every one you close."],
  broker: ["The broker network", "300+ listings other partner brokers share with everyone, with the brokerage they offer shown upfront."],
  group: ["Your association groups", "Private inventory shared only inside your groups. Invite your association on WhatsApp; leaving a group takes its listings away."],
  save: ["Save for later", "Keep a shortlist of flats to send your clients."],
  share: ["Share with your network", "Put your listing in front of every MovEazy broker or just your groups, at the brokerage share you choose."],
  ai_match: ["AI matching", "Ranks every flat you can see against this tenant's needs, then builds a curated list you send on WhatsApp in one tap."],
  curated: ["Curated list for your tenant", "Your tenant swipes through your picks on their phone. You see what they liked, and get a notification the moment they like a home."],
  lead_whatsapp: ["Message your tenant", "Opens WhatsApp with your tenant and logs when you last contacted them."],
  create_group: ["Create a group", "Start a private group for your association and invite brokers with a WhatsApp link."],
  sold_out: ["Mark sold out", "Tell your group a flat is taken. MovEazy and the listing broker are notified, so nobody wastes a call."],
};

export function PremiumExplainer({ what, onClose }) {
  const navigate = useNavigate();
  if (!what) return null;
  const [title, body] = EXPLAIN[what] || ["A Premium feature", "Join Premium to use every feature of MovEazy Partners."];
  return (
    <div className="dm-scrim" role="presentation" onClick={onClose}>
      <style>{CSS}</style>
      <div className="dm-pop" role="dialog" aria-modal="true" aria-labelledby="dm-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dm-x" aria-label="Close" onClick={onClose}><X size={20} /></button>
        <span className="dm-ic"><Sparkles size={24} /></span>
        <span className="dm-kicker"><Crown size={13} /> Premium</span>
        <h2 id="dm-title">{title}</h2>
        <p>{body}</p>
        <button type="button" className="dm-go" onClick={() => { onClose(); navigate(pp("/premium")); }}>
          <Crown size={18} /> Join Premium
        </button>
        <button type="button" className="dm-later" onClick={onClose}>Keep exploring</button>
      </div>
    </div>
  );
}

/** The sticky, centred Join Premium button above the bottom nav. */
export function JoinPremiumBar() {
  const navigate = useNavigate();
  return (
    <div className="dm-bar">
      <style>{CSS}</style>
      <button type="button" onClick={() => navigate(pp("/premium"))}><Crown size={17} /> Join Premium</button>
    </div>
  );
}

/** "You're exploring the demo" — top of the demo screens. */
export function DemoBanner({ children = "You're exploring sample data." }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="dm-banner" onClick={() => navigate(pp("/premium"))}>
      <style>{CSS}</style>
      <Sparkles size={16} /> <span>{children} <b>Join Premium</b> to unlock the real inventory.</span>
    </button>
  );
}

const CSS = `
.dm-scrim { position: fixed; inset: 0; z-index: 70; background: rgba(3,20,14,.5); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
  display: flex; align-items: flex-end; justify-content: center; animation: dmfade .18s ease; }
@keyframes dmfade { from { opacity: 0; } }
@keyframes dmup { from { transform: translateY(30px); opacity: 0; } }
.dm-pop { position: relative; width: min(520px, 100%); background: radial-gradient(120% 90% at 0% 0%, #145C43, #0A3A2A 55%, #05241A); color: #fff;
  border-radius: 26px 26px 0 0; padding: 28px 22px calc(20px + env(safe-area-inset-bottom)); text-align: center; animation: dmup .24s ease; }
.dm-x { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border-radius: 99px; border: 0; background: rgba(255,255,255,.1); color: #fff; display: grid; place-items: center; cursor: pointer; }
.dm-ic { width: 58px; height: 58px; border-radius: 18px; margin: 0 auto 12px; display: grid; place-items: center; color: #1F1605;
  background: linear-gradient(135deg, #F7E9C6, #E4B659); box-shadow: 0 10px 26px rgba(228,182,89,.35); }
.dm-kicker { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #E4B659; }
.dm-pop h2 { margin: 6px 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
.dm-pop p { margin: 0 auto 18px; max-width: 400px; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,.82); }
.dm-go { width: 100%; min-height: 52px; border: 0; border-radius: 14px; font: inherit; font-size: 16px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px; color: #1F1605; background: linear-gradient(180deg, #F2CD7A, #E4B659); }
.dm-later { margin-top: 8px; width: 100%; min-height: 44px; border: 0; background: none; color: rgba(255,255,255,.75); font: inherit; font-weight: 700; cursor: pointer; }
.dm-bar { position: fixed; left: 0; right: 0; bottom: calc(70px + env(safe-area-inset-bottom)); z-index: 30; display: flex; justify-content: center; pointer-events: none; }
.dm-bar button { pointer-events: auto; display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 22px; border-radius: 99px; border: 0; cursor: pointer;
  font: inherit; font-size: 15px; font-weight: 800; color: #1F1605; background: linear-gradient(180deg, #F2CD7A, #E4B659);
  box-shadow: 0 12px 28px rgba(138,100,25,.35), 0 0 0 4px rgba(255,255,255,.9); animation: dmglow 2.8s ease-in-out infinite; }
@keyframes dmglow { 50% { box-shadow: 0 12px 34px rgba(228,182,89,.55), 0 0 0 4px rgba(255,255,255,.9); } }
.dm-banner { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 11px 14px; margin-bottom: 12px; border-radius: 12px; cursor: pointer;
  border: 1px solid #F1DCA7; background: linear-gradient(135deg, #FFFBEB, #FFF3D6); color: #6B4E14; font: inherit; font-size: 13.5px; }
.dm-banner b { color: #8A6419; }
@media (prefers-reduced-motion: reduce) { .dm-bar button { animation: none; } }
`;
