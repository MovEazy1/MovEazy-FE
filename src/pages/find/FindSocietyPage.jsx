/**
 * moveazy.co.in/find/societies/<code> — one gated society a MovEazy partner
 * onboarded: photos of the amenities and a sample flat (taken there), the
 * facts, typical rents, what's nearby and roughly where it is (never the gate).
 *
 * "Get flats": the number first if we don't have it, then the lead goes to the
 * partner who onboarded the society (and the CRM), and WhatsApp opens to that
 * partner with the tenant's message ready.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, MapPin, MessageCircle } from "lucide-react";
import { FindShell, useFindGate } from "./findKit";
import { rentLine } from "./FindSocieties";
import { enquireSociety, fetchLiveSociety, partnerWhatsApp, slotLabel } from "../../lib/societyPartners";
import { rentRange } from "../../lib/societyProspects";

const ApproxMap = lazy(() => import("../curated/ApproxMap"));
const NEARBY = [["schools", "Schools"], ["hospitals", "Hospitals"], ["supermarkets", "Groceries & malls"], ["transit", "Metro & bus"]];
const FACTS = [["builder", "Builder"], ["year_built", "Built"], ["towers", "Towers"], ["total_flats", "Homes"], ["floors", "Floors"], ["maintenance", "Maintenance"]];

export default function FindSocietyPage() {
  const { code = "" } = useParams();
  const { allowed, gate } = useFindGate();
  const [s, setS] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null); // { url, name }
  const [err, setErr] = useState("");
  const [shown, setShown] = useState(0);
  useEffect(() => { fetchLiveSociety(code).then((r) => setS(r || null), () => setS(null)); }, [code]);

  const getFlats = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await enquireSociety(code);
      // No partner for this society yet: the MovEazy team follows up from the CRM.
      if (!r?.partner_phone) { setSent({ team: true, society: r?.society || s.name }); return; }
      const url = partnerWhatsApp(r.partner_phone, r.partner_first_name, r.society);
      setSent({ url, name: r?.partner_first_name || "our team" });
      window.location.href = url;
    } catch (e) {
      setErr(e?.message || "Couldn't send that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (s === null) {
    return (
      <FindShell kicker="Societies" title="This society isn't listed right now">
        <div className="fd-empty"><a href="/find/societies">See the societies we list</a></div>
      </FindShell>
    );
  }
  const photos = s?.photos_all ?? [];
  const facts = FACTS.filter(([k]) => s?.facts_all?.[k]);
  const rents = ["1rk", "1", "2", "3", "4"].filter((k) => rentRange(s?.rents?.[k]));

  return (
    <FindShell kicker={s ? [s.area, "Gated society"].filter(Boolean).join(" · ") : "Societies"} title={s?.name || "Loading…"}
      sub={s ? [rentLine(s.rents), s.amenity_count ? `${s.amenity_count} amenities` : "", s.verified ? "verified by a MovEazy partner" : ""].filter(Boolean).join(" · ") : ""}>
      {gate}
      {allowed && s && (
        <div className="sp-page">
          {photos.length > 0 && (
            <section className="sp-gallery">
              <img src={photos[shown]} alt="" className="sp-main" />
              {photos.length > 1 && (
                <div className="sp-strip">
                  {photos.map((u, i) => (
                    <button key={u} type="button" className={i === shown ? "is-on" : ""} onClick={() => setShown(i)} aria-label={`Photo ${i + 1}`}>
                      <img src={u} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="sp-cta">
            {sent?.team ? (
              <>
                <b><Check size={18} /> Got it</b>
                <span>Our team will WhatsApp you the flats free in {sent.society} shortly.</span>
              </>
            ) : sent ? (
              <>
                <b><Check size={18} /> Sent to {sent.name}</b>
                <span>They&apos;ll share the flats free in {s.name}. WhatsApp didn&apos;t open?</span>
                <a className="fd-btn fd-btn--go" href={sent.url} target="_blank" rel="noreferrer"><MessageCircle size={17} /> Open WhatsApp</a>
              </>
            ) : (
              <>
                <b>Want a flat in {s.name}?</b>
                <span>{s.verified ? `Your MovEazy partner${s.partner_first_name ? `, ${s.partner_first_name},` : ""} knows every flat free here.` : "Tell us and our team will share the flats free here."}</span>
                <button type="button" className="fd-btn fd-btn--go" disabled={busy} onClick={getFlats}>
                  <MessageCircle size={17} /> {busy ? "Connecting…" : "Get flats"}
                </button>
              </>
            )}
            {err && <span style={{ color: "#B91C1C" }}>{err}</span>}
          </section>

          {!s.verified && (
            <p className="sp-note" style={{ margin: 0 }}>Details from public sources — rents are approximate and may vary. A MovEazy partner hasn&apos;t visited this society yet.</p>
          )}

          {facts.length > 0 && (
            <section className="sp-facts">
              {facts.map(([k, l]) => <div key={k}><span>{l}</span><b>{String(s.facts_all[k])}</b></div>)}
            </section>
          )}
          {s.about && <p className="sp-about">{s.about}</p>}

          {rents.length > 0 && (
            <section className="sp-sec">
              <h2>Typical monthly rent</h2>
              <div className="sp-rents">
                {rents.map((k) => <div key={k}><span>{k === "1rk" ? "1 RK" : `${k} BHK`}</span><b>{rentRange(s.rents[k])}</b></div>)}
              </div>
              <p className="sp-note">Approximate — every flat is priced by its owner.</p>
            </section>
          )}

          {(s.amenities_all ?? []).length > 0 && (
            <section className="sp-sec">
              <h2>Amenities</h2>
              <div className="sp-amen">
                {s.amenities_all.map((a) => {
                  const ph = s.amenity_photos?.[a]?.[0];
                  return (
                    <div key={a} className="sp-am">
                      {ph ? <img src={ph} alt="" loading="lazy" /> : <span className="sp-am-noimg"><Check size={18} /></span>}
                      <b>{a}</b>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(s.flat_photos ?? []).length > 0 && (
            <section className="sp-sec">
              <h2>Inside a flat here</h2>
              <div className="sp-amen">
                {s.flat_photos.map((p) => (
                  <div key={p.url} className="sp-am"><img src={p.url} alt="" loading="lazy" /><b>{slotLabel(p.slot)}</b></div>
                ))}
              </div>
            </section>
          )}

          {NEARBY.some(([k]) => (s.nearby?.[k] ?? []).length) && (
            <section className="sp-sec">
              <h2>Nearby</h2>
              <div className="sp-near">
                {NEARBY.filter(([k]) => (s.nearby?.[k] ?? []).length).map(([k, l]) => (
                  <div key={k}>
                    <b>{l}</b>
                    {s.nearby[k].slice(0, 3).map((it) => <span key={it.name || it}>{it.name || it}{it.km != null ? ` · ${it.km} km` : ""}</span>)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {s.lat != null && (
            <section className="sp-sec">
              <h2><MapPin size={18} /> Roughly here</h2>
              <div className="sp-map"><Suspense fallback={null}><ApproxMap lat={Number(s.lat)} lng={Number(s.lng)} /></Suspense></div>
              <p className="sp-note">The exact address comes from your MovEazy partner.</p>
            </section>
          )}
        </div>
      )}
      <style>{PAGE_CSS}</style>
    </FindShell>
  );
}

const PAGE_CSS = `
.sp-page { display: grid; gap: 22px; }
.sp-gallery { display: grid; gap: 8px; }
.sp-main { width: 100%; max-height: 520px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 22px; background: #E7E1D2; }
.sp-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.sp-strip button { flex: none; width: 92px; height: 66px; border-radius: 12px; overflow: hidden; border: 2px solid transparent; padding: 0; cursor: pointer; background: #E7E1D2; }
.sp-strip button.is-on { border-color: #04211D; }
.sp-strip img { width: 100%; height: 100%; object-fit: cover; }
.sp-cta { position: sticky; top: 76px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 16px 18px; border-radius: 20px;
  background: #04211D; color: #E4F6F1; box-shadow: 0 16px 36px rgba(4,33,29,.25); }
.sp-cta b { font-size: 17px; color: #fff; display: inline-flex; align-items: center; gap: 6px; }
.sp-cta span { flex: 1 1 220px; color: #A9C2BC; font-size: 14.5px; }
.sp-cta .fd-btn--go { flex: 0 0 auto; background: #5EEAD4; color: #04211D; padding: 0 22px; }
.sp-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.sp-facts div { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
.sp-facts span, .sp-rents span { display: block; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
.sp-facts b { font-size: 17px; }
.sp-about { margin: 0; font-size: 16px; line-height: 1.6; color: #2F3B37; }
.sp-sec h2 { display: flex; align-items: center; gap: 8px; font-size: 22px; letter-spacing: -.02em; margin: 0 0 12px; }
.sp-rents { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.sp-rents div { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
.sp-rents b { font-size: 21px; color: #04211D; }
.sp-note { margin: 8px 0 0; color: var(--dim); font-size: 13px; }
.sp-amen { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
.sp-am { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.sp-am img, .sp-am-noimg { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: grid; place-items: center; background: #E4F6F1; color: #0E7C68; }
.sp-am b { display: block; padding: 9px 12px; font-size: 14px; }
.sp-near { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.sp-near div { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; display: grid; gap: 4px; font-size: 14px; }
.sp-map { height: 260px; border-radius: 18px; overflow: hidden; isolation: isolate; border: 1px solid var(--line); }
@media (max-width: 640px) { .sp-cta { top: 64px; } .sp-main { border-radius: 16px; } }
`;
