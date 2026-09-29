/**
 * The paywall for MovEazy inventory. The price, the struck-through regular
 * price and the broker's brokerage share all come from the CRM
 * (program_settings, via useLandingSettings / partner_me).
 *
 * The payment gateway is deliberately not wired yet. Until it is, "Get
 * Premium" asks the MovEazy team on WhatsApp, and the CRM grants the month by
 * hand (Brokers → MovEazy partners). The entitlement row the CRM writes is the
 * same one a gateway webhook will write, so nothing here changes then but the
 * button.
 */
import { Check, Crown } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { TopBar, WhatsAppIcon } from "./partnerUi";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { useLandingSettings } from "../../lib/landingSettings";

export default function PremiumPage() {
  const { me, inventory } = usePartner();
  const tier = me?.tiers?.moveazy_inventory || {};
  const s = useLandingSettings();
  const price = Number(s.premiumPrice) || tier.price_monthly || 1499;
  const list = Number(s.premiumListPrice) || 0;
  const share = me?.property_share ?? s.propertyShare;
  const count = (inventory ?? []).filter((l) => l.source === "moveazy").length;
  const shown = count >= 1000 ? `${Math.floor(count / 100) * 100}+` : "1000+";
  const until = tier.ends_at ? new Date(tier.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  const ask = `${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(
    `Hi MovEazy, I'd like MovEazy Premium on the partner app (₹${price.toLocaleString("en-IN")}/month).\nName: ${me?.partner?.name || ""}\nEmail: ${me?.partner?.email || ""}\nMobile: ${me?.partner?.phone || ""}`,
  )}`;

  return (
    <>
      <TopBar title="MovEazy Premium" back />
      <div className="pz-pad">
        <div className="pz-card" style={{ padding: 20, textAlign: "center", background: "linear-gradient(160deg,#ECFDF3,#FFFFFF 60%)" }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: "var(--g)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
            <Crown size={26} />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Unlock {shown} listings updated daily</h2>
          <p className="pz-meta" style={{ margin: 0 }}>MovEazy's full rental inventory, with owner contacts — and you keep {share}% of the brokerage.</p>
          {tier.active ? (
            <p style={{ margin: "16px 0 0", fontWeight: 700, color: "var(--g2)" }}>You're on Premium{until ? ` until ${until}` : ""}.</p>
          ) : (
            <div style={{ margin: "18px 0 4px" }}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>₹{price.toLocaleString("en-IN")}<span style={{ fontSize: 15, fontWeight: 500, color: "var(--dim)" }}> / month</span></div>
              {list > price && <div className="pz-meta"><s>₹{list.toLocaleString("en-IN")}</s> · launch offer</div>}
            </div>
          )}
        </div>

        <div className="pz-section" style={{ marginTop: 12 }}>
          {[
            "Exact address and map pin on every MovEazy listing",
            "Owner / point-of-contact number — call or WhatsApp directly",
            `${share}% of the brokerage on every MovEazy property you close`,
            "New verified inventory added every day",
            "Match MovEazy stock against your leads automatically",
          ].map((t) => (
            <div key={t} className="pz-row" style={{ padding: "7px 0", alignItems: "flex-start" }}>
              <Check size={18} color="var(--g)" style={{ flex: "none", marginTop: 2 }} /> <span style={{ fontSize: 15 }}>{t}</span>
            </div>
          ))}
        </div>

        {!tier.active && (
          <>
            <a className="pz-btn pz-btn--primary pz-btn--block" href={ask} target="_blank" rel="noreferrer">
              <WhatsAppIcon /> Get Premium — ₹{price.toLocaleString("en-IN")}/month
            </a>
            <p className="pz-hint" style={{ textAlign: "center" }}>
              Online payment is coming soon. For now, message us and we'll activate your plan within a few hours.
            </p>
          </>
        )}
      </div>
    </>
  );
}
