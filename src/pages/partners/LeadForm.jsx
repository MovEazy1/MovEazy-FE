/**
 * Add a tenant (lead) — fastest possible capture. Only the mobile number is
 * required; the name, who is moving (bachelor / family, male / female /
 * co-ed) and the requirement can come now or later. Locations are picked from
 * the localities we know (useLocalities), never typed free-hand.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Chip, Empty, Loading, TopBar, toast } from "./partnerUi";
import { useLocalities } from "./useLocalities";
import { BHK_OPTIONS, POPULAR_LOCATIONS } from "../../lib/partnerFilters";
import { FURNISHINGS } from "../../data/preferenceOptions";
import { normalizeIndianMobile } from "../../lib/mobile";
import { deleteLead, friendlyError, pp, saveLead } from "../../lib/partners";
import { matchesForLead } from "../../lib/partnerMatch";

const BUDGETS = [10000, 15000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 75000, 100000, 150000, 200000];
const HOUSEHOLDS = [["bachelor", "Bachelor"], ["family", "Family"]];
const GENDERS = [["male", "Male"], ["female", "Female"], ["coed", "Co-ed"]];

/** Waits for the lead book when opened straight on /leads/:id/edit. */
export default function LeadForm() {
  const { id } = useParams();
  const { leads } = usePartner();
  const existing = id ? leads.find((l) => l.id === id) : null;
  if (id && !existing) {
    return <><TopBar title="Edit Lead" back />{leads.length ? <Empty>That lead isn't in your book.</Empty> : <Loading />}</>;
  }
  return <LeadFormInner key={existing?.id || "new"} existing={existing} />;
}

function LeadFormInner({ existing }) {
  const navigate = useNavigate();
  const { setLeads, inventory } = usePartner();
  const localities = useLocalities();
  const [f, setF] = useState(() => ({
    name: existing?.no_name ? "" : existing?.name || "", phone: existing?.phone || "",
    household: existing?.household || "", gender_pref: existing?.gender_pref || "",
    flat_types: existing?.flat_types || [], budget_min: existing?.budget_min ?? "", budget_max: existing?.budget_max ?? "",
    localities: existing?.localities || [], furnishing: existing?.furnishing || "", notes: existing?.notes || "",
    status: existing?.status || "active",
  }));
  const [open, setOpen] = useState(Boolean(existing));
  const [loc, setLoc] = useState("");
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const matches = useMemo(() => matchesForLead(f, inventory ?? []).length, [f, inventory]);
  const suggestions = useMemo(() => {
    const q = loc.trim().toLowerCase();
    const pool = localities.filter((a) => !f.localities.includes(a));
    return q.length < 2 ? [] : pool.filter((a) => a.toLowerCase().includes(q)).slice(0, 8);
  }, [loc, f.localities, localities]);
  const toggleLoc = (a) => set({ localities: f.localities.includes(a) ? f.localities.filter((x) => x !== a) : [...f.localities, a] });

  const submit = async (e) => {
    e.preventDefault();
    const x = {};
    if (!normalizeIndianMobile(f.phone)) x.phone = "Enter a 10-digit mobile number";
    if (f.budget_min && f.budget_max && Number(f.budget_min) > Number(f.budget_max)) x.budget = "Min is above max";
    setErr(x);
    if (Object.keys(x).length) return;
    setSaving(true);
    try {
      const row = await saveLead(f, existing?.id);
      setLeads((ls) => (existing ? ls.map((l) => (l.id === row.id ? row : l)) : [row, ...ls]));
      toast(existing ? "Lead updated" : "Lead saved");
      navigate(pp(`/leads/${row.id}`), { replace: true });
    } catch (e2) {
      toast(friendlyError(e2, "Could not save the lead."), "error");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(`Delete ${existing.name}? This can't be undone.`)) return;
    try {
      await deleteLead(existing.id);
      setLeads((ls) => ls.filter((l) => l.id !== existing.id));
      navigate(pp("/leads"), { replace: true });
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  const pick = (k, v) => set({ [k]: f[k] === v ? "" : v });

  return (
    <>
      <TopBar title={existing ? "Edit Lead" : "Add Tenant"} back />
      <form className="pz-pad" onSubmit={submit} noValidate>
        <div className="pz-field">
          <label className="pz-label" htmlFor="lf-phone">Mobile Number *</label>
          <input id="lf-phone" className="pz-input" inputMode="tel" autoFocus={!existing} value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="9876543210" />
          {err.phone && <div className="pz-err">{err.phone}</div>}
        </div>
        <div className="pz-field">
          <label className="pz-label" htmlFor="lf-name">Name <span className="pz-hint">(optional)</span></label>
          <input id="lf-name" className="pz-input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Rahul Sharma" />
        </div>
        <div className="pz-field">
          <span className="pz-label">Bachelor or family</span>
          <div className="pz-chips">{HOUSEHOLDS.map(([v, l]) => <Chip key={v} on={f.household === v} onClick={() => pick("household", v)}>{l}</Chip>)}</div>
        </div>
        <div className="pz-field">
          <span className="pz-label">Male / Female / Co-ed</span>
          <div className="pz-chips">{GENDERS.map(([v, l]) => <Chip key={v} on={f.gender_pref === v} onClick={() => pick("gender_pref", v)}>{l}</Chip>)}</div>
        </div>

        <button type="button" className="pz-btn pz-btn--ghost" style={{ padding: "4px 0", marginBottom: 8 }} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />} Requirement (optional)
        </button>

        {open && (
          <>
            <div className="pz-field">
              <span className="pz-label">BHK</span>
              <div className="pz-chips">
                {BHK_OPTIONS.map((b) => (
                  <Chip key={b} on={f.flat_types.includes(b)}
                    onClick={() => set({ flat_types: f.flat_types.includes(b) ? f.flat_types.filter((x) => x !== b) : [...f.flat_types, b] })}>{b}</Chip>
                ))}
              </div>
            </div>
            <div className="pz-field">
              <span className="pz-label">Budget Range (₹)</span>
              <div className="pz-row">
                <select className="pz-select" value={f.budget_min} onChange={(e) => set({ budget_min: e.target.value })} aria-label="Minimum budget">
                  <option value="">Min</option>{BUDGETS.map((b) => <option key={b} value={b}>{b.toLocaleString("en-IN")}</option>)}
                </select>
                <span className="pz-meta">–</span>
                <select className="pz-select" value={f.budget_max} onChange={(e) => set({ budget_max: e.target.value })} aria-label="Maximum budget">
                  <option value="">Max</option>{BUDGETS.map((b) => <option key={b} value={b}>{b.toLocaleString("en-IN")}</option>)}
                </select>
              </div>
              {err.budget && <div className="pz-err">{err.budget}</div>}
            </div>
            <div className="pz-field">
              <span className="pz-label">Preferred Locations</span>
              <div className="pz-chips" style={{ marginBottom: 8 }}>
                {[...new Set([...f.localities, ...POPULAR_LOCATIONS])].map((a) => (
                  <Chip key={a} on={f.localities.includes(a)} onClick={() => toggleLoc(a)}>
                    {a}{f.localities.includes(a) && <X size={14} />}
                  </Chip>
                ))}
              </div>
              <div className="pz-search">
                <Search size={17} />
                <input className="pz-input" placeholder="Search more areas" value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Search localities"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (suggestions[0]) { toggleLoc(suggestions[0]); setLoc(""); } } }} />
              </div>
              {suggestions.length > 0 && (
                <div className="pz-chips" style={{ marginTop: 8 }}>
                  {suggestions.map((s) => <Chip key={s} onClick={() => { toggleLoc(s); setLoc(""); }}>+ {s}</Chip>)}
                </div>
              )}
              {loc.trim().length >= 2 && suggestions.length === 0 && <p className="pz-hint">No area by that name — pick the closest one.</p>}
            </div>
            <div className="pz-field">
              <span className="pz-label">Furnishing</span>
              <div className="pz-chips">
                <Chip on={!f.furnishing} onClick={() => set({ furnishing: "" })}>Any</Chip>
                {FURNISHINGS.map((x) => <Chip key={x} on={f.furnishing === x} onClick={() => set({ furnishing: x })}>{x}</Chip>)}
              </div>
            </div>
            <div className="pz-field">
              <label className="pz-label" htmlFor="lf-notes">Notes</label>
              <textarea id="lf-notes" className="pz-textarea" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })}
                placeholder="Moving in 1st of next month, has a dog…" />
            </div>
            {(f.flat_types.length > 0 || f.localities.length > 0 || f.budget_max) && (
              <p style={{ color: "var(--g)", fontWeight: 600, fontSize: 14 }}>{matches} matching propert{matches === 1 ? "y" : "ies"} right now</p>
            )}
          </>
        )}

        {existing && (
          <div className="pz-field">
            <span className="pz-label">Status</span>
            <div className="pz-chips">
              <Chip on={f.status === "active"} onClick={() => set({ status: "active" })}>Active</Chip>
              <Chip on={f.status === "closed"} onClick={() => set({ status: "closed" })}>Closed</Chip>
            </div>
          </div>
        )}

        <button type="submit" className="pz-btn pz-btn--primary pz-btn--block" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        {existing && (
          <button type="button" className="pz-btn pz-btn--ghost" style={{ color: "var(--red)", width: "100%", marginTop: 10 }} onClick={remove}>Delete lead</button>
        )}
      </form>
    </>
  );
}
