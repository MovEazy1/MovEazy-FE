/**
 * On a signed-in tenant's home: the MovEazy partner(s) looking for a flat for
 * them — WhatsApp / Call, the homes they liked, and each list the partner sent
 * (opening a list goes back to the partner's own page, /c/<token>). Shown
 * when they opened a partner's link while signed in, or their number is the
 * one the partner has (tenant_my_partners, partner_curated_tenant.sql).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Heart, Phone } from "lucide-react";
import { SmartListingImage } from "../partners/partnerMedia";
import { WhatsAppIcon } from "../partners/partnerUi";
import { inr, waLink } from "../../lib/partners";
import { fetchMyPartners } from "../../lib/partnerCurated";
import { normalizeIndianMobile } from "../../lib/mobile";
import { firstName, flatLine } from "../curated/curatedText";

const initials = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "M";
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function YourPartner() {
  const [partners, setPartners] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchMyPartners().then((p) => { if (alive) setPartners(p); }, () => {});
    return () => { alive = false; };
  }, []);
  if (!partners.length) return null;

  return (
    <section className="tn-col yp">
      <style>{CSS}</style>
      {partners.map(({ broker: b = {}, lists = [], liked = [] }, i) => (
        <article className="yp-card" key={b.phone || i}>
          <p className="yp-kicker">Your partner</p>
          <div className="yp-who">
            {b.photo_url ? <img src={b.photo_url} alt="" width="52" height="52" className="yp-photo" /> : <span className="yp-photo yp-photo--none">{initials(b.name)}</span>}
            <div className="yp-name">
              <b>{b.name || "Your partner"}</b>
              <span>{b.agency || `Finding your flat · ${lists.length} list${lists.length === 1 ? "" : "s"} sent`}</span>
            </div>
          </div>
          {b.phone && (
            <div className="yp-contact">
              <a href={waLink(b.phone, `Hi${firstName(b.name) ? ` ${firstName(b.name)}` : ""}, `)} target="_blank" rel="noreferrer"><WhatsAppIcon /> WhatsApp</a>
              <a href={`tel:+91${normalizeIndianMobile(b.phone)}`}><Phone size={16} /> Call</a>
            </div>
          )}

          {liked.length > 0 && (
            <>
              <h3><Heart size={15} fill="#E11D48" color="#E11D48" /> You liked {liked.length}</h3>
              <div className="yp-liked">
                {liked.slice(0, 8).map((h) => (
                  <Link key={h.property_id} to={`/c/${h.token}`} className="yp-home">
                    <span className="yp-img"><SmartListingImage listing={h} thumb /></span>
                    <b>{inr(h.rent)}</b>
                    <span>{flatLine(h)}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <h3>Lists from {firstName(b.name) || "your partner"}</h3>
          {lists.map((l) => {
            const left = l.count - l.decided;
            return (
              <Link key={l.token} to={`/c/${l.token}`} className="yp-list">
                <span>
                  <b>{l.count} home{l.count === 1 ? "" : "s"} · {day(l.created_at)}</b>
                  <em>{left > 0 ? `${left} to see` : "All seen"}{l.liked > 0 ? ` · ${l.liked} liked` : ""}</em>
                </span>
                {left > 0 && <i className="yp-new">Open</i>}
                <ChevronRight size={18} />
              </Link>
            );
          })}
        </article>
      ))}
    </section>
  );
}

const CSS = `
.yp { margin-top: 16px; display: grid; gap: 12px; }
.yp-card { border-radius: 20px; padding: 16px; color: #fff; background: radial-gradient(120% 100% at 0% 0%, #1B6B4E, #0A3A2A 55%, #05241A);
  box-shadow: 0 14px 34px rgba(10,58,42,.22); }
.yp-kicker { margin: 0; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #E4B659; }
.yp-who { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.yp .yp-photo { width: 52px; height: 52px; border-radius: 99px; object-fit: cover; border: 2px solid #E4B659; flex: none; }
.yp-photo--none { display: grid; place-items: center; background: #F7E9C6; color: #8A6419; font-weight: 800; }
.yp-name { min-width: 0; }
.yp-name b { display: block; font-size: 17px; }
.yp-name span { font-size: 13px; opacity: .8; }
.yp-contact { display: flex; gap: 8px; margin-top: 12px; }
.yp-contact a { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border-radius: 12px;
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.25); color: #fff; font-weight: 800; font-size: 14px; text-decoration: none; }
.yp-contact svg { width: 18px; height: 18px; }
.yp h3 { display: flex; align-items: center; gap: 6px; font-size: 14px; margin: 16px 0 8px; }
.yp-liked { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 0 16px; }
.yp-liked::-webkit-scrollbar { display: none; }
.yp-home { flex: 0 0 132px; background: #fff; color: #13201B; border-radius: 12px; overflow: hidden; text-decoration: none; padding-bottom: 8px; }
.yp-img { display: block; height: 84px; background: #E5E7EB; }
.yp-img img, .yp-img video { width: 100%; height: 100% !important; object-fit: cover; display: block; }
.yp-home b { display: block; font-size: 14px; padding: 6px 8px 0; }
.yp-home > span:last-child { display: block; font-size: 12px; padding: 0 8px; color: #56655F; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yp-list { display: flex; align-items: center; gap: 10px; padding: 11px 12px; margin-top: 8px; border-radius: 12px; background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.18); color: #fff; text-decoration: none; }
.yp-list > span { flex: 1; min-width: 0; }
.yp-list b { display: block; font-size: 14.5px; }
.yp-list em { font-style: normal; font-size: 12.5px; opacity: .8; }
.yp-new { font-style: normal; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 99px; background: #E4B659; color: #1F1605; }
`;
