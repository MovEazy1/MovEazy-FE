/**
 * The broker's inbox: notifications (a tenant liked a home; a group member
 * says a listing is rented; the answer to a sold-out flag) and each curated
 * list with what the tenant did on it.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bell, Heart, Home, Sparkles, ThumbsDown } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { Empty, Loading, TopBar, WhatsAppIcon, toast } from "./partnerUi";
import { SmartListingImage } from "./partnerMedia";
import ShareOptions from "./ShareOptions";
import { bhkLabel, friendlyError, inr, pp, waLink } from "../../lib/partners";
import { curatedMessage, curatedUrl, fetchMyCuratedLists, fetchNotifications, markNotificationsRead } from "../../lib/partnerCurated";

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};
const ICON = { tenant_liked: Heart, storefront_like: Heart, sold_out_request: Home, sold_out_decided: Home, list_opened: Sparkles, list_done: Sparkles };

/**
 * Unread count for the bell, checked every 30 seconds while the app is open —
 * and a toast the moment something new lands (a like, a skip-summary, an open).
 */
export function useUnreadCount(enabled) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let last = null; // newest notification id seen
    const tick = () => fetchNotifications().then((r) => {
      if (!alive) return;
      setN(Number(r?.unread) || 0);
      const newest = r?.items?.[0];
      if (newest && last != null && newest.id > last && !newest.read) toast(`${newest.title} — ${newest.body}`.slice(0, 140));
      if (newest) last = Math.max(last ?? 0, newest.id);
      else if (last == null) last = 0;
    }, () => {});
    tick();
    const id = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [enabled]);
  return n;
}

