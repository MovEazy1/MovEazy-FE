/**
 * Owner landing page — what a signed-out visitor sees at owners.moveazy.co.in
 * (and /owners). The owner app is free; the one job here is the sign-up.
 *
 * Screens first, few words: each phone is the owner app's own layout, with
 * photos from MovEazy's real published inventory. The calculator's assumptions
 * (painting at market vs MovEazy cost, the owner's hourly value, vacancy with
 * MovEazy) come from the CRM through useLandingSettings. No rent collection is
 * promised: V1 of the owner app doesn't do it, so the page doesn't say it does.
 */
import { useState } from "react";
import {
  ArrowRight, CalendarClock, Check, ChevronRight, ClipboardList, Home, KeyRound, Paintbrush, Palette, Share2, TrendingUp, Users, Wrench,
} from "lucide-react";
import {
  Faq, LandingFooter, LandingNav, LandingStyles, PhoneFrame, Shot, SignupButton, Stepper, StickyCta, VideoButton, useInventory, useListingsWithPhotos,
} from "../landing/landingKit";
import { Chip, Pill, PropertyThumb, TopBar } from "./ownerUi";
import { ServiceIcon } from "./serviceIcons";
import { inr, ownerReturns } from "../../lib/landingCalc";
import { useLandingSettings } from "../../lib/landingSettings";

const StatusBar = () => <div style={{ height: 34 }} />;
const flatName = (l) => (l ? `${l.flat_type || "2 BHK"} · ${l.area || "Bengaluru"}` : "2 BHK · HSR Layout");

/* ---------- App screens ---------- */

