/**
 * /tenant-profile — the signed-in tenant filling in their profile. Loads what
 * they've saved, saves every step to public.tenant_profiles (the database
 * works out the score), and hands back to the home when they're done.
 * Signed out, there is no profile to fill: back to the home page.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchMyTenantProfile, saveMyTenantProfile } from "../../lib/tenantProfile";
import TenantProfileFlow from "./TenantProfileFlow";

export default function TenantProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return undefined;
    if (!user) { navigate("/", { replace: true }); return undefined; }
    let alive = true;
    fetchMyTenantProfile(user.uid).then((p) => { if (alive) setProfile({ name: user.name, phone: user.phone, ...p }); });
    return () => { alive = false; };
  }, [user, loading, navigate]);

  useEffect(() => { if (!error) return undefined; const t = setTimeout(() => setError(""), 3500); return () => clearTimeout(t); }, [error]);

  if (!profile) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Manrope, sans-serif", color: "#5C6B67" }}>Loading your profile…</div>;
  }

  const save = async (p) => {
    try {
      await saveMyTenantProfile(user.uid, p);
    } catch {
      setError("Couldn’t save just now — it’s kept on this phone and will save next time.");
    }
  };

  return (
    <>
      <TenantProfileFlow
        initial={profile}
        onSave={save}
        onClose={() => navigate("/")}
        onFind={() => navigate("/?search=1")}
      />
      {error && (
        <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: 20, zIndex: 50, maxWidth: 480, margin: "0 auto", padding: "12px 16px",
          borderRadius: 14, background: "#04211D", color: "#fff", font: "600 13.5px Manrope, sans-serif", boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {error}
        </div>
      )}
    </>
  );
}
