/**
 * PRD 05 — the tenant profile: Profile / Documents / History. Payments from the
 * PRD are out of V1. Call, WhatsApp and email are hand-offs; nothing is sent
 * from here. The rating is the owner's own note — only they and MovEazy see it.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Mail, MoreHorizontal, Pencil, Phone, Trash2, UserMinus } from "lucide-react";
import { useOwner } from "./OwnerApp";
import { Avatar, Confirm, Empty, Loading, Pill, Sheet, Stars, TopBar, WhatsAppIcon, toast } from "./ownerUi";
import { DocumentList } from "./DocumentsPage";
import {
  fmtDate, friendlyError, op, patchTenant, propertyName, saveRating, telLink, updateProperty, waLink,
} from "../../lib/owners";
import { daysToLeaseEnd, isCurrentTenant, tenancyLength } from "../../lib/ownerOccupancy";

function RatingCard({ tenant }) {
  const { ratings, setRatings } = useOwner();
  const current = ratings[tenant.id];
  const [stars, setStars] = useState(current?.stars || 0);
  const [comment, setComment] = useState(current?.comment || "");
  const [saving, setSaving] = useState(false);
  const dirty = stars !== (current?.stars || 0) || comment !== (current?.comment || "");

  const save = async () => {
    if (!stars) return toast("Pick a star rating", "error");
    setSaving(true);
    try {
      const row = await saveRating(tenant.id, stars, comment);
      setRatings((r) => ({ ...r, [tenant.id]: row }));
      toast("Rating saved");
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oz-section" id="rate">
      <h2 className="oz-h2">Your rating</h2>
      <Stars value={stars} onChange={setStars} size={28} />
      <textarea className="oz-textarea" rows={2} style={{ marginTop: 10 }} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Pays on time, keeps the flat clean, easy to reach…" aria-label="Rating comment" />
      <div className="oz-between" style={{ marginTop: 8 }}>
        <span className="oz-hint">Private — only you and MovEazy see this.</span>
        <button type="button" className="oz-btn oz-btn--primary oz-btn--sm" onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

export default function TenantProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { tenants, setTenants, byId, ratings, requests, reloadProperties } = useOwner();
  const t = tenants.find((x) => x.id === id);
  const [tab, setTab] = useState("profile");
  const [menu, setMenu] = useState(false);
  const [moveOut, setMoveOut] = useState(false);
  const [outDate, setOutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hash === "#rate") setTimeout(() => document.getElementById("rate")?.scrollIntoView({ behavior: "smooth" }), 150);
  }, [hash, t]);

  const history = useMemo(() => {
    if (!t) return [];
    const ev = [];
    ev.push({ at: t.created_at, text: "Added to your records" });
    if (t.move_in_date) ev.push({ at: t.move_in_date, text: "Moved in" });
    for (const r of requests.filter((q) => q.property_id === t.property_id)) {
      const inTenancy = (!t.move_in_date || r.created_at >= t.move_in_date) && (!t.moved_out_on || r.created_at <= t.moved_out_on);
      if (inTenancy) ev.push({ at: r.created_at, text: `${r.title} requested` });
    }
    if (t.lease_end_date && !t.moved_out_on) {
      const d = daysToLeaseEnd(t);
      ev.push({ at: t.lease_end_date, text: d >= 0 ? `Lease ends (in ${d} days)` : "Lease end date passed", future: d >= 0 });
    }
    if (t.moved_out_on) ev.push({ at: t.moved_out_on, text: "Moved out" });
    return ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [t, requests]);

  if (!t) return <><TopBar title="Tenant" back={op("/tenants")} />{tenants.length ? <Empty>That tenant isn't in your records.</Empty> : <Loading />}</>;

  const p = byId.get(t.property_id);
  const current = isCurrentTenant(t);
  const rating = ratings[t.id];

  const doMoveOut = async () => {
    setBusy(true);
    try {
      const row = await patchTenant(t.id, { status: "past", moved_out_on: outDate });
      const next = tenants.map((x) => (x.id === row.id ? row : x));
      setTenants(next);
      setMoveOut(false);
      toast(`${t.name.split(" ")[0]} marked as moved out`);
      if (p && !next.some((x) => x.property_id === p.property_id && isCurrentTenant(x))) setConfirm("vacant");
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const markVacant = async () => {
    setBusy(true);
    try {
      await updateProperty(p.property_id, { status: "paused" });
      await reloadProperties();
      setConfirm(null);
      navigate(op(`/properties/${p.property_id}/find-tenant`));
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await patchTenant(t.id, { status: "removed" });
      setTenants((ts) => ts.filter((x) => x.id !== t.id));
      toast("Removed from your records");
      navigate(op("/tenants"), { replace: true });
    } catch (e) {
      toast(friendlyError(e), "error");
      setBusy(false);
    }
  };

  const circle = (href, icon, label, external) => (
    <a href={href || undefined} target={external ? "_blank" : undefined} rel="noreferrer" className="oz-tile"
      style={{ border: 0, background: "transparent", opacity: href ? 1 : 0.4 }} aria-disabled={!href}>
      <span className="ic" style={{ width: 46, height: 46, borderRadius: 999 }}>{icon}</span>{label}
    </a>
  );

  return (
    <>
      <TopBar back right={<button type="button" className="oz-iconbtn" aria-label="More" onClick={() => setMenu(true)}><MoreHorizontal size={21} /></button>}>
        <span style={{ flex: 1 }} />
      </TopBar>
      <div className="oz-pad" style={{ paddingTop: 0 }}>
        <div className="oz-row" style={{ alignItems: "flex-start", gap: 14 }}>
          <Avatar name={t.name} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="oz-between" style={{ alignItems: "flex-start" }}>
              <h2 style={{ margin: 0, fontSize: 21 }}>{t.name}</h2>
              {current ? <Pill tone="green">Active</Pill> : <Pill tone="grey">Moved out</Pill>}
            </div>
            {(t.occupation || t.company) && <div className="oz-meta">{[t.occupation, t.company].filter(Boolean).join(" · ")}</div>}
            {rating && <div style={{ marginTop: 4 }}><Stars value={rating.stars} size={15} /></div>}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", margin: "14px 0 4px" }}>
          {circle(t.phone ? telLink(t.phone) : "", <Phone size={19} />, "Call")}
          {circle(t.phone ? waLink(t.phone, `Hi ${t.name.split(" ")[0]}, `) : "", <WhatsAppIcon size={19} />, "WhatsApp", true)}
          {circle(t.email ? `mailto:${t.email}` : "", <Mail size={19} />, "Email")}
          <button type="button" className="oz-tile" style={{ border: 0, background: "transparent" }} onClick={() => setMenu(true)}>
            <span className="ic" style={{ width: 46, height: 46, borderRadius: 999 }}><MoreHorizontal size={19} /></span>More
          </button>
        </div>
      </div>

      <div className="oz-tabs" role="tablist">
        {[["profile", "Profile"], ["documents", "Documents"], ["history", "History"]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`oz-tab${tab === k ? " oz-tab--on" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="oz-pad">
        {tab === "profile" && (
          <>
            <div className="oz-section">
              <h2 className="oz-h2">Personal Information</h2>
              <div className="oz-kv">
                <div>Full Name</div><div>{t.name}</div>
                <div>Phone</div>
                <div className="oz-between">{t.phone || "—"}
                  {t.phone && <a href={waLink(t.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><WhatsAppIcon color="#16A34A" /></a>}</div>
                <div>Email</div><div>{t.email || "—"}</div>
                {t.linkedin_url && (<><div>LinkedIn</div><div><a href={t.linkedin_url} target="_blank" rel="noreferrer nofollow" style={{ color: "var(--em)" }}>{t.linkedin_url.replace("https://www.", "")}</a></div></>)}
                <div>Occupation</div><div>{t.occupation || "—"}</div>
                <div>Company</div><div>{t.company || "—"}</div>
                <div>Property</div><div>{p ? propertyName(p) : "—"}</div>
                <div>Move-in Date</div><div>{fmtDate(t.move_in_date) || "—"}</div>
                <div>{t.moved_out_on ? "Moved out" : "Expected Move-out"}</div><div>{fmtDate(t.moved_out_on || t.lease_end_date) || "—"}</div>
                {current && t.move_in_date && (<><div>Tenancy</div><div>{tenancyLength(t)}</div></>)}
              </div>
              {t.notes && <p className="oz-meta" style={{ margin: "12px 0 0", whiteSpace: "pre-wrap" }}>{t.notes}</p>}
            </div>
            <RatingCard tenant={t} />
          </>
        )}
        {tab === "documents" && <DocumentList tenantId={t.id} propertyId={t.property_id} defaultKind="agreement" />}
        {tab === "history" && (
          <div className="oz-section">
            {history.length === 0 ? <span className="oz-meta">Nothing yet.</span> : (
              <div className="oz-timeline">
                {history.map((h) => (
                  <div key={`${h.at}-${h.text}`} style={h.future ? { opacity: 0.7 } : undefined}>
                    <strong style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{h.text}</strong>
                    <span className="oz-meta">{fmtDate(h.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {menu && (
        <Sheet title={t.name} onClose={() => setMenu(false)}>
          <button type="button" className="oz-menurow" onClick={() => navigate(op(`/tenants/${t.id}/edit`))}><Pencil size={18} /> Edit details</button>
          {current && <button type="button" className="oz-menurow" onClick={() => { setMenu(false); setMoveOut(true); }}><UserMinus size={18} /> Mark as moved out</button>}
          <button type="button" className="oz-menurow" style={{ color: "var(--red)" }} onClick={() => { setMenu(false); setConfirm("remove"); }}>
            <Trash2 size={18} /> Remove from my records
          </button>
        </Sheet>
      )}
      {moveOut && (
        <Sheet title="Mark as moved out" onClose={() => setMoveOut(false)}>
          <div className="oz-pad">
            <label className="oz-label" htmlFor="mo-date">Moved out on</label>
            <input id="mo-date" className="oz-input" type="date" value={outDate} onChange={(e) => setOutDate(e.target.value)} />
            <p className="oz-hint">They stay in your records under Past tenants.</p>
            <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={doMoveOut} disabled={busy}>{busy ? "Saving…" : "Confirm move-out"}</button>
          </div>
        </Sheet>
      )}
      {confirm === "vacant" && p && (
        <Confirm title="The flat is empty now" busy={busy} confirmLabel="Find the next tenant"
          body={`No one is living in ${propertyName(p)}. Mark it vacant and set up visits?`}
          onClose={() => setConfirm(null)} onConfirm={markVacant} />
      )}
      {confirm === "remove" && (
        <Confirm title={`Remove ${t.name}?`} danger busy={busy} confirmLabel="Remove"
          body="Use this for a tenant added by mistake. Someone who has left should be marked as moved out instead."
          onClose={() => setConfirm(null)} onConfirm={remove} />
      )}
    </>
  );
}
