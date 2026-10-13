/**
 * The Leads tab, in two pills under the top bar: My leads — every tenant the
 * partner works, their own and the MovEazy tenants given to them, in one list
 * (TenantKit) — and MovEazy, where more are asked for (MoveazyLeads.jsx). A
 * new client comes from the floating +.
 *
 * The list opens on everyone still in play, the ones needing attention first:
 * a follow-up due, something new they did (a like, an open), then the next
 * reminder, then the newest. Stage chips narrow it; search finds anyone.
 * Free and Premium alike, on real data only.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Empty, Loading } from "./partnerUi";
import { PartnerHeader } from "./PartnerChrome";
import { KIT_CSS, TenantRow, useReach } from "./TenantKit";
import { useTenants } from "./tenantData";
import { pp } from "../../lib/partners";
import { fetchMyAssignedLeads, moveazyTabBadge } from "../../lib/partnerLeads";
import { OPEN_STAGES, STAGES, stageCounts } from "../../lib/partnerTenants";

// Its own file, loaded when the tab is opened.
const MoveazyLeads = lazy(() => import("./MoveazyLeads"));

const CHIPS = [["open", "In play"], ...STAGES.map((s) => [s.id, s.label]), ["all", "All"]];

const seenKey = (id) => `pz-mzleads-seen:${id}`;
const readSeen = (id) => { try { return localStorage.getItem(seenKey(id)) === "1"; } catch { return true; } };

/** My leads | MovEazy — big pills under the top bar; MovEazy says NEW until first opened, then how many await a call. */
function BookPills({ book, setBook, me, mineCount, assigned }) {
  const id = me?.partner?.user_id ?? "";
  const [seen, setSeen] = useState(() => readSeen(id));
  const [fetched, setFetched] = useState([]);
  useEffect(() => {
    if (book !== "moveazy" || seen) return;
    try { localStorage.setItem(seenKey(id), "1"); } catch { /* fine */ }
    setSeen(true);
  }, [book, seen, id]);
  useEffect(() => {
    if (!id || assigned) return undefined;
    let alive = true;
    fetchMyAssignedLeads().then((r) => alive && setFetched(r ?? []), () => {});
    return () => { alive = false; };
  }, [id, assigned]);
  const badge = moveazyTabBadge(seen || book === "moveazy", assigned ?? fetched);
  return (
    <div className="pc-band" role="tablist" aria-label="Leads">
      <button type="button" role="tab" aria-selected={book === "mine"} className={`pc-pill${book === "mine" ? " on" : ""}`} onClick={() => setBook("mine")}>
        My leads <span style={{ opacity: 0.6, fontWeight: 600 }}>{mineCount}</span>
      </button>
      <button type="button" role="tab" aria-selected={book === "moveazy"} className={`pc-pill pc-pill--gold${book === "moveazy" ? " on" : ""}`} onClick={() => setBook("moveazy")}>
        MovEazy leads
        {badge && <span style={{ padding: "1px 6px", borderRadius: 99, background: "#E3141B", color: "#fff", fontSize: 10.5, fontWeight: 800 }}>{badge}</span>}
      </button>
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
  const { me } = usePartner();
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
      <PartnerHeader>
        <BookPills book={book} setBook={setBook} me={me} mineCount={counts.open ?? 0} assigned={assigned} />
      </PartnerHeader>
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
