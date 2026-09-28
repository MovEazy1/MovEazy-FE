/**
 * Increase Rent: a rough guide to what similar flats nearby rent for, from
 * MovEazy's own listings (owner_area_rent()), then the free Home Designer call —
 * the designer turns the flat's photos into AI makeovers and suggests the
 * cheapest upgrades that would justify a higher rent.
 *
 * Not "yield" (PRD: yield needs the property's value, which we don't ask for),
 * and not a promise: the range is rounded and says what it was based on.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Camera, CheckCircle2, Lightbulb, Palette, Sofa, TrendingUp } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Chip, Empty, Loading, TopBar } from "./ownerUi";
import { bhkLabel, fetchAreaRent, inr, occupancyOf, op, propertyName } from "../../lib/owners";

function RangeBar({ low, high, median, yours }) {
  const min = Math.min(low, yours) * 0.92;
  const max = Math.max(high, yours) * 1.08;
  const at = (v) => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;
  return (
    <div style={{ position: "relative", height: 44, margin: "18px 4px 6px" }} aria-hidden>
      <div style={{ position: "absolute", top: 18, left: 0, right: 0, height: 8, borderRadius: 99, background: "#EFEBE0" }} />
      <div style={{ position: "absolute", top: 18, left: at(low), width: `calc(${at(high)} - ${at(low)})`, height: 8, borderRadius: 99, background: "var(--champ)" }} />
      <div style={{ position: "absolute", top: 12, left: at(median), width: 2, height: 20, background: "var(--champ3)", transform: "translateX(-1px)" }} />
      <div style={{ position: "absolute", top: 8, left: at(yours), transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ width: 16, height: 16, borderRadius: 99, background: "var(--em)", border: "3px solid #fff", boxShadow: "0 0 0 1px var(--em)", marginTop: 6 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--em)", marginTop: 2 }}>You</span>
      </div>
    </div>
  );
}

export default function IncreaseRent() {
  const [params, setParams] = useSearchParams();
  const { properties, tenants, requests } = useOwner();
  const list = properties ?? [];
  const pid = params.get("property") || list[0]?.property_id || "";
  const p = list.find((x) => x.property_id === pid);
  const [guide, setGuide] = useState(undefined);

  useEffect(() => {
    if (!pid) return;
    setGuide(undefined);
    fetchAreaRent(pid).then(setGuide, () => setGuide(null));
  }, [pid]);

  const openCall = requests.find((r) => r.kind === "designer_call" && !["resolved", "cancelled"].includes(r.status));

  const tips = useMemo(() => {
    if (!p) return [];
    const out = [];
    if (/unfurnished/i.test(p.furnishing || "")) out.push([Sofa, "Semi-furnish it", "Wardrobes, a fridge and curtains are what most renters filter for — often the cheapest step up."]);
    if (/semi/i.test(p.furnishing || "")) out.push([Sofa, "Finish the furnishing", "A sofa, dining set and beds move a flat into the fully-furnished band."]);
    if ((p.images ?? []).length < 5) out.push([Camera, "Better photos", "Listings with 5+ bright photos get far more visits — the designer uses them too."]);
    out.push([Lightbulb, "Fresh paint and lighting", "A neutral repaint and warm lighting are the upgrades renters notice most on a visit."]);
    if (occupancyOf(p, tenants) !== "occupied") out.push([TrendingUp, "Price it with the area", "A flat priced near the median lets fastest; a long vacancy costs more than a small discount."]);
    return out.slice(0, 4);
  }, [p, tenants]);

  if (!properties) return <><TopBar title="Increase Rent" back /><Loading /></>;
  if (!list.length) {
    return <><TopBar title="Increase Rent" back /><Empty action={<Link to={op("/properties/new")} className="oz-btn oz-btn--primary">Add a property</Link>}>Add a property to see what similar homes rent for.</Empty></>;
  }

  const enough = guide && guide.count >= 3;
  const diff = enough && p ? Math.round(Number(p.rent) - guide.median) : 0;
  const verdict = !enough || !p ? "" : Math.abs(diff) <= guide.median * 0.03 ? "In line with similar flats."
    : diff < 0 ? `${inr(-diff)} below the median — there may be room at the next renewal.`
      : `${inr(diff)} above the median — upgrades help justify it and keep tenants longer.`;

  return (
    <>
      <TopBar title="Increase Rent" back />
      <div className="oz-pad">
        {list.length > 1 && (
          <div className="oz-chips oz-chips--scroll" style={{ marginBottom: 12 }}>
            {list.map((x) => (
              <Chip key={x.property_id} on={x.property_id === pid} onClick={() => setParams({ property: x.property_id }, { replace: true })}>{propertyName(x)}</Chip>
            ))}
          </div>
        )}

        <div className="oz-section">
          <div className="oz-meta">{p ? `${bhkLabel(p)} · ${p.area}` : ""}</div>
          {guide === undefined ? <p className="oz-meta">Looking at similar flats…</p> : !enough ? (
            <p style={{ margin: "8px 0 0", lineHeight: 1.55 }}>Not enough similar listings nearby to give a fair range yet. Our Home Designer can still suggest what would lift the rent.</p>
          ) : (
            <>
              <h2 style={{ margin: "6px 0 2px", fontSize: 14, fontWeight: 600, color: "var(--dim)" }}>
                Similar flats {guide.scope === "Bengaluru" ? "across Bengaluru" : `in ${guide.scope}`} rent for
              </h2>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em" }}>{inr(guide.low)} – {inr(guide.high)}</div>
              <div className="oz-meta">Median {inr(guide.median)} · from {guide.count} MovEazy listing{guide.count > 1 ? "s" : ""}</div>
              <RangeBar low={guide.low} high={guide.high} median={guide.median} yours={Number(p.rent)} />
              <div className="oz-between" style={{ fontSize: 13 }}>
                <span className="oz-meta">Your rent</span><strong>{inr(p.rent)}</strong>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: diff < 0 ? "var(--em)" : "var(--ink)", fontWeight: 600 }}>{verdict}</p>
            </>
          )}
          <p className="oz-hint" style={{ margin: "10px 0 0" }}>A rough guide from live and recently rented MovEazy listings, rounded to ₹500 — not a valuation.</p>
        </div>

        <div className="oz-hero" style={{ marginBottom: 12 }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div className="oz-row" style={{ gap: 8, color: "var(--champ)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".04em" }}>
              <Palette size={16} /> FREE HOME DESIGNER CALL
            </div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 20, lineHeight: 1.3 }}>See your flat's rent-raising makeover before you spend</h2>
            <p style={{ margin: "0 0 14px", fontSize: 14, opacity: 0.88, lineHeight: 1.55 }}>
              Our designer turns your flat's photos into AI renders and shows the smallest upgrades — paint, lighting, furnishing — that could raise the rent.
            </p>
            {openCall ? (
              <Link to={op(`/repairs/${openCall.id}`)} className="oz-btn oz-btn--champ" style={{ width: "100%" }}>
                <CheckCircle2 size={17} /> Call requested — see status
              </Link>
            ) : (
              <Link to={op(`/designer-call${pid ? `?property=${pid}` : ""}`)} className="oz-btn oz-btn--champ" style={{ width: "100%", fontWeight: 700 }}>
                Book a free call
              </Link>
            )}
          </div>
        </div>

        {tips.length > 0 && (
          <div className="oz-section">
            <h2 className="oz-h2">Ways to lift the rent</h2>
            {tips.map(([Icon, title, body]) => (
              <div key={title} className="oz-row" style={{ alignItems: "flex-start", padding: "8px 0" }}>
                <span className="oz-avatar" style={{ background: "var(--champ2)" }}><Icon size={17} /></span>
                <span><strong style={{ display: "block", fontSize: 14.5 }}>{title}</strong><span className="oz-meta">{body}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
