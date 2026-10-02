/**
 * One building, for its owner: the QR funnel (scans → numbers → visits asked →
 * visits done → flats booked), the poster to print, every flat floor by
 * floor, and every visit. Renters appear by first name and initial — their
 * numbers go to the MovEazy partner and the CRM, never here
 * (owner_building_detail in owner_buildings.sql).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck, CalendarCheck, Check, ChevronRight, Copy, Download, ExternalLink, Eye, KeyRound, Layers, MapPin, Pencil, Phone,
  Plus, QrCode, ScanLine, ShieldCheck, Smartphone, UserCheck, X,
} from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Empty, Loading, Pill, Sheet, TopBar, WhatsAppIcon, toast } from "./ownerUi";
import { MediaItem, listingMedia } from "../partners/partnerMedia";
import {
  VISIT_STATUS, buildingDisplay, buildingUrl, fetchBuildingDetail, floorLabel, markFlatBooked, setFlatBuilding,
  updateBuildingLead, visitWhen,
} from "../../lib/buildings";
import { BUILDING_POSTER, drawPoster, loadImage, posterFontsReady, posterPdf } from "../../lib/qrPoster";
import { friendlyError, inr, op } from "../../lib/owners";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

const bhk = (f) => f?.flat_type || (f?.bedrooms ? `${f.bedrooms} BHK` : "Flat");
const FLOORS = [-1, ...Array.from({ length: 31 }, (_, i) => i)];

export default function BuildingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { properties, reloadProperties, reloadBuildings } = useOwner();
  const [d, setD] = useState(undefined);
  const [sheet, setSheet] = useState(null); // { kind: 'flat' | 'add' | 'visit', item }
  const [busy, setBusy] = useState(false);
  const [visitTab, setVisitTab] = useState("upcoming");

  const load = useCallback(async () => {
    try { setD((await fetchBuildingDetail(id)) || null); } catch { setD(null); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const flats = useMemo(() => d?.flats ?? [], [d]);
  const booked = useMemo(() => new Set(d?.booked ?? []), [d]);
  const flatById = useMemo(() => new Map(flats.map((f) => [f.property_id, f])), [flats]);
  const loose = (properties ?? []).filter((p) => !p.building_id);

  const act = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([load(), reloadProperties(), reloadBuildings()]);
      if (ok) toast(ok);
      setSheet(null);
    } catch (e) {
      toast(friendlyError(e, "Could not save that."), "error");
    } finally {
      setBusy(false);
    }
  };

  if (d === undefined) return <><TopBar title="Property" back={op("/properties")} /><Loading /></>;
  if (d === null) {
    return (
      <>
        <TopBar title="Property" back={op("/properties")} />
        <Empty action={<Link to={op("/properties")} className="oz-btn oz-btn--primary">Back to properties</Link>}>This property isn't in your account.</Empty>
      </>
    );
  }

  const s = d.stats || {};
  const leads = d.leads ?? [];
  const now = Date.now();
  const upcoming = leads.filter((l) => ["new", "confirmed"].includes(l.status) && (!l.visit_at || new Date(l.visit_at).getTime() > now - 3 * 3600e3));
  const shownLeads = visitTab === "upcoming" ? upcoming : leads;
  const cover = (d.photos ?? [])[0] || flats.flatMap((f) => listingMedia(f))[0];

  return (
    <>
      <TopBar title={d.name} back={op("/properties")} right={
        <Link to={op(`/buildings/${id}/edit`)} className="oz-iconbtn" aria-label="Edit property"><Pencil size={19} /></Link>
      } />
      <div className="oz-pad">
        <div className="bd-hero">
          {d.cover_video
            ? <video src={d.cover_video} autoPlay muted loop playsInline controls preload="metadata" poster={cover || undefined} />
            : cover ? <MediaItem src={cover} alt="" /> : <div className="bd-hero-none"><Layers size={34} /></div>}
          <div className="bd-hero-text">
            <b>{d.name}</b>
            <span><MapPin size={13} /> {[d.area, d.landmark].filter(Boolean).join(" · ") || "Bengaluru"}</span>
          </div>
          {d.status === "paused" && <span className="bd-paused">QR paused</span>}
        </div>
        <div className={`bd-partner${d.has_partner ? "" : " bd-partner--wait"}`}>
          <ShieldCheck size={17} />
          {d.has_partner
            ? "A MovEazy partner handles every visit request. Your number is never shown to tenants."
            : "MovEazy is assigning a partner to this property. Requests already reach our team."}
        </div>

        <Funnel s={s} byDay={d.by_day ?? []} />

        <PosterCard d={d} available={flats.filter((f) => f.available).length} flats={flats} />

        <div className="oz-section">
          <h2 className="oz-h2">
            <span><Layers size={17} style={{ verticalAlign: -3, color: "var(--em)" }} /> Flats · {flats.length}</span>
            <button type="button" className="oz-btn oz-btn--soft oz-btn--sm" onClick={() => setSheet({ kind: "add" })}><Plus size={15} /> Add flat</button>
          </h2>
          {flats.length === 0 ? (
            <Empty>Add the flats in this property — each one shows on the QR page, in the order MovEazy sets.</Empty>
          ) : (
            <div className="bd-floor">
              <div className="bd-floor-h">In the order tenants see them<span>{flats.filter((f) => f.available).length}/{flats.length} available</span></div>
              {flats.map((f) => (
                <button key={f.property_id} type="button" className="bd-flat" onClick={() => setSheet({ kind: "flat", item: f })}>
                  <div className="bd-flat-img">{listingMedia(f)[0] ? <MediaItem src={listingMedia(f)[0]} alt="" /> : <KeyRound size={20} />}</div>
                  <div className="bd-flat-body">
                    <b>{f.unit_no ? `Flat ${f.unit_no} · ` : ""}{bhk(f)}{f.furnishing && !f.unit_no ? <span> · {f.furnishing}</span> : null}</b>
                    <div className="oz-rent">{f.rent ? inr(f.rent) : "—"} <small>/ month · {floorLabel(f.floor_number)}</small></div>
                  </div>
                  {booked.has(f.property_id) ? <Pill tone="champ">Booked</Pill> : f.available ? <Pill tone="green">Available</Pill> : <Pill tone="grey">Occupied</Pill>}
                  <ChevronRight size={18} color="#94A09B" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="oz-section">
          <h2 className="oz-h2"><span><CalendarCheck size={17} style={{ verticalAlign: -3, color: "var(--em)" }} /> Visits</span></h2>
          <div className="oz-chips" style={{ marginBottom: 10 }}>
            <button type="button" className={`oz-chip${visitTab === "upcoming" ? " oz-chip--on" : ""}`} onClick={() => setVisitTab("upcoming")}>Upcoming ({upcoming.length})</button>
            <button type="button" className={`oz-chip${visitTab === "all" ? " oz-chip--on" : ""}`} onClick={() => setVisitTab("all")}>All ({leads.length})</button>
          </div>
          {shownLeads.length === 0 ? (
            <div className="oz-meta" style={{ padding: "8px 2px" }}>
              {leads.length === 0 ? "No visit requests yet. Paste the QR poster at the gate and in the lift — scans start showing up here." : "Nothing upcoming."}
            </div>
          ) : shownLeads.map((l) => {
            const st = VISIT_STATUS[l.status] || VISIT_STATUS.new;
            return (
              <button key={l.id} type="button" className="bd-visit" onClick={() => setSheet({ kind: "visit", item: l })}>
                <Avatar name={l.name} />
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <b>{l.name || "A tenant"}</b>
                  <div className="oz-meta">{visitWhen(l.visit_at)}</div>
                  {(l.property_ids ?? []).length > 0 && (
                    <div className="oz-meta" style={{ fontSize: 12 }}>
                      {(l.property_ids ?? []).map((pid) => flatById.get(pid)).filter(Boolean).map((f) => `${bhk(f)} ${f.floor_number != null ? `(${floorLabel(f.floor_number).replace(" floor", "")})` : ""}`).join(", ")}
                    </div>
                  )}
                </div>
                <Pill tone={st.tone}>{st.label}</Pill>
              </button>
            );
          })}
          <p className="oz-hint" style={{ marginTop: 10 }}><Phone size={12} style={{ verticalAlign: -2 }} /> The partner calls each tenant to confirm the time. Mark how a visit went so your numbers stay right.</p>
        </div>
      </div>

      {sheet?.kind === "flat" && (
        <FlatSheet flat={sheet.item} booked={booked.has(sheet.item.property_id)} busy={busy} onClose={() => setSheet(null)}
          onOpen={() => navigate(op(`/properties/${sheet.item.property_id}`))}
          onFloor={(fl) => act(() => setFlatBuilding(sheet.item.property_id, id, fl), "Floor updated")}
          onBooked={(on) => act(() => markFlatBooked(sheet.item.property_id, on), on ? "Marked booked" : "Back to available")}
          onRemove={() => act(() => setFlatBuilding(sheet.item.property_id, null), "Removed from this property")} />
      )}
      {sheet?.kind === "add" && (
        <AddFlatSheet buildingId={id} loose={loose} busy={busy} onClose={() => setSheet(null)}
          onNew={() => navigate(op(`/properties/new?building=${id}`))}
          onAdd={(pid, fl) => act(() => setFlatBuilding(pid, id, fl), "Flat added")} />
      )}
      {sheet?.kind === "visit" && (
        <VisitSheet lead={sheet.item} flats={flats} busy={busy} onClose={() => setSheet(null)}
          onSet={(patch, ok) => act(() => updateBuildingLead(sheet.item.id, patch), ok)} />
      )}
      <style>{CSS}</style>
    </>
  );
}

function Funnel({ s, byDay }) {
  const steps = [
    { k: "scans", label: "Scanned the QR", icon: ScanLine },
    { k: "numbers", label: "Shared their mobile", icon: Smartphone },
    { k: "scheduled", label: "Scheduled a visit", icon: CalendarCheck },
    { k: "visited", label: "Visited", icon: UserCheck },
    { k: "booked", label: "Flats booked", icon: KeyRound },
  ];
  const max = Math.max(1, ...byDay.map((x) => Number(x.views) || 0));
  return (
    <div className="bd-funnel">
      <div className="bd-funnel-h">
        <b>Your QR at work</b>
        <span><Eye size={13} /> {Number(s.visitors) || 0} opened · {Number(s.upcoming) || 0} upcoming visit{Number(s.upcoming) === 1 ? "" : "s"}</span>
      </div>
      <div className="bd-steps">
        {steps.map(({ k, label, icon: Icon }, i) => {
          const v = Number(s[k]) || 0;
          const prev = i ? Number(s[steps[i - 1].k]) || 0 : 0;
          return (
            <div key={k} className="bd-step">
              <span className="ic"><Icon size={16} /></span>
              <b>{v}</b>
              <small>{label}</small>
              {i > 0 && prev > 0 && <em>{Math.min(100, Math.round((v / prev) * 100))}%</em>}
            </div>
          );
        })}
      </div>
      {byDay.length > 0 && (
        <div className="bd-chart" aria-label="Opens and QR scans, last 14 days">
          {byDay.map((x) => (
            <div key={x.day} title={`${x.day}: ${x.views} opened, ${x.scans} scanned`}>
              <i style={{ height: `${(Number(x.views) / max) * 100}%` }}><u style={{ height: `${Number(x.views) ? (Number(x.scans) / Number(x.views)) * 100 : 0}%` }} /></i>
            </div>
          ))}
        </div>
      )}
      <div className="bd-legend"><span><i className="a" /> QR scans</span><span><i className="b" /> Opened from a link</span><span>Last 14 days</span></div>
    </div>
  );
}

function PosterCard({ d, available, flats }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const url = buildingUrl(d.code, { qr: true });
  const link = buildingUrl(d.code);
  const rentFrom = useMemo(() => {
    const rents = flats.filter((f) => f.available).map((f) => Number(f.rent) || 0).filter(Boolean);
    return rents.length ? inr(Math.min(...rents)) : "";
  }, [flats]);

  const posterData = useCallback(async () => {
    const coverSrc = (d.photos ?? [])[0] || flats.flatMap((f) => listingMedia(f))[0] || "";
    const [photo, logo] = await Promise.all([loadImage(coverSrc), loadImage(logoOnDark), posterFontsReady()]);
    return {
      building: { name: d.name, area: d.area, landmark: d.landmark, available, rentFrom },
      url, displayUrl: buildingDisplay(d.code), photo, logo,
    };
  }, [d, flats, available, rentFrom, url]);

  useEffect(() => {
    let alive = true;
    posterData().then((data) => { if (alive && canvasRef.current) drawPoster(canvasRef.current, BUILDING_POSTER.id, data, 0.6); });
    return () => { alive = false; };
  }, [posterData]);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await posterPdf(BUILDING_POSTER.id, await posterData());
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `MovEazy-QR-${d.name.replace(/\W+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30000);
    } catch (e) {
      toast(friendlyError(e, "Could not make the PDF."), "error");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch { toast(link); }
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${d.name}${d.area ? `, ${d.area}` : ""} — see every flat and book a visit: ${link}`)}`;

  return (
    <div className="oz-section">
      <h2 className="oz-h2"><span><QrCode size={17} style={{ verticalAlign: -3, color: "var(--em)" }} /> QR poster</span><Pill tone="champ">A4</Pill></h2>
      <div className="bd-poster"><canvas ref={canvasRef} aria-label="Poster preview" /></div>
      <p className="oz-hint" style={{ margin: "10px 0 12px" }}>
        Print it and paste it at the gate, in the lift and at the nearest tea stall. Tenants see your flats and book a visit — your number is never on it.
      </p>
      <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={download} disabled={busy}>
        <Download size={18} /> {busy ? "Making the PDF…" : "Download A4 poster (PDF)"}
      </button>
      <div className="oz-grid3" style={{ marginTop: 10 }}>
        <a className="oz-btn oz-btn--soft" href={wa} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} /> Share</a>
        <button type="button" className="oz-btn oz-btn--soft" onClick={copy}><Copy size={16} /> Copy</button>
        <a className="oz-btn oz-btn--soft" href={link} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a>
      </div>
    </div>
  );
}

function FloorSelect({ value, onChange, id }) {
  return (
    <select id={id} className="oz-select" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
      <option value="">Pick the floor</option>
      {FLOORS.map((n) => <option key={n} value={n}>{floorLabel(n)}</option>)}
    </select>
  );
}

function FlatSheet({ flat, booked, busy, onClose, onOpen, onFloor, onBooked, onRemove }) {
  const [floor, setFloor] = useState(flat.floor_number ?? null);
  return (
    <Sheet title={`${bhk(flat)} · ${floorLabel(flat.floor_number)}`} onClose={onClose}>
      <div className="oz-pad">
        <div className="oz-meta" style={{ marginBottom: 12 }}>{flat.rent ? `${inr(flat.rent)} / month` : ""}{flat.furnishing ? ` · ${flat.furnishing}` : ""}</div>
        <label className="oz-label" htmlFor="fs-floor">Floor</label>
        <div className="oz-row" style={{ gap: 8 }}>
          <FloorSelect id="fs-floor" value={floor} onChange={setFloor} />
          <button type="button" className="oz-btn oz-btn--soft" disabled={busy || floor === (flat.floor_number ?? null)} onClick={() => onFloor(floor)}>Save</button>
        </div>
        <div className="oz-list" style={{ marginTop: 14 }}>
          <button type="button" className="oz-btn oz-btn--block" style={{ minHeight: 48, fontSize: 15 }} disabled={busy} onClick={() => onBooked(!booked)}>
            <KeyRound size={17} /> {booked ? "Mark as available again" : "Mark this flat booked"}
          </button>
          <button type="button" className="oz-btn oz-btn--block" style={{ minHeight: 48, fontSize: 15 }} onClick={onOpen}>
            <Pencil size={17} /> Edit flat, photos & tenants
          </button>
          <button type="button" className="oz-btn oz-btn--block oz-btn--danger" style={{ minHeight: 48, fontSize: 15 }} disabled={busy} onClick={onRemove}>
            <X size={17} /> Remove from this property
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function AddFlatSheet({ loose, busy, onClose, onNew, onAdd }) {
  const [pick, setPick] = useState("");
  const [floor, setFloor] = useState(null);
  return (
    <Sheet title="Add a flat" onClose={onClose}>
      <div className="oz-pad">
        <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={onNew}><Plus size={18} /> Add a new flat</button>
        {loose.length > 0 && (
          <>
            <div className="oz-label" style={{ margin: "18px 0 8px" }}>Or move one of your flats here</div>
            <div className="oz-list">
              {loose.map((p) => (
                <button key={p.property_id} type="button" className={`bd-pick${pick === p.property_id ? " on" : ""}`} onClick={() => setPick(p.property_id)}>
                  <span className="bd-radio">{pick === p.property_id && <Check size={13} />}</span>
                  <span style={{ flex: 1, textAlign: "left" }}><b>{bhk(p)} · {p.area}</b><br /><small className="oz-meta">{p.rent ? `${inr(p.rent)} / month` : ""} · {p.property_id}</small></span>
                </button>
              ))}
            </div>
            {pick && (
              <div style={{ marginTop: 12 }}>
                <label className="oz-label" htmlFor="af-floor">Which floor is it on?</label>
                <FloorSelect id="af-floor" value={floor} onChange={setFloor} />
                <button type="button" className="oz-btn oz-btn--primary oz-btn--block" style={{ marginTop: 12 }} disabled={busy || floor === null}
                  onClick={() => onAdd(pick, floor)}>{busy ? "Adding…" : "Add to this property"}</button>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function VisitSheet({ lead, flats, busy, onClose, onSet }) {
  const [bookFlat, setBookFlat] = useState((lead.property_ids ?? []).length === 1 ? lead.property_ids[0] : "");
  const [booking, setBooking] = useState(false);
  const options = flats.filter((f) => f.available || f.property_id === lead.booked_property);
  const st = VISIT_STATUS[lead.status] || VISIT_STATUS.new;
  return (
    <Sheet title={lead.name || "Visit"} onClose={onClose}>
      <div className="oz-pad">
        <div className="oz-between" style={{ marginBottom: 12 }}>
          <span className="oz-meta"><CalendarCheck size={14} style={{ verticalAlign: -2 }} /> {visitWhen(lead.visit_at)}</span>
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>
        {!booking ? (
          <>
            <div className="oz-label">How did it go?</div>
            <div className="oz-grid2">
              <button type="button" className="oz-btn" disabled={busy} onClick={() => onSet({ status: "visited" }, "Marked visited")}><BadgeCheck size={16} /> Visited</button>
              <button type="button" className="oz-btn" disabled={busy} onClick={() => onSet({ status: "no_show" }, "Marked as didn't come")}><X size={16} /> Didn't come</button>
              <button type="button" className="oz-btn oz-btn--champ" disabled={busy} onClick={() => setBooking(true)}><KeyRound size={16} /> Booked a flat</button>
              <button type="button" className="oz-btn oz-btn--danger" disabled={busy} onClick={() => onSet({ status: "cancelled" }, "Visit cancelled")}>Cancelled</button>
            </div>
            <p className="oz-hint" style={{ marginTop: 12 }}>The MovEazy partner confirms times and has the tenant's number — message MovEazy from More if anything needs changing.</p>
          </>
        ) : (
          <>
            <div className="oz-label">Which flat did they book?</div>
            <div className="oz-list">
              {options.map((f) => (
                <button key={f.property_id} type="button" className={`bd-pick${bookFlat === f.property_id ? " on" : ""}`} onClick={() => setBookFlat(f.property_id)}>
                  <span className="bd-radio">{bookFlat === f.property_id && <Check size={13} />}</span>
                  <span style={{ flex: 1, textAlign: "left" }}><b>{bhk(f)} · {floorLabel(f.floor_number)}</b><br /><small className="oz-meta">{f.rent ? `${inr(f.rent)} / month` : ""}</small></span>
                </button>
              ))}
            </div>
            <button type="button" className="oz-btn oz-btn--primary oz-btn--block" style={{ marginTop: 12 }} disabled={busy || !bookFlat}
              onClick={() => onSet({ status: "booked", booked_property: bookFlat }, "Booked — congratulations!")}>{busy ? "Saving…" : "Mark booked"}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

const CSS = `
.bd-hero { position: relative; aspect-ratio: 16/9; border-radius: 18px; overflow: hidden; background: #E9E4D6; }
.bd-hero img, .bd-hero video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.bd-hero-none { height: 100%; display: grid; place-items: center; color: var(--mute); }
.bd-hero-text { position: absolute; left: 0; right: 0; bottom: 0; padding: 30px 14px 12px; color: #fff;
  background: linear-gradient(180deg, rgba(4,41,31,0), rgba(4,41,31,.85)); }
.bd-hero-text b { display: block; font-size: 19px; }
.bd-hero-text span { display: flex; align-items: center; gap: 4px; font-size: 13px; opacity: .9; }
.bd-paused { position: absolute; right: 10px; top: 10px; background: var(--amberbg); color: var(--amber); font-size: 12px; font-weight: 700; border-radius: 99px; padding: 4px 10px; }
.bd-partner { display: flex; gap: 8px; align-items: flex-start; background: var(--emt); color: var(--deep); border-radius: 14px; padding: 11px 12px;
  font-size: 13px; line-height: 1.45; margin: 10px 0 12px; font-weight: 500; }
.bd-partner svg { flex: none; margin-top: 1px; color: var(--em); }
.bd-partner--wait { background: var(--champ2); color: var(--champ3); }
.bd-partner--wait svg { color: var(--champ3); }
.bd-funnel { background: radial-gradient(120% 140% at 100% 0%, #0E6A4F 0%, #063B2D 55%, #04291F 100%); color: #fff; border-radius: 20px; padding: 16px;
  margin-bottom: 12px; box-shadow: 0 12px 30px rgba(6,59,45,.22); }
.bd-funnel-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.bd-funnel-h b { font-size: 16px; }
.bd-funnel-h span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: rgba(255,255,255,.75); }
.bd-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 14px; }
.bd-step { position: relative; background: rgba(255,255,255,.07); border: 1px solid rgba(214,183,124,.28); border-radius: 14px; padding: 10px 4px 9px;
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; min-width: 0; }
.bd-step .ic { width: 30px; height: 30px; border-radius: 10px; background: var(--champ2); color: var(--deep); display: grid; place-items: center; }
.bd-step b { font-size: 21px; font-weight: 800; line-height: 1.1; }
.bd-step small { font-size: 10.5px; line-height: 1.25; color: rgba(255,255,255,.78); }
.bd-step em { position: absolute; top: -8px; left: -9px; font-style: normal; font-size: 10px; font-weight: 800; background: var(--champ); color: var(--deep);
  border-radius: 99px; padding: 1px 5px; z-index: 1; }
.bd-chart { display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px; align-items: end; height: 56px; margin-top: 14px; }
.bd-chart > div { height: 100%; display: flex; align-items: flex-end; }
.bd-chart i { display: flex; flex-direction: column; justify-content: flex-end; width: 100%; min-height: 3px; border-radius: 4px; background: rgba(255,255,255,.22); overflow: hidden; }
.bd-chart u { display: block; width: 100%; background: var(--champ); }
.bd-legend { display: flex; gap: 12px; font-size: 11px; color: rgba(255,255,255,.7); margin-top: 6px; }
.bd-legend span:last-child { margin-left: auto; }
.bd-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; }
.bd-legend i.a { background: var(--champ); }
.bd-legend i.b { background: rgba(255,255,255,.35); }
.bd-poster { display: grid; place-items: center; background: var(--cream); border-radius: 14px; padding: 14px; }
.bd-poster canvas { display: block; width: min(100%, 260px); height: auto; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.18); background: #fff; }
.bd-floor + .bd-floor { margin-top: 12px; }
.bd-floor-h { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--champ3); margin: 0 2px 6px; }
.bd-floor-h span { text-transform: none; letter-spacing: 0; font-weight: 500; color: var(--dim); }
.bd-flat { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid var(--line2); border-radius: 14px; background: #fff;
  font: inherit; color: inherit; cursor: pointer; text-align: left; height: 76px; }
.bd-flat + .bd-flat { margin-top: 8px; }
.bd-flat-img { width: 60px; height: 58px; border-radius: 10px; overflow: hidden; flex: none; background: #E9E4D6; display: grid; place-items: center; color: var(--mute); }
.bd-flat-img img, .bd-flat-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.bd-flat-body { flex: 1; min-width: 0; }
.bd-flat-body b { display: block; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bd-flat-body b span { font-weight: 500; color: var(--dim); font-size: 12.5px; }
.bd-visit { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 2px; border: 0; border-top: 1px solid var(--line2); background: transparent;
  font: inherit; color: inherit; cursor: pointer; }
.bd-visit:first-of-type { border-top: 0; }
.bd-visit b { font-size: 14.5px; }
.bd-pick { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1.5px solid var(--line2); border-radius: 12px; background: #fff;
  font: inherit; color: inherit; cursor: pointer; }
.bd-pick.on { border-color: var(--em); background: var(--emt); }
.bd-radio { width: 20px; height: 20px; border-radius: 99px; border: 1.5px solid var(--line); display: grid; place-items: center; flex: none; background: #fff; color: var(--em); }
.bd-pick.on .bd-radio { border-color: var(--em); }
`;
