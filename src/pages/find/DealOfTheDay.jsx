/**
 * moveazy.co.in/find/deal-of-the-day — one standout flat for each type
 * (1 RK, 1 BHK, 2 BHK, 3 BHK+), set by the team for today (CRM → Deals). A
 * type with nothing set today keeps yesterday's. Ends at midnight.
 */
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { DealCard, FindShell, useFindGate, useLikes } from "./findKit";
import { DAY_KINDS, fetchDealsFeed, untilMidnightIst } from "../../lib/deals";

export default function DealOfTheDay() {
  const { allowed, gate } = useFindGate();
  const likes = useLikes();
  const [feed, setFeed] = useState(null);
  const [left, setLeft] = useState(() => untilMidnightIst());
  useEffect(() => { fetchDealsFeed().then(setFeed, () => setFeed({ day: [] })); }, []);
  useEffect(() => { const t = setInterval(() => setLeft(untilMidnightIst()), 30000); return () => clearInterval(t); }, []);

  const deals = DAY_KINDS.map((k) => ({ kind: k, deal: (feed?.day ?? []).find((d) => d.kind === k.id) })).filter((x) => x.deal);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <FindShell kicker={today} title="Deal of the Day" sub="One standout flat for each flat type, picked by our team every day."
      aside={<span className="fd-timer"><Timer size={17} /> Ends in {left}</span>}>
      {gate}
      {allowed && (feed === null ? (
        <div className="fd-empty">Loading today&apos;s deals…</div>
      ) : deals.length === 0 ? (
        <div className="fd-empty"><b>Today&apos;s deals are on their way</b>Check back soon, or see this week&apos;s Steal Deals.</div>
      ) : (
        <div className="fd-grid">
          {deals.map(({ kind, deal }) => (
            <DealCard key={kind.id} deal={deal} label={`${kind.label} Deal of the Day`} badge={`${kind.label} · Deal of the Day`} likes={likes} />
          ))}
        </div>
      ))}
    </FindShell>
  );
}
