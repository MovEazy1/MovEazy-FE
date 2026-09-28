/**
 * The tenant app, as the home page shows it: one phone per step of speed
 * renting. The matches screens are the app's own SwipeDeck and scoring engine
 * over MovEazy's real published inventory; the agent, visit and move-in screens
 * are drawn with the same shapes, colours and wording as AIBroker,
 * PropertyVisitSlots and the shortlist, so what the page shows is what a
 * tenant gets.
 */
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, Building2, CalendarCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Globe, Home, MapPin, MessageCircle,
  ShieldCheck, Sparkles, Users, Wallet,
} from "lucide-react";
import SwipeDeck from "../../components/SwipeDeck";
import { fetchInventoryAsListings } from "../../lib/inventory";
import { listingForScoring, scoreMatch } from "../../lib/inventoryMatch";
import { isVideoUrl } from "../../lib/listingMedia";
import logoOnLight from "../../assets/logo/moveazy-logo-mint-light.png";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

export const T = {
  ink: "#04211D", deep: "#02140E", teal: "#0E7C68", mint: "#5EEAD4", wash: "#E9FBF6", washLine: "#BEEFE2",
  line: "#E2E8F0", muted: "#64748B", text: "#0B1A17", coral: "#EE5B45", cream: "#F4F2ED",
};

const loads = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });

/**
 * Up to five real, published homes with a photo that loads, each scored by the
 * app's own engine against a requirement built from the best of them — so the
 * match percentages and reasons on the page are the engine's, not ours.
 */
export function useShowcaseMatches() {
  const [state, setState] = useState({ matches: [], requirement: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      let rows = [];
      try { rows = await fetchInventoryAsListings({ limit: 120 }); } catch { rows = []; }
      const withPhoto = rows
        .map((l) => ({ l, src: [l.image, ...(l.images ?? [])].find((u) => u && !isVideoUrl(u)) }))
        .filter((x) => x.src && x.l.monthlyRent && x.l.bhk)
        .sort((a, b) => (b.l.images?.length ?? 0) - (a.l.images?.length ?? 0))
        .slice(0, 18);
      const good = [];
      for (let i = 0; i < withPhoto.length && good.length < 12; i += 6) {
        const batch = withPhoto.slice(i, i + 6);
        const ok = await Promise.all(batch.map((x) => loads(x.src)));
        batch.forEach((x, j) => { if (ok[j] && good.length < 12) good.push({ ...x.l, image: x.src, images: [x.src] }); });
      }
      if (!alive || !good.length) return;
      // The requirement a real renter could have had: the area and home size
      // most of these homes share, and a budget that covers them.
      const count = new Map();
      for (const l of good) { const k = `${l.location}|${l.bhk}`; count.set(k, (count.get(k) || 0) + 1); }
      const [area, bhk] = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0].split("|");
      const rents = good.filter((l) => l.location === area).map((l) => l.monthlyRent);
      const requirement = {
        name: "Riya", localities: [area], flatTypes: [bhk],
        budgetMin: Math.round(Math.min(...rents) * 0.8), budgetMax: Math.round(Math.max(...rents) * 1.1),
      };
      const scored = good
        .map((l) => ({ l, m: scoreMatch(listingForScoring(l), requirement) }))
        .sort((a, b) => b.m.score - a.m.score);
      // Strong matches only, the way the app deals them; never fewer than three cards.
      const strong = scored.filter((x) => x.m.score >= 50);
      const matches = (strong.length >= 3 ? strong : scored.slice(0, 3)).slice(0, 5)
        .map(({ l, m }) => ({ ...l, matchScore: m.score, matchReasons: m.reasons, isVerified: true }));
      setState({ matches, requirement });
    })();
    return () => { alive = false; };
  }, []);
  return state;
}

const rent = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

function AppBar({ title, back = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "44px 16px 10px", background: "#fff", borderBottom: `1px solid ${T.line}` }}>
      {back ? <ChevronLeft size={22} color={T.ink} /> : <img src={logoOnLight} alt="MovEazy" style={{ height: 22 }} />}
      {title && <strong style={{ fontSize: 16, color: T.ink }}>{title}</strong>}
    </div>
  );
}

