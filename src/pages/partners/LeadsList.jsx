/**
 * Leads, in two: My Leads — every tenant the partner works, their own and the
 * MovEazy tenants given to them, in one list (TenantKit) — and MovEazy leads,
 * where more are asked for (MoveazyLeads.jsx).
 *
 * The list opens on everyone still in play, the ones needing attention first:
 * a follow-up due, something new they did (a like, an open), then the next
 * reminder, then the newest. Stage chips narrow it; search finds anyone.
 * Free and Premium alike, on real data only.
 */
import { Suspense, lazy, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, ChevronRight, Plus, Search } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Empty, Loading, TopBar } from "./partnerUi";
import { MoveazyTab, MyLeadsTab } from "./MoveazyLeadsPromo";
import { KIT_CSS, TenantRow, useReach } from "./TenantKit";
import { useTenants } from "./tenantData";
import { pp } from "../../lib/partners";
import { OPEN_STAGES, STAGES, stageCounts } from "../../lib/partnerTenants";

// Its own file, loaded when the tab is opened.
const MoveazyLeads = lazy(() => import("./MoveazyLeads"));

const CHIPS = [["open", "In play"], ...STAGES.map((s) => [s.id, s.label]), ["all", "All"]];

/** My Leads | MovEazy leads (black halftone with the logo — it should catch the eye); the open one is red. */
function BookSwitch({ book, setBook, me, assigned }) {
  const mine = book === "mine";
  return (
    <div className="pz-pad" style={{ paddingTop: 16, paddingBottom: 0, background: "var(--card)" }}>
      <div role="tablist" style={{ display: "flex", background: "var(--bg)", borderRadius: 12, padding: 4, gap: 6 }}>
        <MyLeadsTab selected={mine} onSelect={() => setBook("mine")} />
        <MoveazyTab me={me} selected={!mine} onSelect={() => setBook("moveazy")} assigned={assigned} />
      </div>
    </div>
  );
}

/** Needing attention first. */
function rank(t, now) {
  const r = t.next_reminder;
  if (r && new Date(r.due_at) <= now) return [0, r.due_at];
  if (t.new_actions > 0) return [1, String(-Date.parse(t.last_action_at || 0))];
  if (r) return [2, r.due_at];
  return [3, String(-Date.parse(t.created_at || 0))];
}

export default function LeadsList() {
  const { me, demo, explain } = usePartner();
  const { board, loaded } = useTenants();
  const reach = useReach();
  const [stage, setStage] = useState("open");
  const [q, setQ] = useState("");
  const [assigned, setAssigned] = useState(null); // as the MovEazy tab last loaded them
  const [params, setParams] = useSearchParams();
  const book = params.get("tab") === "moveazy" ? "moveazy" : "mine";
  const setBook = (b) => setParams(b === "moveazy" ? { tab: "moveazy" } : {}, { replace: true });

  const counts = useMemo(() => stageCounts(board), [board]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const now = new Date();
    return board
      .filter((t) => {
        if (needle) {
          return String(t.name || "").toLowerCase().includes(needle) || (digits.length >= 3 && String(t.phone || "").includes(digits))
            || (t.localities ?? []).some((l) => l.toLowerCase().includes(needle));
        }
        return stage === "all" || (stage === "open" ? OPEN_STAGES.has(t.stage) : t.stage === stage);
      })
      .map((t) => ({ t, k: rank(t, now) }))
      .sort((a, b) => a.k[0] - b.k[0] || String(a.k[1]).localeCompare(String(b.k[1])))
      .map((x) => x.t);
  }, [board, stage, q]);

  return (
    <>
      <TopBar title="Leads" right={
        <Link to={pp("/leads/new")} className="pz-iconbtn" aria-label="Add a tenant" style={{ background: "var(--goldg)", color: "#1F1605", borderRadius: 999 }}>
          <Plus size={20} />
        </Link>
      } />
      <BookSwitch book={book} setBook={setBook} me={me} assigned={assigned} />
      {book === "moveazy" ? (
        <Suspense fallback={<Loading />}><MoveazyLeads onAssigned={setAssigned} /></Suspense>
      ) : (
      <>
      <style>{KIT_CSS}</style>
      <div className="pz-pad" style={{ paddingBottom: 0, background: "var(--card)" }}>
        <div className="pz-search">
          <Search size={17} />
          <input className="pz-input" type="search" placeholder="Search by name, mobile or area…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!q.trim() && (
          <div className="pz-chips" style={{ flexWrap: "nowrap", overflowX: "auto", padding: "10px 0 8px" }}>
            {CHIPS.map(([k, label]) => (
              <Chip key={k} on={stage === k} onClick={() => setStage(k)}>{label} · {counts[k] ?? 0}</Chip>
            ))}
          </div>
        )}
      </div>
      <div className="pz-pad">
        <Link to={pp("/insights")} onClick={demo ? (e) => { e.preventDefault(); explain("insights"); } : undefined} className="pz-card pz-row"
          style={{ padding: 14, marginBottom: 12, color: "inherit", textDecoration: "none", background: "var(--noir)", borderColor: "var(--noir)" }}>
          <span className="pz-avatar" style={{ background: "var(--goldg)", color: "#1F1605" }}><BarChart3 size={17} /></span>
          <span style={{ flex: 1, color: "#fff" }}><strong style={{ display: "block" }}>Leads dashboard</strong>
            <span style={{ fontSize: 12.5, color: "#A7A3B3" }}>QR scans by area · what clients like · every like & skip</span></span>
          <ChevronRight size={18} color="#D4A437" />
        </Link>
        {!loaded ? <Loading /> : rows.length === 0 ? (
          <Empty action={<Link to={pp("/leads/new")} className="pz-btn pz-btn--primary"><Plus size={16} /> Add a tenant</Link>}>
            {board.length ? (q.trim() ? "Nobody matches that." : "Nobody at this stage.") : "Add your first tenant — a name and mobile is enough. Tenants MovEazy gives you show up here too."}
          </Empty>
        ) : (
          <div className="pz-card">
            {rows.map((t) => <TenantRow key={t.key} t={t} onReach={reach} />)}
          </div>
        )}
      </div>
      </>
      )}
    </>
  );
}