export function NotificationBell({ count }) {
  return (
    <Link to={pp("/notifications")} className="pz-iconbtn" aria-label={count ? `${count} new notifications` : "Notifications"} style={{ position: "relative" }}>
      <Bell size={21} />
      {count > 0 && (
        <span style={{ position: "absolute", top: 4, right: 4, minWidth: 17, height: 17, borderRadius: 99, background: "#E11D48", color: "#fff",
          fontSize: 10.5, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>{count > 9 ? "9+" : count}</span>
      )}
    </Link>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchNotifications().then((r) => { setData(r); if (Number(r?.unread)) markNotificationsRead(); }, (e) => toast(friendlyError(e), "error"));
  }, []);
  return (
    <>
      <TopBar title="Notifications" back />
      <div className="pz-pad">
        {!data ? <Loading /> : !data.items?.length ? (
          <Empty>Nothing yet. When a tenant likes a home on your curated list or QR page, it shows up here.</Empty>
        ) : (
          <div className="pz-card">
            {data.items.map((n, i) => {
              const Icon = ICON[n.kind] || Bell;
              return (
                <button key={n.id} type="button" className="pz-menurow" onClick={() => n.link && navigate(pp(n.link))}
                  style={{ borderTop: i ? "1px solid var(--line)" : 0, background: n.read ? "transparent" : "#F0FDF4", alignItems: "flex-start" }}>
                  <span className="pz-avatar" style={{ background: n.kind.includes("like") ? "#FDE7EC" : "#FFF3D6", color: n.kind.includes("like") ? "#E11D48" : "#8A6419" }}>
                    <Icon size={16} fill={n.kind.includes("like") ? "#E11D48" : "none"} />
                  </span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <strong style={{ display: "block", fontSize: 14.5 }}>{n.title}</strong>
                    <span className="pz-meta">{n.body}</span>
                  </span>
                  <span className="pz-hint">{ago(n.created_at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** /curated/:id — one list: who it went to, and their verdict on each home. */
export function CuratedListPage() {
  const { id } = useParams();
  const { byId } = usePartner();
  const [lists, setLists] = useState(null);
  useEffect(() => { fetchMyCuratedLists().then(setLists, (e) => { toast(friendlyError(e), "error"); setLists([]); }); }, []);
  const list = useMemo(() => (lists || []).find((l) => l.id === id), [lists, id]);

  if (!lists) return <><TopBar title="Curated list" back /><Loading /></>;
  if (!list) return <><TopBar title="Curated list" back /><Empty>That list isn’t yours or no longer exists.</Empty></>;
  const acts = list.actions || {};
  const liked = list.property_ids.filter((p) => acts[p]?.action === "liked").length;
  const tenant = list.tenant;
  return (
    <>
      <TopBar title="Curated list" back />
      <div className="pz-pad">
        <div className="pz-section">
          <strong style={{ fontSize: 17 }}>{list.lead_name || tenant?.name || "Your tenant"}</strong>
          <p className="pz-meta" style={{ margin: "4px 0 0" }}>
            {list.property_ids.length} homes · opened {list.open_count}× · <b style={{ color: "#E11D48" }}>♥ {liked} liked</b> · ✕ {list.property_ids.filter((p) => acts[p]?.action === "skipped").length} skipped
          </p>
          {tenant?.phone ? (
            <a className="pz-btn pz-wa pz-btn--block" style={{ marginTop: 12 }} target="_blank" rel="noreferrer"
              href={waLink(tenant.phone, `Hi${tenant.name ? ` ${tenant.name.split(" ")[0]}` : ""}, saw you liked ${liked} of the homes — shall I set up visits?`)}>
              <WhatsAppIcon /> WhatsApp {tenant.name || tenant.phone}
            </a>
          ) : <p className="pz-hint" style={{ margin: "10px 0 0" }}>Not opened yet — the tenant enters their number when they do.</p>}
          <details style={{ marginTop: 12 }}>
            <summary className="pz-meta" style={{ cursor: "pointer", fontWeight: 700 }}>Share this list again</summary>
            <div style={{ marginTop: 12 }}>
              <ShareOptions url={curatedUrl(list.token)} phone={tenant?.phone || ""}
                message={curatedMessage(list.token, { leadName: list.lead_name, count: list.property_ids.length })}
                post={`${list.property_ids.length} verified rental homes — swipe and tap ♥ on the ones you like.`} />
            </div>
          </details>
        </div>
        <div className="pz-card">
          {list.property_ids.map((pid, i) => {
            const l = byId.get(pid);
            const a = acts[pid]?.action;
            return (
              <Link key={pid} to={pp(`/property/${pid}`)} className="pz-row" style={{ padding: 12, borderTop: i ? "1px solid var(--line)" : 0, color: "inherit", textDecoration: "none" }}>
                <div className="pz-prop-img" style={{ width: 64, height: 50, borderRadius: 8, overflow: "hidden", flex: "none", aspectRatio: "auto" }}>{l && <SmartListingImage listing={l} />}</div>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 14.5 }}>{l ? `${bhkLabel(l)} • ${l.area}` : pid}</strong>
                  <span className="pz-meta">{l ? `${inr(l.rent)} / month` : "No longer in your inventory"}</span>
                </span>
                {a === "liked" ? <span style={{ color: "#E11D48", fontWeight: 800, fontSize: 13 }}><Heart size={14} fill="#E11D48" /> Liked</span>
                  : a === "skipped" ? <span className="pz-meta"><ThumbsDown size={13} /> Skipped</span>
                    : <span className="pz-hint">Not seen</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** A lead's curated lists, for the lead screen. */
export function LeadCuratedLists({ leadId }) {
  const [lists, setLists] = useState(null);
  useEffect(() => { fetchMyCuratedLists().then((all) => setLists(all.filter((l) => l.lead_id === leadId)), () => setLists([])); }, [leadId]);
  if (!lists?.length) return null;
  return (
    <div className="pz-section">
      <h2><span><Sparkles size={15} style={{ verticalAlign: -2 }} /> Curated lists sent</span></h2>
      {lists.map((l) => {
        const liked = Object.values(l.actions || {}).filter((a) => a.action === "liked").length;
        return (
          <Link key={l.id} to={pp(`/curated/${l.id}`)} className="pz-row" style={{ padding: "8px 0", color: "inherit", textDecoration: "none" }}>
            <span style={{ flex: 1 }}>{l.property_ids.length} homes · {new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            <span className="pz-meta">{l.open_count ? `opened · ${liked} liked` : "not opened"}</span>
          </Link>
        );
      })}
    </div>
  );
}