function HomeScreen({ photos }) {
  return (
    <div style={{ background: "#F7F4EC", minHeight: "100%", padding: "44px 12px 12px" }}>
      <div className="oz-between" style={{ marginBottom: 10 }}>
        <strong style={{ fontSize: 20, color: "#063B2D" }}>Moveazy</strong>
        <span className="oz-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>PK</span>
      </div>
      <div className="oz-hero" style={{ padding: 14 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Good morning, Priya</div>
          <div style={{ fontSize: 11, color: "#D6B77C", marginTop: 8, fontWeight: 700 }}>YOUR PORTFOLIO</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>3 properties</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>2 occupied · 1 vacant · 3 tenants</div>
        </div>
        <div className="oz-hero-actions" style={{ gap: 7, marginTop: 12 }}>
          {[[TrendingUp, "Increase Rent"], [KeyRound, "Find a Tenant"], [Wrench, "Manage Repairs"]].map(([I, t]) => (
            <span key={t} className="oz-hero-action" style={{ padding: "9px 4px", fontSize: 11 }}><span className="ic" style={{ width: 30, height: 30 }}><I size={15} /></span>{t}</span>
          ))}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, margin: "14px 2px 8px" }}>Needs your attention</div>
      <div className="oz-card">
        {[[CalendarClock, "2 visits booked", flatName(photos[0]), "var(--emt)", "var(--em)"],
          [Users, "3 interested renters", flatName(photos[1]), "var(--champ2)", "var(--champ3)"]].map(([I, t, sub, bg, fg]) => (
          <div key={t} className="oz-menurow" style={{ padding: "11px 12px", fontSize: 13.5 }}>
            <span className="oz-avatar" style={{ width: 32, height: 32, background: bg, color: fg }}><I size={15} /></span>
            <span style={{ flex: 1 }}><strong style={{ fontWeight: 600 }}>{t}</strong><span className="oz-sub" style={{ fontSize: 12 }}>{sub}</span></span>
            <ChevronRight size={16} color="#94A09B" />
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, margin: "14px 2px 8px" }}>Your properties</div>
      <div className="oz-list">
        {photos.slice(0, 2).map((p, i) => (
          <div key={p.property_id} className="oz-card">
            <div className="oz-prop">
              <PropertyThumb property={p} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="oz-prop-title">{flatName(p)}</h3>
                <div className="oz-meta" style={{ marginTop: 2 }}>{i ? "Live on MovEazy · 2 visits booked" : "Occupied · 1 tenant"}</div>
                <div className="oz-chips" style={{ marginTop: 6 }}>{i ? <Pill tone="champ">Finding a tenant</Pill> : <Pill tone="green">Occupied</Pill>}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindTenantScreen({ listing }) {
  return (
    <>
      <StatusBar />
      <TopBar title="Find a Tenant" back />
      <div className="oz-thumb" style={{ width: "100%", height: 190, borderRadius: 0 }}>{listing && <PropertyThumb property={listing} style={{ width: "100%", height: "100%", borderRadius: 0 }} />}</div>
      <div className="oz-pad">
        <div className="oz-section" style={{ borderColor: "#BFE3D0", background: "linear-gradient(180deg,#F1F8F4,#fff)" }}>
          <div className="oz-between">
            <h2 className="oz-h2" style={{ margin: 0 }}><span className="oz-row" style={{ gap: 6 }}><Check size={18} color="var(--em)" /> Live on MovEazy</span></h2>
            <Pill tone="green">Listed</Pill>
          </div>
          <div className="oz-grid2" style={{ marginTop: 12 }}>
            <span className="oz-btn"><Share2 size={16} /> Share</span>
            <span className="oz-btn">View page</span>
          </div>
        </div>
        <div className="oz-section">
          <h2 className="oz-h2"><span className="oz-row" style={{ gap: 6 }}><Users size={17} /> Interested renters</span><span className="oz-hint">3</span></h2>
          {[["RM", "Rahul M.", "Visit booked", "green", "Family · up to ₹55k"],
            ["SI", "Sneha I.", "Asked to visit", "amber", "Working professionals"],
            ["KR", "Kiran R.", "Shortlisted", "champ", "Couple · up to ₹50k"]].map(([i, n, b, tone, want]) => (
            <div key={n} className="oz-row" style={{ padding: "10px 0", borderTop: "1px solid var(--line2)", alignItems: "flex-start" }}>
              <span className="oz-avatar">{i}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="oz-between"><strong>{n}</strong><Pill tone={tone}>{b}</Pill></span>
                <span className="oz-meta">{want}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function VisitsScreen() {
  const days = [["Sat 4 Oct", ["10:00", "11:00", "12:00", "17:00", "18:00"], "11:00"], ["Sun 5 Oct", ["10:00", "11:00", "16:00", "17:00"], "16:00"], ["Mon 6 Oct", ["18:00", "19:00"], ""]];
  return (
    <>
      <StatusBar />
      <TopBar title="Visit times" back />
      <div className="oz-pad">
        <div className="oz-section">
          <h2 className="oz-h2">When can renters visit?</h2>
          <div className="oz-chips">{["Weekends", "Evenings", "Any day"].map((t, i) => <Chip key={t} on={i === 0}>{t}</Chip>)}</div>
          <div className="oz-grid2" style={{ marginTop: 12 }}>
            <span className="oz-btn">From 10:00</span><span className="oz-btn">To 19:00</span>
          </div>
        </div>
        {days.map(([d, slots, booked]) => (
          <div key={d} className="oz-section">
            <h2 className="oz-h2">{d}{booked && <Pill tone="green">1 visit</Pill>}</h2>
            <div className="oz-chips">
              {slots.map((t) => (
                <span key={t} className={`oz-chip${t === booked ? " oz-chip--on" : ""}`}>{t === booked ? `${t} · Rahul M.` : t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ServicesScreen({ paint }) {
  const rows = [
    ["painting", "painting", "Repainting · 2 BHK", paint, "Walls and ceilings, done between tenants"],
    ["deep-cleaning", "cleaning", "Deep Cleaning", 1999, "Professional home cleaning"],
    ["ac-service", "appliances", "AC Service", 499, "AC installation, service & repair"],
    ["plumbing", "repairs", "Plumbing Repair", 399, "Leakage, tap, pipeline repair"],
  ];
  return (
    <>
      <StatusBar />
      <TopBar title="Home Services" />
      <div className="oz-pad" style={{ paddingTop: 0 }}>
        <div className="oz-card oz-row" style={{ padding: 12, marginBottom: 12 }}>
          <span className="oz-avatar" style={{ background: "var(--emt)" }}><ClipboardList size={18} /></span>
          <span style={{ flex: 1 }}><strong style={{ display: "block" }}>Repairs & requests</strong><span className="oz-meta">1 in progress</span></span>
          <ChevronRight size={18} color="#94A09B" />
        </div>
        <div className="oz-chips oz-chips--scroll" style={{ marginBottom: 12 }}>{["Popular", "Cleaning", "Repairs", "Painting"].map((t, i) => <Chip key={t} on={i === 0}>{t}</Chip>)}</div>
        <div className="oz-list">
          {rows.map(([id, cat, title, price, sum]) => (
            <div key={id} className="oz-card oz-row" style={{ padding: 12 }}>
              <span className="oz-svc-ic"><ServiceIcon id={id} category={cat} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 15.5 }}>{title}</strong>
                <span style={{ display: "block", fontSize: 14, color: "var(--em)", fontWeight: 600 }}>{id === "painting" ? inr(price) : `From ${inr(price)}`}</span>
                <span className="oz-meta">{sum}</span>
              </span>
              <ChevronRight size={18} color="#94A09B" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DesignerScreen({ photos }) {
  return (
    <>
      <StatusBar />
      <TopBar title="Home Designer call" back />
      <div className="oz-pad">
        <div className="oz-row" style={{ marginBottom: 14 }}>
          <span className="oz-svc-ic"><Palette size={24} /></span>
          <span><strong style={{ display: "block" }}>Free 20-minute call</strong><span className="oz-meta">AI makeovers of your flat</span></span>
        </div>
        <span className="oz-label">Which properties?</span>
        <div className="oz-card" style={{ marginBottom: 14 }}>
          {photos.slice(0, 2).map((p, i) => (
            <div key={p.property_id} className="oz-prop" style={{ borderTop: i ? "1px solid var(--line2)" : 0 }}>
              <PropertyThumb property={p} />
              <strong style={{ flex: 1 }}>{flatName(p)}</strong>
              <span style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: i ? "#fff" : "var(--em)", border: "1.5px solid var(--em)", color: "#fff" }}>{!i && <Check size={15} />}</span>
            </div>
          ))}
        </div>
        <span className="oz-label">Preferred time</span>
        <div className="oz-chips" style={{ marginBottom: 18 }}>{["Morning", "Afternoon", "Evening"].map((t, i) => <Chip key={t} on={i === 1}>{t}</Chip>)}</div>
        <span className="oz-btn oz-btn--primary oz-btn--block">Book my free call</span>
      </div>
    </>
  );
}

/* ---------- Returns calculator ---------- */

function Calculator({ s }) {
  const [rent, setRent] = useState(50000);
  const [changes, setChanges] = useState(1);
  const [hours, setHours] = useState(10);
  const [vacant, setVacant] = useState(20);
  const [maintHours, setMaintHours] = useState(8);
  const r = ownerReturns({
    rent, changesPerYear: changes, paintMarket: s.paintMarket, paintMoveazy: s.paintMoveazy, hoursPerChange: hours,
    hourlyValue: s.hourlyValue, maintEveryYears: 3, maintHours, vacantDaysWithout: vacant, vacantDaysWith: s.vacantDaysWith,
  });
  return (
    <div className="lp-calc">
      <div className="lp-inputs">
        <Stepper label="Monthly rent" value={rent} onChange={setRent} min={5000} max={500000} step={1000} format={inr} />
        <Stepper label="Tenant changes / year" value={changes} onChange={setChanges} max={6} />
        <Stepper label="Your hours per change" value={hours} onChange={setHours} max={80} hint={`Valued at ${inr(s.hourlyValue)}/hr`} />
        <Stepper label="Vacant days today" value={vacant} onChange={setVacant} max={120} hint={`MovEazy: ~${s.vacantDaysWith} days`} />
        <Stepper label="Maintenance hours / 3 yrs" value={maintHours} onChange={setMaintHours} max={80} />
      </div>
      <div className="lp-result" aria-live="polite">
        <h3>Extra value / year</h3>
        <div className="lp-rline"><span>Painting<small>{changes} × ({inr(s.paintMarket)} − {inr(s.paintMoveazy)})</small></span><b>{inr(r.paintingSaved)}</b></div>
        <div className="lp-rline"><span>Your time<small>{changes} × {hours} hrs × {inr(s.hourlyValue)}</small></span><b>{inr(r.timeSaved)}</b></div>
        <div className="lp-rline"><span>Maintenance time<small>{maintHours} hrs × {inr(s.hourlyValue)} ÷ 3</small></span><b>{inr(r.maintTimeSaved)}</b></div>
        <div className="lp-rline"><span>Faster letting<small>{r.daysRecovered} days × {inr(rent / 30)}</small></span><b>{inr(r.extraRent)}</b></div>
        <div className="lp-total">
          <b>{inr(r.total)}</b>
          <span className="lp-badge"><TrendingUp size={14} /> +{r.pct}% on annual rent</span>
        </div>
      </div>
    </div>
  );
}

export default function OwnerLanding() {
  const s = useLandingSettings();
  const inventory = useInventory(80);
  const photos = useListingsWithPhotos(inventory, 3);
  const stats = [[s.statProperties, "Properties"], [`${s.vacantDaysWith} days`, "To a new tenant"], [s.statRating, "Rating"]];

  return (
    <div className="lp lp--owner">
      <LandingStyles />
      <LandingNav product="Owners" ctaClass="lp-btn lp-btn--acc"
        links={[["#app", "App"], ["#returns", "Your returns"], ["#faq", "FAQs"]]} />

      <header className="lp-hero lp-hero--light" id="top">
        <div className="lp-wrap">
          <div>
            <h1 className="lp-h1" style={{ color: "var(--deep)" }}>More rental income.<br />Less hassle.<br /><span className="hl">Total peace of mind.</span></h1>
            <ul className="lp-checks"><li>Verified tenants</li><li>Repairs handled</li><li>Free for owners</li></ul>
            <div className="lp-ctas">
              <SignupButton className="lp-btn lp-btn--acc">Join free</SignupButton>
              <a href="#returns" className="lp-btn lp-btn--ghost" style={{ color: "var(--acc)" }}>My returns</a>
            </div>
            <div style={{ marginTop: 16 }}><VideoButton url={s.videoOwner} /></div>
          </div>
          <div className="lp-phone-stage">
            <PhoneFrame><HomeScreen photos={photos} /></PhoneFrame>
            <div className="lp-chip" style={{ top: 80, left: -24 }}><span className="ic"><KeyRound size={18} /></span><span><b>{s.vacantDaysWith} days</b>to a verified tenant</span></div>
            <div className="lp-chip" style={{ bottom: 120, right: -18 }}><span className="ic"><Paintbrush size={18} /></span><span><b>{inr(s.paintMoveazy)}</b>repainting, not {inr(s.paintMarket)}</span></div>
          </div>
        </div>
      </header>

      <div className="lp-wrap">
        <div className="lp-stats">{stats.map(([v, l]) => <div key={l} className="lp-stat"><b>{v}</b><span>{l}</span></div>)}</div>
      </div>

      <section className="lp-sec" id="app">
        <div className="lp-wrap lp-center">
          <h2 className="lp-h2">Earn more. <span className="hl">Do less.</span></h2>
          <div className="lp-shots" style={{ marginTop: 36 }}>
            <Shot title="Find a tenant" sub="Screened renters, no calls"><FindTenantScreen listing={photos[1] || photos[0]} /></Shot>
            <Shot title="Visits in your slots" sub="You pick the times"><VisitsScreen /></Shot>
            <Shot title="Repairs handled" sub={`Repainting ${inr(s.paintMoveazy)}`}><ServicesScreen paint={s.paintMoveazy} /></Shot>
            <Shot title="Home Designer" sub="Free call, AI makeovers"><DesignerScreen photos={photos} /></Shot>
          </div>
        </div>
      </section>

      <section className="lp-sec lp-sec--white" id="returns">
        <div className="lp-wrap">
          <h2 className="lp-h2">Your extra <span className="hl">returns.</span></h2>
          <Calculator s={s} />
        </div>
      </section>

      <section className="lp-sec" id="faq">
        <div className="lp-wrap">
          <h2 className="lp-h2">FAQs</h2>
          <Faq items={[
            ["Is it free?", "Yes. You pay only for a service you book."],
            ["Will renters call me?", "No. MovEazy screens renters and books visits in your times."],
            ["What does repainting cost?", `${inr(s.paintMoveazy)} for a 2 BHK (market ~${inr(s.paintMarket)}), for your first ${s.paintCycles} tenant cycles.`],
            ["Is my data private?", "Only you and the MovEazy team see it."],
          ]} />
        </div>
      </section>

      <section className="lp-sec lp-sec--dark lp-final">
        <div className="lp-wrap">
          <h2 className="lp-h2">Your home, handled. <span className="hl">Your returns, higher.</span></h2>
          <div className="lp-ctas" style={{ justifyContent: "center", marginTop: 24 }}><SignupButton>Join free <ArrowRight size={18} /></SignupButton></div>
          <p style={{ marginTop: 14, fontSize: 14, opacity: 0.8 }}>No fees for owners</p>
        </div>
      </section>

      <LandingFooter product="Owners" blurb="Verified tenants, repairs and upkeep at the lowest cost — free for property owners."
        links={[["#app", "The app"], ["#returns", "Your returns"], ["#faq", "FAQs"]]}
        other={["https://partners.moveazy.co.in/", "For brokers"]} />

      <StickyCta title="Free for owners" sub="Sign up in seconds" ctaClass="lp-btn lp-btn--acc" />
    </div>
  );
}
