/**
 * Broker landing page — what a signed-out visitor sees at partners.moveazy.co.in
 * (and /partners). One job: get them to sign up. Signing up is Google, then
 * the app's own gate (mobile number, auto-approval) takes over.
 *
 * Screens first, few words. Every phone shows the real app's components over
 * MovEazy's real published inventory:
 *   - prices, shares and stats come from the CRM (useLandingSettings);
 *   - the matching demo runs the app's own matching engine, so counts are live;
 *   - features that aren't live yet (MovEazy clients) are marked "Coming soon";
 *   - no testimonials until there are real ones to show.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BadgeCheck, Building2, ChevronRight, Copy, IndianRupee, Phone, Plus, QrCode, Search, Share2, ShieldCheck, Sparkles, X, Zap,
} from "lucide-react";
import {
  AppLogo, Faq, LandingFooter, LandingNav, LandingStyles, PhoneFrame, Shot, SignupButton, Stepper, StickyCta, VideoButton, useInventory, useListingsWithPhotos,
} from "../landing/landingKit";
import { Avatar, Chip, PropertyCard, TopBar, WhatsAppIcon } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import { requirementLine } from "./leadBits";
import { matchesForLead } from "../../lib/partnerMatch";
import { customerMessage, displayLink } from "../../lib/partners";
import { brokerEarnings, inr } from "../../lib/landingCalc";
import { useLandingSettings } from "../../lib/landingSettings";

const AREAS = ["HSR Layout", "Koramangala", "Bellandur", "Whitefield", "Indiranagar", "Marathahalli"];
const BHKS = ["1 BHK", "2 BHK", "3 BHK"];
const BUDGETS = [20000, 30000, 40000, 60000, 80000];

const leadFor = (area, bhk, budget) => ({ localities: [area], flat_types: [bhk], budget_min: Math.round(budget * 0.55), budget_max: budget, furnishing: "" });

/** The requirement with the most live matches, so demos open on the engine working. */
function useBestLead(inventory) {
  return useMemo(() => {
    if (!inventory?.length) return null;
    let best = null;
    for (const a of AREAS) for (const b of BHKS) for (const g of [40000, 60000]) {
      const n = matchesForLead(leadFor(a, b, g), inventory).length;
      if (!best || n > best.n) best = { area: a, bhk: b, budget: g, n };
    }
    return best?.n ? best : null;
  }, [inventory]);
}

/** A listing as a broker sees it in the app. */
const asCard = (l, share) => ({
  ...l, source: "broker", status: "published", on_platform: true, group_ids: [], lister_name: "Verified partner",
  lister_phone: "", lister_agency: "MovEazy partner", brokerage_pct: share,
});

const StatusBar = () => <div style={{ height: 34, background: "var(--card, #fff)" }} />;

/* ---------- App screens ---------- */

