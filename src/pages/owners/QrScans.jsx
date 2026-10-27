/**
 * QR scans — every open of the owner's flats' and buildings' pages, from the
 * QR on the door or a shared link (owner_qr_overview.sql): the total and this
 * week, how many of those people gave their contact or booked a visit, how
 * many MovEazy tenants match the flats on rent (a count — lib/ownerMatches.js),
 * each property's numbers, and the people themselves: tap one for their
 * mobile, profile and what they opened.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Building2, CalendarCheck, ChevronRight, GraduationCap, Link as LinkIcon, Mail, MessageSquareText, Phone, QrCode, ScanLine, Users } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Chip, Empty, Loading, Pill, Sheet, TopBar, WhatsAppIcon } from "./ownerUi";
import { fetchQrOverview } from "../../lib/flatInsights";
import { callFeedbackLabel } from "../../lib/buildings";
import { countMatchingTenants } from "../../lib/ownerMatches";
import { cleanLinkedIn, fmtDateTime, occupancyOf, op, propertyName, relTime, telLink, waLink } from "../../lib/owners";

const fmt = (n) => (Number(n) || 0).toLocaleString("en-IN");
const times = (n) => (Number(n) > 1 ? ` · ${fmt(n)}×` : "");
/** What someone did on one page: opened it, called from it (Call Caretaker), asked to visit. */
function placeDid(x) {
  const called = (x.called ?? []).map((t) => (t === "manager" ? "the property manager" : "the caretaker"));
  const bits = [
    x.hits > 0 ? `Opened ${fmt(x.hits)}×` : "",
    called.length ? `Called ${called.join(" and ")}` : "",
    x.visit ? (x.hits > 0 || called.length ? "booked a visit" : "Asked to visit") : "",
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Asked for the caretaker's number";
}

export default function QrScans() {
  const { properties, tenants, byId } = useOwner();
  const [d, setD] = useState(undefined);
  const [matches, setMatches] = useState(null);
  const [only, setOnly] = useState("all");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetchQrOverview().then((r) => setD(r || null), () => setD(null));
  }, []);
  const onRent = useMemo(() => (properties ?? []).filter((p) => occupancyOf(p, tenants) !== "occupied"), [properties, tenants]);
  useEffect(() => {
    if (!properties) return;
    let live = true;
    countMatchingTenants(onRent).then((m) => live && setMatches(m), () => {});
    return () => { live = false; };
  }, [properties, onRent]);

  const buildingNames = useMemo(() => new Map((d?.by_place ?? []).filter((p) => p.kind === "building").map((p) => [p.ref, p.name])), [d]);
  const placeName = (kind, ref) => kind === "building"
    ? buildingNames.get(ref) || "Your building"
    : byId.get(ref) ? propertyName(byId.get(ref)) : ref;

  if (d === undefined || !properties) return <><TopBar title="QR scans" back={op("/")} /><Loading /></>;
  if (!d) return <><TopBar title="QR scans" back={op("/")} /><Empty>Couldn't load your scans. Try again in a moment.</Empty></>;

  const people = (d.list ?? []).filter((p) => only === "all" || p.visit);
  const places = d.by_place ?? [];

  return (
    <>
      <TopBar title="QR scans" back={op("/")} />
      <style>{CSS}</style>
      <div className="oz-pad">
        <section className="oz-hero" style={{ marginBottom: 14 }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--champ)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <ScanLine size={15} /> Scans of your QR codes and links
            </div>
            <div className="qs-big"><b>{fmt(d.scans)}</b>{d.week > 0 && <span>+{fmt(d.week)} this week</span>}</div>
            <div className="qs-tiles">
              <div><Users size={15} /><b>{fmt(d.people)}</b><span>Gave contact</span></div>
              <div><CalendarCheck size={15} /><b>{fmt(d.visited)}</b><span>Booked a visit</span></div>
              <div><Users size={15} /><b>{matches ? fmt(matches.total) : "…"}</b><span>Matching tenants</span></div>
            </div>
          </div>
        </section>
        <p className="oz-hint" style={{ margin: "0 2px 16px" }}>
          Every scan and link open counts. Matching tenants are people on MovEazy whose search fits a flat you have on rent; their
          details stay private.
        </p>

        <h2 className="oz-h2">By property</h2>
        {places.length === 0 ? <Empty icon={<QrCode size={24} />}>No flats or buildings yet.</Empty> : (
          <div className="oz-card" style={{ marginBottom: 8 }}>
            {places.map((p) => {
              const m = p.kind === "flat" ? matches?.byProperty.get(p.ref) : null;
              return (
                <Link key={`${p.kind}-${p.ref}`} className="oz-menurow"
                  to={p.kind === "building" ? op(`/buildings/${p.ref}`) : op(`/properties/${p.ref}/leads`)}>
                  <span className="oz-avatar" style={{ background: "var(--champ2)", color: "var(--champ3)" }}>
                    {p.kind === "building" ? <Building2 size={18} /> : <QrCode size={18} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontWeight: 600 }}>{placeName(p.kind, p.ref)}</strong>
                    <span className="oz-sub">
                      {fmt(p.week)} this week · {fmt(p.people)} gave contact{m != null ? ` · ${fmt(m)} matching` : ""}
                    </span>
                  </span>
                  <span className="qs-count">{fmt(p.scans)}<small>scans</small></span>
                  <ChevronRight size={18} color="#94A09B" />
                </Link>
              );
            })}
          </div>
        )}
        <Link to={op("/rent-dashboard")} className="oz-btn oz-btn--ghost" style={{ marginBottom: 18 }}>
          <QrCode size={16} /> QR posters for your flats <ChevronRight size={16} />
        </Link>

        <div className="oz-between" style={{ marginBottom: 10 }}>
          <h2 className="oz-h2" style={{ margin: 0 }}>People who gave contact</h2>
          <span className="oz-meta">{fmt(d.people)}</span>
        </div>
        <div className="oz-row" style={{ gap: 6, marginBottom: 10 }}>
          <Chip on={only === "all"} onClick={() => setOnly("all")}>All</Chip>
          <Chip on={only === "visit"} onClick={() => setOnly("visit")}>Booked a visit</Chip>
        </div>
        {people.length === 0 ? (
          <Empty icon={<Users size={24} />}>
            {only === "visit" ? "No visits booked yet." : "No one yet. When someone scans your QR and signs in or books a visit, they show up here."}
          </Empty>
        ) : (
          <div className="oz-card">
            {people.map((p) => {
              const last = p.places?.[0];
              return (
                <button key={p.key} type="button" className="oz-menurow qs-person" onClick={() => setOpen(p)}>
                  <Avatar name={p.name || "Renter"} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontWeight: 600 }}>{p.name || "Renter"}</strong>
                    <span className="oz-sub">
                      {last ? `${placeName(last.kind, last.ref)}${times(last.hits)} · ` : ""}{relTime(p.at)}
                    </span>
                  </span>
                  {(p.feedback ?? []).some((f) => f.kind === "pay_token") ? <Pill tone="amber">Pay Token</Pill>
                    : p.visit ? <Pill tone="green">Visit</Pill> : null}
                  <ChevronRight size={18} color="#94A09B" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open && <PersonSheet p={open} placeName={placeName} onClose={() => setOpen(null)} />}
    </>
  );
}

function PersonSheet({ p, placeName, onClose }) {
  const pr = p.profile || {};
  const linkedin = cleanLinkedIn(pr.linkedin);
  const work = [pr.company, pr.past_company ? `before: ${pr.past_company}` : pr.first_job ? "first job" : ""].filter(Boolean).join(" · ");
  const study = [pr.college, pr.graduation_year].filter(Boolean).join(", ");
  const hasProfile = Boolean(work || study || linkedin || pr.in_bangalore_since || pr.score);
  return (
    <Sheet title={p.name || "Renter"} onClose={onClose}>
      <div className="oz-pad">
        {p.phone ? (
          <>
            <div className="qs-line"><Phone size={16} /><span>{p.phone}</span></div>
            <div className="oz-grid2" style={{ margin: "10px 0 6px" }}>
              <a className="oz-btn oz-btn--primary" href={telLink(p.phone)}><Phone size={16} /> Call</a>
              <a className="oz-btn" href={waLink(p.phone, `Hi ${String(p.name || "").split(" ")[0]}, I'm the owner of the flat you looked at on MovEazy.`)}
                target="_blank" rel="noreferrer"><WhatsAppIcon size={16} color="#25D366" /> WhatsApp</a>
            </div>
          </>
        ) : <p className="oz-meta" style={{ margin: "0 0 6px" }}>No mobile number on their account yet.</p>}
        {p.email && <div className="qs-line"><Mail size={16} /><a href={`mailto:${p.email}`}>{p.email}</a></div>}

        {hasProfile && (
          <>
            <h3 className="qs-h3">Profile</h3>
            {work && <div className="qs-line"><Briefcase size={16} /><span>{work}</span></div>}
            {study && <div className="qs-line"><GraduationCap size={16} /><span>{study}</span></div>}
            {pr.in_bangalore_since && <div className="qs-line"><Building2 size={16} /><span>In Bangalore since {pr.in_bangalore_since}</span></div>}
            {linkedin && <div className="qs-line"><LinkIcon size={16} /><a href={linkedin} target="_blank" rel="noreferrer">LinkedIn profile</a></div>}
            {pr.score > 0 && <div className="qs-line"><span className="qs-score">{pr.score}</span><span>MovEazy tenant score</span></div>}
          </>
        )}

        {(p.feedback ?? []).length > 0 && (
          <>
            <h3 className="qs-h3">What they said after calling</h3>
            {p.feedback.map((f, k) => (
              <div key={k} className="qs-line" style={{ alignItems: "flex-start" }}>
                <MessageSquareText size={16} />
                <span style={{ flex: 1 }}>
                  <strong style={{ fontWeight: 600 }}>{callFeedbackLabel(f.kind)}</strong>
                  <span className="oz-sub">{f.note ? `"${f.note}" · ` : ""}{fmtDateTime(f.at)}</span>
                </span>
              </div>
            ))}
          </>
        )}

        <h3 className="qs-h3">What they opened</h3>
        {(p.places ?? []).map((x) => (
          <div key={`${x.kind}-${x.ref}`} className="qs-line" style={{ alignItems: "flex-start" }}>
            {x.kind === "building" ? <Building2 size={16} /> : <QrCode size={16} />}
            <span style={{ flex: 1 }}>
              <strong style={{ fontWeight: 600 }}>{placeName(x.kind, x.ref)}</strong>
              <span className="oz-sub">
                {placeDid(x)} · {fmtDateTime(x.at)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

const CSS = `
.qs-big{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:6px 0 12px}
.qs-big b{font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1}
.qs-big span{font-size:13px;font-weight:700;color:var(--champ)}
.qs-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.qs-tiles>div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;gap:3px}
.qs-tiles svg{color:var(--champ)}
.qs-tiles b{font-size:19px;font-weight:800}
.qs-tiles span{font-size:11.5px;opacity:.85;line-height:1.25}
.qs-count{display:flex;flex-direction:column;align-items:flex-end;font-weight:800;font-size:16px;line-height:1.1;margin-right:2px}
.qs-count small{font-size:10.5px;font-weight:600;color:var(--mute)}
.qs-person{width:100%;background:none;border:0;font:inherit;text-align:left;cursor:pointer;color:inherit}
.qs-line{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:14px;color:var(--ink);word-break:break-word}
.qs-line>svg{flex:none;color:var(--dim)}
.qs-line a{color:var(--em);font-weight:600}
.qs-h3{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:16px 0 4px}
.qs-score{flex:none;min-width:30px;height:24px;border-radius:99px;background:var(--emt);color:var(--em);font-weight:800;font-size:12.5px;display:grid;place-items:center;padding:0 6px}
`;
