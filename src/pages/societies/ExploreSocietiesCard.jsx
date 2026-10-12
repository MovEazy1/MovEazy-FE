/**
 * "Explore societies near your office" — after the top 5 matches and on the
 * tenant's home. Shows only once the CRM has switched Explore societies live
 * (staff see it to preview).
 */
import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { useExploreLive } from "./useExplore";

export default function ExploreSocietiesCard({ style }) {
  const live = useExploreLive();
  if (!live) return null;
  return (
    <Link to="/societies" style={{
      display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 20, textDecoration: "none", color: "#fff", textAlign: "left",
      background: "radial-gradient(120% 140% at 0% 0%, #13805D, #0A5E44 45%, #063B2D)", boxShadow: "0 14px 32px rgba(6,59,45,.25)", ...style,
    }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flex: "none" }}>
        <Building2 size={24} color="#9FF0E4" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: "block", fontSize: 16.5 }}>Explore societies near your office</b>
        <span style={{ fontSize: 13.5, color: "#CFE6DD" }}>Gated communities with flats free now — on a map</span>
      </span>
      <ArrowRight size={20} />
    </Link>
  );
}