/* 1 ── Tell us once: the AI broker, mid-questionnaire. */
export function AgentScreen() {
  const on = new Set(["HSR", "Koramangala", "Bellandur"]);
  const areas = ["HSR", "HSR Extension", "Koramangala", "Indiranagar", "Bellandur", "Kudlu Gate", "Harlur Road", "Whitefield", "Sarjapur", "BTM", "JP Nagar", "Marathahalli"];
  return (
    <div style={{ background: "#fff", minHeight: "100%", display: "flex", flexDirection: "column", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ padding: "46px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src={logoOnLight} alt="MovEazy" style={{ height: 20 }} />
        <span style={{ fontSize: 11, color: T.muted, textAlign: "right" }}>Your AI broker</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 22px 0" }}>
        <div style={{ flex: 1, display: "flex", gap: 5 }}>
          {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i < 5 ? T.teal : T.line }} />)}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.muted }}>5 / 10</span>
      </div>
      <div style={{ padding: "22px 22px 0", flex: 1 }}>
        <h3 style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.28, color: T.ink, margin: 0 }}>Which localities do you prefer?</h3>
        <p style={{ fontSize: 13.5, color: T.muted, margin: "7px 0 18px" }}>Select multiple areas.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {areas.map((a) => (
            <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1.5px solid ${on.has(a) ? T.ink : T.line}`,
              background: on.has(a) ? T.wash : "#fff", color: T.ink, fontSize: 13.5, fontWeight: 600, padding: "9px 15px", borderRadius: 999 }}>
              {on.has(a) && <span style={{ width: 15, height: 15, borderRadius: 99, background: T.ink, color: "#fff", display: "inline-grid", placeItems: "center" }}><Check size={10} strokeWidth={3} /></span>}
              {a}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: T.wash, borderRadius: 12, padding: "12px 14px", fontSize: 12.5, color: T.ink, marginTop: 20 }}>
          <Sparkles size={15} color={T.teal} style={{ flex: "none", marginTop: 1 }} /> We'll check every verified home in and around these.
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px 34px", borderTop: `1px solid ${T.line}` }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: T.ink, display: "inline-flex", alignItems: "center" }}><ChevronLeft size={16} /> Back</span>
        <span style={{ background: T.ink, color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "12px 22px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>Continue <ChevronRight size={16} /></span>
      </div>
    </div>
  );
}

/* 2 ── The AI agents at work: every scattered source, searched for you. */
export function SearchScreen({ requirement }) {
  const sources = [
    [MessageCircle, "WhatsApp groups", "Scanning listings", 0.82, "#25D366"],
    [Users, "Offline brokers", "Calling for you", 0.64, T.teal],
    [Globe, "Rental platforms", "Cross-checking", 0.9, "#6366F1"],
    [Building2, "MovEazy verified", "Matched", 1, T.ink],
  ];
  return (
    <div style={{ background: T.ink, minHeight: "100%", color: "#fff", fontFamily: "Inter, system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "48px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <img src={logoOnDark} alt="MovEazy" style={{ height: 20 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.mint, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="th-live" /> Live
        </span>
      </div>
      <div style={{ display: "grid", placeItems: "center", padding: "30px 0 18px", position: "relative" }}>
        <span className="th-radar"><span /><span /><span /></span>
        <span style={{ width: 86, height: 86, borderRadius: 99, background: T.mint, color: T.ink, display: "grid", placeItems: "center", position: "relative", zIndex: 1,
          boxShadow: "0 0 60px rgba(94,234,212,.45)" }}>
          <Sparkles size={36} />
        </span>
      </div>
      <div style={{ padding: "0 20px", textAlign: "center" }}>
        <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.01em" }}>Your AI agents are searching</h3>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9FB5B0" }}>
          {requirement ? `${requirement.flatTypes[0]} · ${requirement.localities[0]} · up to ${rent(requirement.budgetMax)}` : "Matching your preferences"}
        </p>
      </div>
      <div style={{ padding: "20px 16px 0", display: "grid", gap: 9 }}>
        {sources.map(([I, name, state, pct, tone]) => (
          <div key={name} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "11px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.08)", color: tone === T.ink ? T.mint : tone, display: "grid", placeItems: "center" }}><I size={16} /></span>
              <strong style={{ flex: 1, fontSize: 14 }}>{name}</strong>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: pct >= 1 ? T.mint : "#9FB5B0" }}>{pct >= 1 ? "✓ " : ""}{state}</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,.08)", marginTop: 9, overflow: "hidden" }}>
              <div className="th-bar" style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 99, background: T.mint }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ margin: "auto 16px 30px", background: T.mint, color: T.ink, borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <Clock size={18} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Your curated list, within 6 hours</span>
      </div>
    </div>
  );
}

/* The finale: one perfect home, at your fingertips. */
export function PerfectHomeScreen({ listing }) {
  return (
    <div style={{ background: "#fff", minHeight: "100%", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ height: 470, position: "relative", background: "#E5ECEA" }}>
        {listing?.image && <img src={listing.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(4,33,29,.25), transparent 30%, transparent 55%, rgba(4,33,29,.85))" }} />
        <img src={logoOnDark} alt="MovEazy" style={{ position: "absolute", top: 48, left: 18, height: 20 }} />
        <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, color: "#fff" }}>
          <span style={{ fontSize: 12, fontWeight: 800, background: T.mint, color: T.ink, padding: "4px 10px", borderRadius: 99 }}>
            {listing?.matchScore != null ? `${listing.matchScore}% match` : "Your match"}
          </span>
          <h3 style={{ margin: "10px 0 2px", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>{listing ? `${listing.bhk} · ${listing.location}` : "Your home"}</h3>
          <span style={{ fontSize: 15, opacity: 0.85 }}>{listing ? `${rent(listing.monthlyRent)} / month` : ""}</span>
        </div>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 10 }}>
        {[[BadgeCheck, "Verified by MovEazy"], [ShieldCheck, "Deposit protected"], [CalendarCheck, "Visit today"]].map(([I, t]) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: T.ink }}>
            <I size={17} color={T.teal} /> {t}
          </div>
        ))}
        <span style={{ marginTop: 6, textAlign: "center", background: T.ink, color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 0", borderRadius: 14 }}>This is the one</span>
      </div>
    </div>
  );
}

/* 2a ── The hero: the app's real swipe deck, over real matches. */
export function SwipeScreen({ matches }) {
  return (
    <div style={{ background: "#fff", minHeight: "100%", fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppBar back={false} />
      <div style={{ padding: "12px 12px 0" }}>
        <h3 style={{ fontWeight: 800, fontSize: 22, textAlign: "center", margin: "4px 0 2px", color: T.text }}>Your top {matches.length || 5} matches</h3>
        <p style={{ textAlign: "center", color: T.muted, fontSize: 13, margin: "0 0 10px" }}>Swipe right to shortlist, left to skip.</p>
        {matches.length ? <SwipeDeck listings={matches} /> : <div style={{ height: 420, borderRadius: 18, background: "#F1F5F4" }} />}
      </div>
    </div>
  );
}

/* 2b ── Every flat, ranked: the same engine as a list. */
export function RankedScreen({ matches, requirement }) {
  return (
    <div style={{ background: "#F7FAF8", minHeight: "100%", fontFamily: "Inter, system-ui, sans-serif" }}>
      <AppBar title="Curated for you" />
      <div style={{ padding: "12px 14px", background: "#fff", borderBottom: `1px solid ${T.line}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, padding: "6px 11px", borderRadius: 99, background: T.ink, color: T.mint, display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} /> Ready in 6 hrs</span>
        {[requirement?.localities?.[0], requirement?.flatTypes?.[0], requirement ? `Up to ${rent(requirement.budgetMax)}` : null].filter(Boolean).map((c) => (
          <span key={c} style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 99, background: T.wash, color: T.ink }}>{c}</span>
        ))}
      </div>
      <div style={{ padding: 12, display: "grid", gap: 10 }}>
        {(matches.length ? matches : Array.from({ length: 4 }, (_, i) => ({ id: i }))).slice(0, 5).map((l, i) => (
          <div key={l.id} style={{ display: "flex", gap: 12, background: "#fff", borderRadius: 16, padding: 10, border: `1px solid ${T.line}`, boxShadow: i === 0 ? "0 10px 24px rgba(4,33,29,.10)" : "none" }}>
            <div style={{ width: 92, height: 80, borderRadius: 12, flex: "none", background: "#E5ECEA", overflow: "hidden" }}>
              {l.image && <img src={l.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            </div>
            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ alignSelf: "flex-start", fontSize: 11, fontWeight: 800, color: T.teal, background: T.wash, padding: "2px 8px", borderRadius: 99 }}>
                {l.matchScore != null ? `${l.matchScore}% match` : "…"}
              </span>
              <strong style={{ fontSize: 14.5, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.bhk ? `${l.bhk} · ${l.location}` : " "}</strong>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{l.monthlyRent ? `${rent(l.monthlyRent)} / month` : ""}</span>
              <span style={{ fontSize: 11.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(l.matchReasons ?? []).slice(0, 2).join(" · ")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 3 ── Visit in one tap. */
export function VisitScreen({ listing }) {
  const days = [["Today", "4"], ["Sat", "5"], ["Sun", "6"], ["Mon", "7"]];
  const slots = ["10:00 AM", "11:00 AM", "12:30 PM", "4:00 PM", "5:30 PM", "7:00 PM"];
  return (
    <div style={{ background: "rgba(4,33,29,.5)", minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ height: 250, overflow: "hidden", position: "relative", flex: "none" }}>
        {listing?.image && <img src={listing.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />}
      </div>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "18px 20px 34px", flex: 1 }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: T.line, margin: "0 auto 14px" }} />
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.ink }}>Schedule a visit</h3>
        <p style={{ margin: "4px 0 16px", fontSize: 13, color: T.muted, display: "flex", alignItems: "center", gap: 5 }}>
          <MapPin size={13} /> {listing ? `${listing.bhk} · ${listing.location}` : "2 BHK · HSR"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {days.map(([d, n], i) => (
            <span key={d} style={{ textAlign: "center", padding: "10px 0", borderRadius: 14, border: `1.5px solid ${i === 0 ? T.ink : T.line}`, background: i === 0 ? T.ink : "#fff", color: i === 0 ? "#fff" : T.ink }}>
              <span style={{ display: "block", fontSize: 11.5, opacity: 0.75 }}>{d}</span><strong style={{ fontSize: 17 }}>{n}</strong>
            </span>
          ))}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, margin: "18px 0 8px" }}>Available times</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {slots.map((s, i) => (
            <span key={s} style={{ textAlign: "center", fontSize: 13, fontWeight: 700, padding: "10px 0", borderRadius: 11, border: `1.5px solid ${i === 3 ? T.teal : T.line}`, background: i === 3 ? T.wash : "#fff", color: i === 3 ? T.teal : T.ink }}>{s}</span>
          ))}
        </div>
        <span style={{ marginTop: 22, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, background: T.ink, color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 0", borderRadius: 14 }}>
          <CalendarCheck size={17} /> Confirm visit · Today, 4:00 PM
        </span>
      </div>
    </div>
  );
}

/* 4 ── Move in: the home is finalised, and one agent carries it through. */
export function MoveInScreen({ listing }) {
  const rows = [[ShieldCheck, "Deposit protected"], [BadgeCheck, "Agreement verified"], [Wallet, "Rent on auto-pay"], [Home, "Move-in: Sat, 11 AM"]];
  return (
    <div style={{ background: "#fff", minHeight: "100%", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ padding: "54px 22px 22px", textAlign: "center", background: `linear-gradient(180deg, ${T.wash}, #fff)` }}>
        <span style={{ width: 70, height: 70, borderRadius: 99, background: T.teal, color: "#fff", display: "inline-grid", placeItems: "center", boxShadow: "0 14px 30px rgba(14,124,104,.35)" }}>
          <CheckCircle2 size={36} />
        </span>
        <h3 style={{ margin: "16px 0 4px", fontSize: 23, fontWeight: 800, color: T.ink }}>Home finalised</h3>
        <p style={{ margin: 0, fontSize: 13.5, color: T.muted, display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} /> In 1 day, not 1 month</p>
      </div>
      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", border: `1px solid ${T.line}`, borderRadius: 16, padding: 10 }}>
          <div style={{ width: 70, height: 58, borderRadius: 11, overflow: "hidden", background: "#E5ECEA", flex: "none" }}>
            {listing?.image && <img src={listing.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 14.5, color: T.text }}>{listing ? `${listing.bhk} · ${listing.location}` : "2 BHK · HSR"}</strong>
            <span style={{ fontSize: 13, color: T.muted }}>{listing ? `${rent(listing.monthlyRent)} / month` : ""}</span>
          </div>
        </div>
        <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 16 }}>
          {rows.map(([I, t], i) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 14px", borderTop: i ? `1px solid ${T.line}` : 0, fontSize: 14, fontWeight: 600, color: T.ink }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: T.wash, color: T.teal, display: "grid", placeItems: "center" }}><I size={16} /></span>
              <span style={{ flex: 1 }}>{t}</span><Check size={17} color={T.teal} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 11, background: T.ink, color: "#fff", borderRadius: 16, padding: "12px 14px" }}>
          <span style={{ width: 38, height: 38, borderRadius: 99, background: T.mint, color: T.ink, display: "grid", placeItems: "center", fontWeight: 800 }}>A</span>
          <span style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 14 }}>Aman, your MovEazy agent</strong><span style={{ fontSize: 12, opacity: 0.7 }}>With you until you've settled in</span></span>
        </div>
      </div>
    </div>
  );
}

/** The four steps of speed renting, in order. */
export function useSteps() {
  const { matches, requirement } = useShowcaseMatches();
  return useMemo(() => ({
    matches,
    requirement,
    steps: [
      { k: "tell", title: "Tell us once.", sub: "Two minutes with your AI broker.", screen: <AgentScreen /> },
      { k: "search", title: "Our AI agents hunt.", sub: "WhatsApp groups, offline brokers, every platform.", screen: <SearchScreen requirement={requirement} /> },
      { k: "rank", title: "Curated in 6 hours.", sub: "Matched to your preferences.", screen: <RankedScreen matches={matches} requirement={requirement} /> },
      { k: "visit", title: "Visit in one tap.", sub: "Same-day slots.", screen: <VisitScreen listing={matches[1] || matches[0]} /> },
      { k: "move", title: "Move in.", sub: "Finalised in a day.", screen: <MoveInScreen listing={matches[0]} /> },
    ],
  }), [matches, requirement]);
}