function InventoryScreen({ listings, share, pad = 44 }) {
  return (
    <div style={{ background: "#F6F7F6", minHeight: "100%" }}>
      <div style={{ padding: `${pad}px 14px 10px`, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <div className="pz-between">
          <AppLogo />
          <span className="pz-chip" style={{ padding: "4px 10px", fontSize: 12 }}>Bangalore</span>
        </div>
        <div className="pz-search" style={{ marginTop: 10 }}>
          <Search size={15} />
          <input className="pz-input" readOnly value="" placeholder="Search by location, BHK, rent…" style={{ fontSize: 13, padding: "9px 10px 9px 34px" }} />
        </div>
        <div className="pz-tabs" style={{ padding: 0, marginTop: 8, borderBottom: 0 }}>
          {["My", "Moveazy", "Brokers", "Groups"].map((t, i) => (
            <span key={t} className={`pz-tab${i === 1 ? " pz-tab--on" : ""}`} style={{ fontSize: 13, padding: "8px 2px" }}>{t}</span>
          ))}
        </div>
      </div>
      <div className="pz-list" style={{ padding: 12 }}>
        {listings.map((l) => <PropertyCard key={l.property_id} listing={asCard(l, share)} onWhatsApp={() => {}} onToggleSave={() => {}} />)}
      </div>
    </div>
  );
}

function MatchesScreen({ lead, inventory, share }) {
  const all = inventory ? matchesForLead(lead, inventory) : [];
  return (
    <>
      <StatusBar />
      <TopBar title="Matching Properties" back />
      <div className="pz-pad" style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div className="pz-row">
          <Avatar name={lead.name} size="lg" />
          <div>
            <strong style={{ display: "block", fontSize: 16 }}>{lead.name}</strong>
            <span className="pz-meta">{requirementLine(lead)} • {lead.localities[0]}</span>
            <span style={{ display: "block", fontSize: 13.5, color: "var(--g)", fontWeight: 600 }}>
              {inventory ? `${all.length} matching propert${all.length === 1 ? "y" : "ies"}` : "Searching live inventory…"}
            </span>
          </div>
        </div>
      </div>
      <div className="pz-pad pz-list">
        {inventory && all.length === 0 && <div className="pz-card" style={{ padding: 16 }}>No match right now. Try another area.</div>}
        {all.slice(0, 3).map((m) => (
          <PropertyCard key={m.listing.property_id} listing={asCard(m.listing, share)} onWhatsApp={() => {}} onToggleSave={() => {}}
            extra={<div className="pz-row" style={{ marginTop: 10, gap: 8 }}><span className="pz-score">{m.score}</span><span className="pz-meta">{m.reasons.join(" · ")}</span></div>} />
        ))}
      </div>
    </>
  );
}

function ShareScreen({ listing }) {
  const l = listing || { property_id: "MZ1024", flat_type: "2 BHK", area: "Bengaluru", rent: 0 };
  return (
    <div style={{ background: "rgba(17,24,39,.45)", minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", paddingBottom: 20 }}>
        <div className="pz-between" style={{ padding: "16px 16px 6px" }}><strong style={{ fontSize: 17 }}>Share Property</strong><X size={20} /></div>
        <div className="pz-pad">
          <div className="pz-card pz-row" style={{ padding: 10 }}>
            <div style={{ width: 72, height: 56, borderRadius: 8, overflow: "hidden", flex: "none", background: "#E5E7EB" }} className="pz-prop-img">
              {listing && <SmartListingImage listing={l} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: "block" }}>{l.flat_type} in {l.area}</strong>
              <span style={{ fontSize: 14 }}>{inr(l.rent)} / month</span>
              <span style={{ display: "block", color: "#2563EB", fontSize: 13 }}>{displayLink(l.property_id)}</span>
            </div>
          </div>
        </div>
        <div className="pz-pad" style={{ paddingTop: 0 }}>
          <div className="pz-card pz-menurow" style={{ borderRadius: 12 }}>
            <span className="pz-avatar" style={{ background: "#22C55E", color: "#fff" }}><WhatsAppIcon /></span>
            <span style={{ flex: 1 }}>Send on WhatsApp<span className="pz-sub">To Anjali Sharma</span></span>
            <ChevronRight size={18} color="#9CA3AF" />
          </div>
        </div>
        <div className="pz-pad" style={{ paddingTop: 0 }}>
          <div className="pz-card">
            {[[Copy, "Copy Link"], [Share2, "Share via More Apps"], [QrCode, "Show QR Code"]].map(([I, t]) => (
              <div key={t} className="pz-menurow"><span className="pz-avatar" style={{ background: "#F3F4F6", color: "var(--ink)" }}><I size={17} /></span><span style={{ flex: 1 }}>{t}</span><ChevronRight size={18} color="#9CA3AF" /></div>
            ))}
          </div>
        </div>
        <div className="pz-pad" style={{ paddingTop: 0 }}>
          <div style={{ background: "#F3F4F6", borderRadius: 12, padding: 12, fontSize: 13.5, whiteSpace: "pre-wrap", color: "#374151" }}>
            {customerMessage(l, { leadName: "Anjali Sharma" })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadsScreen({ inventory }) {
  // Sample clients, one per area, each given the requirement with the most live matches there.
  const leads = useMemo(() => {
    const people = [["Anjali Sharma", "Today"], ["Rohit Verma", "Yesterday"], ["Meera Nair", "2 days ago"], ["Karan Patel", "Not contacted yet"], ["Divya Rao", "Today"]];
    const picks = AREAS.map((area) => {
      let top = { n: -1 };
      for (const bhk of BHKS) for (const budget of [30000, 40000, 60000]) {
        const n = inventory ? matchesForLead(leadFor(area, bhk, budget), inventory).length : 0;
        if (n > top.n) top = { n, lead: leadFor(area, bhk, budget) };
      }
      return top;
    }).sort((a, b) => b.n - a.n).slice(0, people.length);
    return picks.map((p, i) => ({ name: people[i][0], last: people[i][1], n: p.n, ...p.lead }));
  }, [inventory]);
  return (
    <>
      <StatusBar />
      <TopBar title="Leads" right={<span className="pz-iconbtn" style={{ background: "var(--g)", color: "#fff", borderRadius: 999 }}><Plus size={20} /></span>} />
      <div className="pz-tabs"><span className="pz-tab pz-tab--on">Active ({leads.length})</span><span className="pz-tab">Closed</span><span className="pz-tab">All</span></div>
      <div className="pz-pad">
        <div className="pz-card">
          {leads.map((lead, i) => {
            const n = Math.max(lead.n, 0);
            return (
              <div key={lead.name} className="pz-row" style={{ padding: 14, alignItems: "flex-start", borderTop: i ? "1px solid var(--line)" : 0 }}>
                <Avatar name={lead.name} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 16 }}>{lead.name}</strong>
                  <span style={{ display: "block", fontSize: 14 }}>{requirementLine(lead)}</span>
                  <span className="pz-meta" style={{ display: "block" }}>{lead.localities[0]}</span>
                  <span style={{ display: "block", color: "var(--g)", fontWeight: 600, fontSize: 13.5, marginTop: 2 }}>{n} matching propert{n === 1 ? "y" : "ies"}</span>
                  <span className="pz-hint">{lead.last === "Not contacted yet" ? lead.last : `Last contacted: ${lead.last}`}</span>
                </div>
                <span className="pz-iconbtn" style={{ background: "#22C55E", color: "#fff", borderRadius: 999, width: 34, height: 34 }}><WhatsAppIcon size={18} /></span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function GroupsScreen({ listings }) {
  const groups = [["HSR Brokers Association", 18, 42], ["Bellandur Rentals", 11, 27], ["Whitefield Partners", 9, 19], ["Koramangala Network", 14, 33]];
  return (
    <>
      <StatusBar />
      <TopBar title="Groups" right={<span className="pz-btn pz-btn--primary pz-btn--sm"><Plus size={16} /> Create</span>} />
      <div className="pz-pad">
        <div className="pz-card">
          {groups.map(([name, m, p], i) => (
            <div key={name} className="pz-row" style={{ padding: 14, borderTop: i ? "1px solid var(--line)" : 0 }}>
              <span style={{ transform: "scale(1.35)", margin: "0 8px 0 4px" }}><Avatar name={name} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 16 }}>{name}</strong>
                <span className="pz-meta">{m} members • {p} properties</span>
              </span>
              <ChevronRight size={20} color="#9CA3AF" />
            </div>
          ))}
        </div>
        <div className="pz-label" style={{ margin: "16px 2px 8px", fontWeight: 700 }}>New in HSR Brokers Association</div>
        <div className="pz-card">
          {listings.slice(0, 3).map((l, i) => (
            <div key={l.property_id} className="pz-row" style={{ padding: 12, borderTop: i ? "1px solid var(--line)" : 0 }}>
              <div className="pz-prop-img" style={{ width: 70, height: 54, borderRadius: 10, overflow: "hidden", flex: "none" }}><SmartListingImage listing={l} /></div>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14.5 }}>{l.flat_type} • {l.area}</strong>
                <span className="pz-meta">{inr(l.rent)} / month</span>
              </span>
              <span className="pz-iconbtn" style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 999, width: 32, height: 32 }}><WhatsAppIcon size={16} /></span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ContactsScreen({ listing, share }) {
  const l = listing || {};
  return (
    <>
      <StatusBar />
      <TopBar title="Property details" back />
      <div className="lp-cover" style={{ height: 230 }}>{listing && <SmartListingImage listing={l} />}</div>
      <div className="pz-pad">
        <div className="pz-between" style={{ alignItems: "flex-start" }}>
          <strong style={{ fontSize: 19 }}>{l.flat_type || "2 BHK"} • {l.area || "Bengaluru"}</strong>
          <span className="pz-pill">{share}% Brokerage</span>
        </div>
        <div className="pz-rent" style={{ marginTop: 4 }}>{inr(l.rent || 0)} <small>/ month</small></div>
        <div className="pz-meta">{[l.furnishing, l.property_type].filter(Boolean).join(" • ")}</div>
        <div className="pz-card" style={{ padding: 14, marginTop: 14 }}>
          <div className="pz-row" style={{ marginBottom: 12 }}>
            <span className="pz-avatar" style={{ background: "#DCFCE7", color: "#166534" }}><Building2 size={16} /></span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: "block" }}>Owner contact</strong>
              <span className="pz-meta"><BadgeCheck size={13} style={{ verticalAlign: -2 }} /> Verified by MovEazy</span>
            </span>
            <span className="pz-pill pz-pill--solid">Premium</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: ".02em" }}>+91 98•••• ••21</div>
          <div className="pz-actions" style={{ marginTop: 12 }}>
            <span className="pz-btn pz-btn--primary"><Phone size={16} /> Call</span>
            <span className="pz-btn pz-wa"><WhatsAppIcon /> WhatsApp</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Live matching demo ---------- */

function MatchingDemo({ inventory, best, share }) {
  const [area, setArea] = useState("HSR Layout");
  const [bhk, setBhk] = useState("2 BHK");
  const [budget, setBudget] = useState(40000);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !best) return;
    setArea(best.area); setBhk(best.bhk); setBudget(best.budget); setSeeded(true);
  }, [best, seeded]);
  const lead = { name: "Your client", ...leadFor(area, bhk, budget) };

  return (
    <div className="lp-split">
      <div>
        <h2 className="lp-h2">Try it. <span className="hl">Live inventory.</span></h2>
        <p className="lp-sub" style={{ marginBottom: 22 }}>Pick what your client wants.</p>
        <div className="lp-card" style={{ padding: 20, background: "#fff" }}>
          <div className="pz-chips">{AREAS.map((a) => <Chip key={a} on={a === area} onClick={() => setArea(a)}>{a}</Chip>)}</div>
          <div className="pz-chips" style={{ marginTop: 12 }}>{BHKS.map((b) => <Chip key={b} on={b === bhk} onClick={() => setBhk(b)}>{b}</Chip>)}</div>
          <div className="pz-chips" style={{ marginTop: 12 }}>{BUDGETS.map((b) => <Chip key={b} on={b === budget} onClick={() => setBudget(b)}>≤ {inr(b)}</Chip>)}</div>
        </div>
        <div style={{ marginTop: 20 }}><SignupButton className="lp-btn lp-btn--acc">Match my clients</SignupButton></div>
      </div>
      <div className="lp-phone-stage">
        <PhoneFrame><MatchesScreen lead={lead} inventory={inventory} share={share} /></PhoneFrame>
        <div className="lp-chip" style={{ top: 120, left: -10 }}><span className="ic"><Sparkles size={18} /></span><span><b>AI</b>Ranked in seconds</span></div>
      </div>
    </div>
  );
}

/* ---------- Earnings calculator ---------- */

function Calculator({ s }) {
  const [properties, setProperties] = useState(2);
  const [clients, setClients] = useState(1);
  const r = brokerEarnings({
    properties, clients, avgBrokerage: s.avgBrokerage, propertyShare: s.propertyShare, clientShare: s.clientShare, fee: s.premiumPrice,
  });
  return (
    <div className="lp-calc">
      <div className="lp-inputs" style={{ gridTemplateColumns: "1fr" }}>
        <Stepper label="MovEazy properties closed / month" value={properties} onChange={setProperties} max={30} hint={`You keep ${s.propertyShare}%`} />
        <Stepper label="MovEazy clients closed / month" value={clients} onChange={setClients} max={30} hint={`You keep ${s.clientShare}% · coming soon`} />
      </div>
      <div className="lp-result" aria-live="polite">
        <h3>Extra income / month</h3>
        <div className="lp-rline"><span>Properties<small>{properties} × {inr(s.avgBrokerage)} × {s.propertyShare}%</small></span><b>{inr(r.fromProperties)}</b></div>
        <div className="lp-rline"><span>Clients<small>{clients} × {inr(s.avgBrokerage)} × {s.clientShare}%</small></span><b>{inr(r.fromClients)}</b></div>
        <div className="lp-rline"><span>Premium<small><s>{inr(s.premiumListPrice)}</s> offer</small></span><b>− {inr(s.premiumPrice)}</b></div>
        <div className="lp-total">
          <b>{inr(r.net)}<span style={{ fontSize: 16, color: "#fff", opacity: 0.7, fontWeight: 600 }}> / month</span></b>
          {r.multiple ? <span className="lp-badge"><Zap size={14} /> {r.multiple}× your fee</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function PartnerLanding() {
  const s = useLandingSettings();
  const inventory = useInventory();
  const photos = useListingsWithPhotos(inventory, 4);
  const best = useBestLead(inventory);

  const stats = [[s.statBrokers, "Brokers"], [s.statProperties, "Verified properties"], [s.statRating, "Rating"]];
  const refund = <a href="https://www.moveazy.co.in/terms#refunds">100% refundable</a>;

  return (
    <div className="lp lp--broker">
      <LandingStyles />
      <LandingNav dark product="Partners" ctaClass="lp-btn lp-btn--gold"
        links={[["#app", "App"], ["#matching", "AI Matching"], ["#earnings", "Earnings"], ["#faq", "FAQs"]]} />

      <header className="lp-hero lp-hero--dark" id="top">
        <div className="lp-wrap">
          <div>
            <h1 className="lp-h1">More Properties.<br />More Clients.<br /><span className="hl">More Earnings.</span></h1>
            <ul className="lp-checks"><li>Verified inventory</li><li>AI matching</li><li>Broker network</li></ul>
            <div className="lp-ctas">
              <SignupButton>Join free</SignupButton>
              <a href="#earnings" className="lp-btn lp-btn--ghost" style={{ color: "#fff" }}>My earnings</a>
            </div>
            <div className="lp-price" style={{ marginTop: 16 }}>Premium <b>{inr(s.premiumPrice)}/month</b><s>{inr(s.premiumListPrice)}</s>· {refund}</div>
            <div style={{ marginTop: 14 }}><VideoButton url={s.videoBroker} /></div>
          </div>
          <div className="lp-phone-stage">
            <PhoneFrame><InventoryScreen listings={photos.slice(0, 2)} share={s.propertyShare} /></PhoneFrame>
            <div className="lp-chip" style={{ top: 70, right: -6 }}><span className="ic"><BadgeCheck size={18} /></span><span><b>{s.statProperties}</b>Verified properties</span></div>
            <div className="lp-chip" style={{ top: 280, left: -24 }}><span className="ic"><Sparkles size={18} /></span><span><b>AI</b>Tenant matching</span></div>
            <div className="lp-chip" style={{ bottom: 80, right: -14 }}><span className="ic"><IndianRupee size={18} /></span><span><b>{s.propertyShare}%</b>Brokerage</span></div>
          </div>
        </div>
      </header>

      <div className="lp-wrap">
        <div className="lp-stats">{stats.map(([v, l]) => <div key={l} className="lp-stat"><b>{v}</b><span>{l}</span></div>)}</div>
      </div>

      <section className="lp-sec" id="app">
        <div className="lp-wrap lp-center">
          <h2 className="lp-h2">One app. <span className="hl">Every deal.</span></h2>
          <div className="lp-shots" style={{ marginTop: 36 }}>
            <Shot title="Lead book" sub="Matches counted live"><LeadsScreen inventory={inventory} /></Shot>
            <Shot title="Broker groups" sub="Share privately"><GroupsScreen listings={photos} /></Shot>
            <Shot title="Owner contacts" sub="Unlocked with Premium"><ContactsScreen listing={photos[2] || photos[0]} share={s.propertyShare} /></Shot>
            <Shot title="Share in one tap" sub="WhatsApp, link or QR"><ShareScreen listing={photos[3] || photos[0]} /></Shot>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-sec--white" id="matching">
        <div className="lp-wrap">
          <MatchingDemo inventory={inventory} best={best} share={s.propertyShare} />
        </div>
      </section>

      <section className="lp-sec" id="earnings">
        <div className="lp-wrap">
          <h2 className="lp-h2">Your extra <span className="hl">earnings.</span></h2>
          <Calculator s={s} />
          <div className="lp-guarantee">
            <ShieldCheck size={24} color="#8A6419" style={{ flex: "none" }} />
            <div><b>100% refundable monthly fee</b><p>Not useful? We refund the month in full. <a href="https://www.moveazy.co.in/terms#refunds" style={{ fontWeight: 700 }}>Terms</a></p></div>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-sec--white" id="faq">
        <div className="lp-wrap">
          <h2 className="lp-h2">FAQs</h2>
          <Faq items={[
            ["Is it free?", "Yes. Premium unlocks MovEazy inventory with owner contacts."],
            ["What does Premium cost?", `${inr(s.premiumPrice)}/month (regular ${inr(s.premiumListPrice)}). 100% refundable.`],
            ["How much brokerage do I keep?", `${s.propertyShare}% on MovEazy properties, ${s.clientShare}% on MovEazy clients.`],
            ["Who sees my listings?", "You choose: only you, your groups, or all MovEazy brokers."],
          ]} />
        </div>
      </section>

      <section className="lp-sec lp-sec--dark lp-final">
        <div className="lp-wrap">
          <h2 className="lp-h2">Your next deal is <span className="hl">on MovEazy.</span></h2>
          <div className="lp-ctas" style={{ justifyContent: "center", marginTop: 24 }}><SignupButton>Join free <ArrowRight size={18} /></SignupButton></div>
          <div className="lp-pricebar"><span>Premium {inr(s.premiumPrice)}/month</span>{refund}</div>
        </div>
      </section>

      <LandingFooter product="Partners" blurb="Verified inventory, AI matching and a broker network for Bengaluru's rental brokers."
        links={[["#app", "The app"], ["#matching", "AI matching"], ["#earnings", "Earnings"], ["#faq", "FAQs"]]}
        other={["https://owners.moveazy.co.in/", "For owners"]} />

      <StickyCta title="Free to join" sub={`Premium ${inr(s.premiumPrice)}/mo · refundable`} ctaClass="lp-btn lp-btn--gold" />
    </div>
  );
}
