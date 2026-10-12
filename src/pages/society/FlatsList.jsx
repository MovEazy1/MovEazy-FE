/**
 * Screen 6 — All Flats: search by flat number or owner, All / Available /
 * Occupied with counts, every row opening its flat.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { fetchSocietyFlats, societyError, sp } from "../../lib/society";
import { Empty, FlatRow, Loading, TopBar } from "./societyUi";

const FILTERS = [["all", "All"], ["available", "Available"], ["occupied", "Occupied"]];

export default function FlatsList() {
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.some(([k]) => k === params.get("f")) ? params.get("f") : "all";
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      fetchSocietyFlats(filter, q.trim()).then((d) => { if (alive) { setData(d); setErr(""); } }, (e) => { if (alive) setErr(societyError(e)); });
    }, q ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [filter, q]);

  return (
    <div className="sx-page fl">
      <style>{CSS}</style>
      <TopBar title="All Flats" back={sp("/")}
        right={<Link to={sp("/flats/new")} className="sx-icon" aria-label="Add a flat" style={{ color: "var(--em)" }}><Plus size={26} strokeWidth={2.4} /></Link>} />
      <label className="fl-search">
        <Search size={19} />
        <input type="search" placeholder="Search by flat no. or owner name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search flats" />
      </label>
      <div className="fl-chips" role="tablist">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""}
            onClick={() => setParams(k === "all" ? {} : { f: k }, { replace: true })}>
            {label} <b>{data?.counts?.[k] ?? "–"}</b>
          </button>
        ))}
      </div>
      {err && <p className="sx-err">{err}</p>}
      {!data && !err ? <Loading /> : data && (data.flats.length === 0 ? (
        <Empty title={q ? "No flats match that" : filter === "occupied" ? "No occupied flats" : "No flats yet"}
          action={<Link to={sp("/flats/new")} className="sx-btn" style={{ maxWidth: 320, margin: "0 auto" }}><Plus size={18} /> Add Available Flat</Link>}>
          {q ? "Check the flat number or the owner's name." : "Add a flat that's free to rent — MovEazy finds the tenant."}
        </Empty>
      ) : data.flats.map((f) => <FlatRow key={f.property_id} flat={f} to={sp(`/flats/${f.property_id}`)} />))}
    </div>
  );
}

const CSS = `
.fl-search { display: flex; align-items: center; gap: 10px; background: #EFEBE1; border-radius: 14px; padding: 0 14px; min-height: 52px; color: #7C8782; margin-top: 6px; }
.fl-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 16px; color: var(--ink); }
.fl-chips { display: flex; gap: 8px; margin: 14px 0 14px; overflow-x: auto; }
.fl-chips button { flex: none; border: 0; border-radius: 99px; padding: 10px 16px; background: #EFEBE1; color: var(--ink); font-size: 15px; font-weight: 600; cursor: pointer; }
.fl-chips button b { margin-left: 6px; font-weight: 700; }
.fl-chips button.on { background: var(--em); color: #fff; }
`;
