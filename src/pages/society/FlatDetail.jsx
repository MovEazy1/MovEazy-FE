/**
 * Screen 7 — Flat Details: photos (the society's while the flat has none),
 * status, rent, the owner with one-tap call, notes, and who added and last
 * changed it. ⋮ edits, or marks it occupied / available (confirmed first).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, CheckCircle2, ExternalLink, MoreVertical, Pencil, Phone, Ruler, Sofa, Share2 } from "lucide-react";
import { fetchSocietyFlat, dayLabel, rupees, saveSocietyFlat, societyError, sp } from "../../lib/society";
import { useSociety } from "./SocietyApp";
import { Avatar, Loading, Sheet, StatusPill, toast } from "./societyUi";

const SITE = "https://www.moveazy.co.in";

export default function FlatDetail() {
  const { id } = useParams();
  const { society, reload } = useSociety();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [f, setF] = useState(null);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(null); // "available" | "occupied"
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState(0);
  const strip = useRef(null);

  const load = useCallback(() => fetchSocietyFlat(id).then(setF, (e) => setErr(societyError(e))), [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <div className="sx-page"><p className="sx-err" style={{ paddingTop: 60 }}>{err}</p><Link to={sp("/flats")} className="sx-link">Back to all flats</Link></div>;
  if (!f) return <Loading />;

  const own = f.images?.length ? f.images : [];
  const shots = own.length ? own : (society.photos ?? []);
  const furn = { "Fully Furnished": "Furnished", "Semi Furnished": "Semi-furnished" }[f.furnishing] || f.furnishing;
  const publicLink = `${SITE}/building/${society.code}`;

  const setOccupancy = async (occ) => {
    setBusy(true);
    try {
      await saveSocietyFlat({
        property_id: f.property_id, block: f.block, flat_no: f.flat_no, bhk: f.bhk, rent: String(Math.round(f.rent)), furnishing: f.furnishing,
        occupancy: occ, owner_name: f.owner_name, owner_phone: f.owner_phone, notes: f.notes, area_sqft: f.area_sqft ? String(f.area_sqft) : "",
        date: occ === "available" ? new Date().toISOString().slice(0, 10) : "", images: f.images ?? [], confirm_available: occ === "available",
      });
      toast(occ === "available" ? `${f.label} is available${society.status === "approved" ? " — live on MovEazy" : ""}` : `${f.label} marked occupied`);
      setConfirm(null);
      await load();
      reload();
    } catch (e) {
      toast(societyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `${f.bhk} for rent in ${society.name}, ${society.area} — ${rupees(f.rent)}/month`;
    try {
      if (navigator.share) await navigator.share({ title: text, text, url: publicLink });
      else { await navigator.clipboard.writeText(`${text}\n${publicLink}`); toast("Link copied"); }
    } catch { /* closed */ }
  };

  return (
    <div className="fd">
      <style>{CSS}</style>
      <div className="fd-hero">
        <div className="fd-strip" ref={strip} onScroll={() => { const el = strip.current; if (el) setShot(Math.round(el.scrollLeft / el.clientWidth)); }}>
          {shots.length ? shots.map((u) => <img key={u} src={u} alt="" />) : <div className="fd-noimg">No photos yet</div>}
        </div>
        <div className="fd-bar">
          <button type="button" className="fd-round" onClick={() => navigate(sp("/flats"))} aria-label="Back"><ArrowLeft size={22} /></button>
          <span style={{ display: "flex", gap: 8 }}>
            {f.live && <button type="button" className="fd-round" onClick={share} aria-label="Share"><Share2 size={19} /></button>}
            <button type="button" className="fd-round" onClick={() => setMenu(true)} aria-label="More"><MoreVertical size={20} /></button>
          </span>
        </div>
        <span className="fd-status">{f.occupancy === "occupied" ? <StatusPill occupancy="occupied" /> : <span className="sx-pill"><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Available</span>}</span>
        {!own.length && shots.length > 0 && <span className="fd-tag">Society photos · flat photos coming soon</span>}
        {shots.length > 1 && <span className="fd-count">{shot + 1}/{shots.length}</span>}
      </div>

      <div className="sx-page" style={{ paddingTop: 14 }}>
        {state?.added && <div className="sx-banner sx-banner--mint" style={{ marginTop: 0, marginBottom: 12 }}><CheckCircle2 size={18} />
          <span><b>Flat added.</b> {f.live ? "It's live on moveazy.co.in." : f.occupancy === "occupied" ? "Saved as occupied — not shown to tenants." : "It goes live once MovEazy approves your society."}</span></div>}
        <h1 className="fd-title">{f.label}</h1>
        <p className="fd-sub">{[f.block, society.name].filter(Boolean).join(" • ")}</p>
        <div className="fd-facts">
          <span><BedDouble size={18} /> {f.bhk}</span>
          {f.area_sqft ? <span><Ruler size={17} /> {Number(f.area_sqft).toLocaleString("en-IN")} sq ft</span> : null}
          <span><Sofa size={18} /> {furn}</span>
        </div>

        <div className="sx-card fd-rent">
          <span>Expected Rent</span>
          <b>{rupees(f.rent)} <em>/ month</em></b>
          {f.occupancy === "occupied" && f.move_out_date && <small>Expected move-out: {dayLabel(f.move_out_date)}</small>}
          {f.occupancy === "available" && f.available_from && <small>Available from {dayLabel(f.available_from)}</small>}
        </div>

        <h2 className="sx-h2">Owner Details</h2>
        <div className="sx-card fd-owner">
          <Avatar name={f.owner_name} size={48} />
          <span><b>{f.owner_name}</b><em>+91 {String(f.owner_phone).replace(/(\d{5})(\d{5})/, "$1 $2")}</em></span>
          <a href={`tel:+91${f.owner_phone}`} className="fd-call" aria-label={`Call ${f.owner_name}`}><Phone size={20} /></a>
        </div>

        {f.notes && (<><h2 className="sx-h2">Notes</h2><p className="fd-notes">{f.notes}</p></>)}
        {f.live && <a className="fd-live" href={publicLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /> See it on moveazy.co.in</a>}
        <p className="fd-meta">Added by {f.created_by || "a member"} · {dayLabel(f.created_at)}
          {f.updated_by && f.updated_at !== f.created_at ? <><br />Last changed by {f.updated_by} · {dayLabel(f.updated_at)}</> : null}</p>
      </div>

      {menu && (
        <Sheet title={f.label} onClose={() => setMenu(false)}>
          <button type="button" className="fd-menu" onClick={() => navigate(sp(`/flats/${f.property_id}/edit`))}><Pencil size={19} /> Edit details</button>
          {f.occupancy === "available"
            ? <button type="button" className="fd-menu" onClick={() => { setMenu(false); setConfirm("occupied"); }}>Mark occupied</button>
            : <button type="button" className="fd-menu" onClick={() => { setMenu(false); setConfirm("available"); }}>Mark available</button>}
        </Sheet>
      )}
      {confirm && (
        <Sheet title={confirm === "available" ? "Is it free to rent now?" : "Mark it occupied?"} onClose={() => setConfirm(null)}>
          <p className="sx-sub">{confirm === "available"
            ? `${f.label} will go live on moveazy.co.in and MovEazy will start sending tenants.`
            : `${f.label} comes off moveazy.co.in. You can make it available again any time.`}</p>
          <button type="button" className="sx-btn" style={{ marginTop: 16 }} disabled={busy} onClick={() => setOccupancy(confirm)}>
            {busy ? "Saving…" : confirm === "available" ? "Yes, it's available" : "Mark occupied"}
          </button>
          <button type="button" className="sx-btn sx-btn--ghost" style={{ marginTop: 10 }} onClick={() => setConfirm(null)}>Cancel</button>
        </Sheet>
      )}
    </div>
  );
}

