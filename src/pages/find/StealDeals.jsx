/**
 * moveazy.co.in/find/steal-deals — Steal Deals of the Week: up to 20 flats the
 * team picked for this Monday–Sunday (CRM → Deals), each with why it's a
 * steal. Filter by flat type. A flat rented mid-week stays, marked rented.
 */
import { useEffect, useMemo, useState } from "react";
import { DealCard, FindShell, KindChips, useFindGate, useLikes } from "./findKit";
import { DAY_KINDS, fetchDealsFeed, weekLabel } from "../../lib/deals";

export default function StealDeals() {
  const { allowed, gate } = useFindGate();
  const likes = useLikes();
  const [feed, setFeed] = useState(null);
  const [kind, setKind] = useState("");
  useEffect(() => { fetchDealsFeed().then(setFeed, () => setFeed({ steal: [], weekStart: "", weekEnd: "" })); }, []);

  const all = useMemo(() => feed?.steal ?? [], [feed]);
  const counts = useMemo(() => {
    const n = { all: all.length };
    for (const d of all) if (d.kind) n[d.kind] = (n[d.kind] || 0) + 1;
    return n;
  }, [all]);
  const shown = kind ? all.filter((d) => d.kind === kind) : all;
  const week = feed?.weekStart ? weekLabel(feed.weekStart, feed.weekEnd) : "";

  return (
    <FindShell kicker={week ? `This week · ${week}` : "This week"} title="Steal Deals of the Week"
      sub="Hand-picked flats priced below what's around them. New picks every Monday.">
      {gate}
      {allowed && (feed === null ? (
        <div className="fd-empty">Loading this week&apos;s deals…</div>
      ) : all.length === 0 ? (
        <div className="fd-empty"><b>This week&apos;s deals drop soon</b>Check back shortly, or build your free curated list meanwhile.</div>
      ) : (
        <>
          <KindChips kinds={DAY_KINDS} value={kind} onChange={setKind} counts={counts} />
          <div className="fd-grid">
            {shown.map((d) => <DealCard key={d.listing.id} deal={d} label="Steal Deal of the Week" badge="Steal Deal" likes={likes} />)}
          </div>
        </>
      ))}
    </FindShell>
  );
}
