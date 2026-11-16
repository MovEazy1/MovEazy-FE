/**
 * Partner Home: the Societies card, for society partners only — how many
 * societies are theirs, new tenant leads, and the way in to onboard more.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MapPinned } from "lucide-react";
import { usePartner } from "./PartnerApp";
import { pp } from "../../lib/partners";
import { fetchMySocieties } from "../../lib/societyPartners";

export default function SocietiesHomeCard() {
  const { me } = usePartner();
  const on = Boolean(me?.partner?.society_partner);
  const [mine, setMine] = useState(null);
  useEffect(() => { if (on) fetchMySocieties().then(setMine, () => setMine([])); }, [on]);
  if (!on) return null;
  const live = (mine ?? []).filter((s) => s.status === "approved").length;
  const going = (mine ?? []).filter((s) => s.status !== "approved").length;
  const fresh = (mine ?? []).reduce((n, s) => n + (s.new_leads || 0), 0);
  const sub = mine === null ? "Onboard gated societies near you"
    : [live && `${live} live`, going && `${going} in progress`, fresh && `${fresh} new lead${fresh === 1 ? "" : "s"}`].filter(Boolean).join(" · ")
      || "Onboard gated societies near you";
  return (
    <Link to={pp(fresh ? "/societies?tab=leads" : "/societies")} className="pz-section"
      style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", background: "linear-gradient(135deg,#0B2A22,#123D31)", borderColor: "transparent" }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(228,182,89,.18)", color: "#E4B659", flex: "none" }}>
        <MapPinned size={22} />
      </span>
      <span style={{ flex: 1, minWidth: 0, color: "#fff" }}>
        <b style={{ fontSize: 15.5, display: "block" }}>Societies</b>
        <span style={{ fontSize: 13, color: fresh ? "#E4B659" : "#B9C8C2" }}>{sub}</span>
      </span>
      <ChevronRight size={20} color="#E4B659" />
    </Link>
  );
}