const CSS = `
.fd { padding-bottom: 40px; }
.fd-hero { position: relative; max-width: 520px; margin: 0 auto; background: #E9E3D3; }
.fd-strip { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; aspect-ratio: 4 / 3; }
.fd-strip::-webkit-scrollbar { display: none; }
.fd-strip img { flex: 0 0 100%; width: 100%; height: 100%; object-fit: cover; scroll-snap-align: start; }
.fd-noimg { flex: 1; display: grid; place-items: center; color: #8C8473; font-weight: 700; }
.fd-bar { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; }
.fd-round { width: 42px; height: 42px; border-radius: 99px; border: 0; background: rgba(255,255,255,.92); display: grid; place-items: center; cursor: pointer; color: var(--ink); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
.fd-status { position: absolute; left: 14px; bottom: 14px; }
.fd-status .sx-pill { box-shadow: 0 4px 12px rgba(0,0,0,.12); padding: 5px 12px; font-size: 13.5px; }
.fd-tag { position: absolute; right: 12px; bottom: 14px; background: rgba(0,0,0,.6); color: #fff; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 99px; }
.fd-count { position: absolute; right: 12px; top: 64px; background: rgba(0,0,0,.55); color: #fff; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 99px; }
.fd-title { font-size: 30px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
.fd-sub { color: var(--dim); margin: 2px 0 0; }
.fd-facts { display: flex; flex-wrap: wrap; gap: 18px; margin: 14px 0 4px; color: #3D4A45; font-size: 15px; }
.fd-facts span { display: inline-flex; align-items: center; gap: 6px; }
.fd-facts svg { color: #7C8782; }
.fd-rent { padding: 14px 16px; margin-top: 14px; display: flex; flex-direction: column; gap: 2px; }
.fd-rent span { color: var(--dim); font-size: 14px; }
.fd-rent b { font-size: 28px; letter-spacing: -0.01em; }
.fd-rent em { font-style: normal; font-size: 16px; color: var(--em); font-weight: 600; }
.fd-rent small { color: var(--dim); font-size: 13px; }
.fd-owner { display: flex; align-items: center; gap: 14px; padding: 14px; }
.fd-owner > span:not(.sx-avatar) { flex: 1; min-width: 0; }
.fd-owner b { display: block; font-size: 16.5px; }
.fd-owner em { font-style: normal; color: var(--dim); font-size: 14.5px; }
.fd-call { width: 46px; height: 46px; border-radius: 99px; background: var(--mint); color: var(--em); display: grid; place-items: center; }
.fd-notes { margin: 0; color: #3D4A45; line-height: 1.5; white-space: pre-line; }
.fd-live { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; color: var(--em); font-weight: 700; text-decoration: none; }
.fd-meta { color: #8A928E; font-size: 13px; margin-top: 18px; line-height: 1.5; }
.fd-menu { width: 100%; display: flex; align-items: center; gap: 12px; padding: 16px 4px; border: 0; border-bottom: 1px solid var(--line); background: none; font-size: 16.5px; font-weight: 600; color: var(--ink); cursor: pointer; text-align: left; }
`;
