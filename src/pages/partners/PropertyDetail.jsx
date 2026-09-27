/**
 * PRD 03 — the operational property screen: what, where, how much, the
 * brokerage, and who to call. Contacts come from partner_property_contacts_for(),
 * which answers nothing for a listing the caller may not see or has not unlocked.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Calendar, ChevronRight, Crown, ExternalLink, Heart, Lock, MapPin, MoreVertical, Pencil, Phone, Share2, Users,
} from "lucide-react";
import { usePartner } from "./PartnerApp";
import ShareSheet from "./ShareSheet";
import { MediaItem, listingMedia } from "./partnerMedia";
import { Avatar, BrokeragePill, Empty, Loading, Sheet, TopBar, WhatsAppIcon, sourceLabel, toast } from "./partnerUi";
import {
  bhkLabel, customerMessage, fetchPropertyContacts, friendlyError, inr, partnerPropertyLink, patchLead, pp,
  setListingStatus, waLink,
} from "../../lib/partners";
import { leadsForListing } from "../../lib/partnerMatch";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";

function mapsUrl(l) {
  if (Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)) && l.latitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.full_address, l.area, "Bengaluru"].filter(Boolean).join(", "))}`;
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inventory, byId, saved, toggleSave, leads, setLeads, groups, reloadInventory } = usePartner();
  const l = byId.get(id);
  const [share, setShare] = useState(false);
  const [menu, setMenu] = useState(false);
  const [contacts, setContacts] = useState(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!l || l.locked) { setContacts([]); return; }
    fetchPropertyContacts(id).then(setContacts, () => setContacts([]));
  }, [id, l]);

  const matching = useMemo(() => (l ? leadsForListing(l, leads).slice(0, 5) : []), [l, leads]);
  const media = l ? listingMedia(l) : [];

  if (!inventory) return <Loading />;
  if (!l) {
    return (
      <>
        <TopBar title="Property" back />
        <Empty action={<Link to={pp("/")} className="pz-btn pz-btn--primary">Back to inventory</Link>}>
          This property isn't available to you — it may have been rented, or it's shared in a group you're not in.
        </Empty>
      </>
    );
  }

  const mine = l.source === "mine";
  const groupNames = groups.filter((g) => l.group_ids.includes(g.id)).map((g) => g.name);
  const primary = contacts?.[0];

  const changeStatus = async (status) => {
    setMenu(false);
    try {
      await setListingStatus(l.property_id, status);
      await reloadInventory();
      toast(status === "published" ? "Listing is live" : `Marked ${status}`);
    } catch (e) {
      toast(friendlyError(e), "error");
    }
  };

  const sendToLead = async (lead) => {
    window.open(waLink(lead.phone, customerMessage(l, { leadName: lead.name })), "_blank", "noopener");
    try {
      const row = await patchLead(lead.id, { last_contacted_at: new Date().toISOString() });
      setLeads((ls) => ls.map((x) => (x.id === row.id ? row : x)));
    } catch { /* the send already happened; the timestamp is a nicety */ }
  };

  return (
    <>
      <TopBar back right={
        <div className="pz-row" style={{ gap: 0 }}>
          <button type="button" className="pz-iconbtn" aria-label={saved.has(id) ? "Remove from saved" : "Save"} onClick={() => toggleSave(id)}>
            <Heart size={21} fill={saved.has(id) ? "#DC2626" : "none"} color={saved.has(id) ? "#DC2626" : "currentColor"} />
          </button>
          <button type="button" className="pz-iconbtn" aria-label="More actions" onClick={() => setMenu(true)}><MoreVertical size={21} /></button>
        </div>
      }>
        <h1>Property</h1>
      </TopBar>

      <div style={{ position: "relative" }}>
        {media.length ? (
          <div className="pz-gallery" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {media.map((src) => <div key={src} className="pz-prop-img" style={{ aspectRatio: "auto" }}><MediaItem src={src} /></div>)}
          </div>
        ) : (
          <div className="pz-gallery" style={{ display: "grid", placeItems: "center", color: "#9CA3AF" }}>No photos yet</div>
        )}
        {media.length > 1 && (
          <span className="pz-pill" style={{ position: "absolute", right: 12, bottom: 12, background: "rgba(17,24,39,.75)", color: "#fff" }}>
            {slide + 1}/{media.length}
          </span>
        )}
      </div>

      <div className="pz-pad">
        <h2 style={{ fontSize: 21, margin: "4px 0 2px" }}>{bhkLabel(l)} in {l.area || "Bengaluru"}</h2>
        <div className="pz-rent">{inr(l.rent)} <small>/ month</small></div>
        <div className="pz-meta" style={{ margin: "2px 0 10px" }}>
          {[l.furnishing, l.property_type, Number(l.deposit) > 0 ? `Deposit ${inr(l.deposit)}` : ""].filter(Boolean).join(" • ")}
        </div>
        <div className="pz-chips" style={{ marginBottom: 12 }}>
          {l.status === "published"
            ? <span className="pz-pill pz-pill--solid">Available</span>
            : <span className="pz-pill pz-pill--grey" style={{ textTransform: "capitalize" }}>{l.status}</span>}
          <BrokeragePill listing={l} />
          {l.available_from && <span className="pz-pill pz-pill--grey"><Calendar size={12} /> From {new Date(l.available_from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
        </div>

        <div className="pz-actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <a className="pz-btn pz-wa" href={waLink("", customerMessage(l))} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp</a>
          <button type="button" className="pz-btn" onClick={() => setShare(true)}><Share2 size={17} /> Share</button>
        </div>

        {l.locked ? (
          <Link to={pp("/premium")} className="pz-lockbar" style={{ textDecoration: "none", marginBottom: 12 }}>
            <Lock size={18} />
            <span style={{ flex: 1 }}><strong>Address and owner contact are locked.</strong><br />Go Premium to unlock 1000+ listings and keep 100% brokerage.</span>
            <ChevronRight size={18} />
          </Link>
        ) : (
          <a className="pz-section pz-row" href={mapsUrl(l)} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
            <MapPin size={20} color="var(--g)" />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontWeight: 600 }}>{[l.full_address, l.area].filter(Boolean).join(", ") || l.area}</span>
              <span style={{ color: "var(--g)", fontSize: 13, fontWeight: 600 }}>Open in Maps</span>
            </span>
            <ChevronRight size={18} color="#9CA3AF" />
          </a>
        )}

        <div className="pz-section">
          <h2>Contacts
            {!l.locked && <Link to={pp(`/property/${id}/contacts`)} className="pz-btn pz-btn--ghost">View all</Link>}
          </h2>
          {l.locked ? (
            <Link to={pp("/premium")} className="pz-btn pz-btn--primary" style={{ width: "100%" }}><Crown size={16} /> Unlock with Premium</Link>
          ) : contacts === null ? (
            <span className="pz-meta">Loading…</span>
          ) : primary ? (
            <div className="pz-row">
              <Avatar name={primary.name} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block" }}>{primary.name || primary.label}</strong>
                <span className="pz-meta">{primary.label}{primary.phone ? ` · ${primary.phone}` : ""}</span>
              </span>
              {primary.phone && <a className="pz-iconbtn" href={`tel:${primary.phone}`} aria-label="Call"><Phone size={19} color="var(--g)" /></a>}
              {primary.phone && <a className="pz-iconbtn" href={waLink(primary.phone, `Hi, about ${bhkLabel(l)} in ${l.area} (${l.property_id}) on MovEazy — is it still available?`)}
                target="_blank" rel="noreferrer" aria-label="WhatsApp"><WhatsAppIcon color="#16A34A" size={20} /></a>}
            </div>
          ) : (
            <span className="pz-meta">No contact on file for this listing.</span>
          )}
          <p className="pz-hint" style={{ margin: "10px 0 0" }}>Source: {sourceLabel(l)}{groupNames.length ? ` · Shared in ${groupNames.join(", ")}` : ""}</p>
        </div>

        {l.description && (
          <div className="pz-section">
            <h2>Description</h2>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "#374151", whiteSpace: "pre-wrap" }}>{l.description}</p>
          </div>
        )}

        {(l.amenities ?? []).length > 0 && (
          <div className="pz-section">
            <h2>Amenities</h2>
            <div className="pz-chips">{l.amenities.map((a) => <span key={a} className="pz-pill pz-pill--grey">{a}</span>)}</div>
          </div>
        )}

        <div className="pz-section">
          <h2><span className="pz-row" style={{ gap: 6 }}><Users size={17} /> Matching leads</span>
            <span className="pz-meta">{matching.length}</span></h2>
          {matching.length === 0 ? (
            <span className="pz-meta">None of your active leads fits this flat yet.</span>
          ) : matching.map((m) => (
            <div key={m.lead.id} className="pz-row" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
              <span className="pz-score">{m.score}</span>
              <Link to={pp(`/leads/${m.lead.id}`)} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
                <strong style={{ display: "block" }}>{m.lead.name}</strong>
                <span className="pz-meta">{m.reasons.slice(0, 3).join(" · ")}</span>
              </Link>
              <button type="button" className="pz-iconbtn" aria-label={`Send to ${m.lead.name} on WhatsApp`} onClick={() => sendToLead(m.lead)}>
                <WhatsAppIcon color="#16A34A" size={21} />
              </button>
            </div>
          ))}
        </div>
        <p className="pz-hint" style={{ textAlign: "center" }}>{l.property_id}</p>
      </div>

      {share && <ShareSheet listing={l} onClose={() => setShare(false)} />}
      {menu && (
        <Sheet title="Property actions" onClose={() => setMenu(false)}>
          {mine && (
            <button type="button" className="pz-menurow" onClick={() => navigate(pp(`/property/${id}/sharing`))}>
              <Pencil size={18} /> <span>Edit sharing, brokerage & contacts</span>
            </button>
          )}
          {mine && l.status !== "rented" && (
            <button type="button" className="pz-menurow" onClick={() => changeStatus("rented")}>Mark as rented</button>
          )}
          {mine && l.status === "published" && (
            <button type="button" className="pz-menurow" onClick={() => changeStatus("paused")}>Pause listing</button>
          )}
          {mine && l.status !== "published" && (
            <button type="button" className="pz-menurow" onClick={() => changeStatus("published")}>Make it live again</button>
          )}
          <a className="pz-menurow" href={partnerPropertyLink(id, "open")} target="_blank" rel="noreferrer">
            <ExternalLink size={18} /> <span>Open public page</span>
          </a>
          {!mine && (
            <a className="pz-menurow" target="_blank" rel="noreferrer"
              href={`${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(`Reporting ${id} on MovEazy Partners — duplicate / no longer available / wrong details:`)}`}>
              Report duplicate or wrong details
            </a>
          )}
        </Sheet>
      )}
    </>
  );
}
