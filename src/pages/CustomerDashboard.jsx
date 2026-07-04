import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { fetchCustomerSearchProfile, saveCustomerSearchProfile } from "../lib/customerSearchProfile";
import PageShell from "../components/layout/PageShell";
import Navbar from "../components/layout/Navbar";

const FLAT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Villa", "PG / Hostel", "Studio"];
const POPULAR_AREAS = [
  "HSR Layout", "Koramangala", "Bellandur", "Whitefield", "Marathalli",
  "Indiranagar", "BTM Layout", "Hebbal", "Electronic City", "Hoodi",
];
const PRIORITIES = ["Rent", "Spacious Rooms", "Interiors", "Locality", "Proximity to Office"];

export default function CustomerDashboard() {
  const { user, refreshRole, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);

  const [profileOpen, setProfileOpen] = useState(true);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profilePhone, setProfilePhone] = useState(user?.phone || "");
  const [profileBhk, setProfileBhk] = useState("");
  const [profileArea, setProfileArea] = useState("");
  const [profileMid, setProfileMid] = useState("");
  const [profileBudget, setProfileBudget] = useState("");
  const [profilePriority, setProfilePriority] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (user?.role === "seller") navigate("/seller");
    else if (user?.role === "broker") navigate("/broker");
  }, [user, navigate]);

  useEffect(() => {
    refreshRole();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    fetchCustomerSearchProfile(user.uid)
      .then((sp) => {
        setProfileBhk(sp.bhk || "");
        setProfileArea((sp.preferredAreas || [])[0] || "");
        setProfileMid(sp.moveInDate || "");
        setProfileBudget(sp.budgetMax ? String(sp.budgetMax) : "");
        setProfilePriority(sp.priority || "");
      })
      .finally(() => setProfileLoading(false));
  }, [user?.uid]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: "", text: "" });
    try {
      const searchPayload = {
        bhk: profileBhk,
        preferredAreas: profileArea ? [profileArea] : [],
        moveInDate: profileMid,
        budgetMax: profileBudget ? Number(profileBudget) : null,
        budgetMin: null,
        priority: profilePriority,
      };
      const flatSearchMirror = user?.role === "customer" ? {
        bhk: profileBhk || "",
        preferredAreas: profileArea ? [profileArea] : [],
        moveInDate: profileMid || "",
        budgetMax: profileBudget ? Number(profileBudget) : null,
        priority: profilePriority || "",
      } : null;
      const [r1] = await Promise.all([
        updateUserProfile(profileName, profilePhone, flatSearchMirror),
        user?.role === "customer" ? saveCustomerSearchProfile(user.uid, searchPayload) : Promise.resolve(),
      ]);
      if (r1?.success === false) throw new Error(r1.error || "Failed to save profile.");
      setProfileMsg({ type: "ok", text: "Profile saved!" });
    } catch (err) {
      setProfileMsg({ type: "err", text: err.message || "Something went wrong." });
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <PageShell variant="marketing" overlayOnly style={{ background: "#f8fafc" }}>
      <Navbar variant="marketing" />
      <div style={{ padding: isMobile ? "12px" : "24px", maxWidth: 680, margin: "0 auto" }}>

        {/* ── Continue your search ── */}
        {user?.role === "customer" && (
          <div style={{ background: "white", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(15,23,42,0.05)", padding: "16px 18px", marginBottom: "16px" }}>
            {profileLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ height: 14, width: "40%", borderRadius: 6, background: "#f1f5f9" }} />
                <div style={{ height: 12, width: "70%", borderRadius: 6, background: "#f1f5f9" }} />
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    Your flat search
                  </div>
                  <div style={{ fontSize: "13px", color: "#334155" }}>
                    {profileBhk || profileArea || profileBudget ? (
                      <>
                        {[profileBhk, profileArea, profileBudget ? `up to ₹${Number(profileBudget).toLocaleString("en-IN")}/mo` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </>
                    ) : (
                      "You haven't started a search yet — chat with our Flat Agent to get matched."
                    )}
                  </div>
                </div>
                <Link
                  to="/find"
                  style={{ flexShrink: 0, padding: "9px 18px", borderRadius: "9px", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "white", fontWeight: 700, fontSize: "13px", textDecoration: "none" }}
                >
                  {profileBhk || profileArea || profileBudget ? "Continue chat" : "Start chat"}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── My Profile ── */}
        <div style={{ background: "white", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 4px 16px rgba(15,23,42,0.05)" }}>
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", borderRadius: "14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#dc2626,#ef4444)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "16px", flexShrink: 0 }}>
                {(user?.name || user?.email || "?")[0].toUpperCase()}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>{user?.name || "My Profile"}</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>{user?.email}</div>
              </div>
            </div>
            <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>{profileOpen ? "▲ Close" : "✏️ Edit profile"}</span>
          </button>

          {profileOpen && (
            <form onSubmit={handleProfileSave} style={{ padding: "0 18px 18px", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px", marginTop: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Full Name</label>
                  <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Phone Number</label>
                  <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+91 98765 43210" type="tel"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                </div>
              </div>

              {user?.role === "customer" && (
                <>
                  <div style={{ margin: "18px 0 10px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ height: 1, flex: 1, background: "#f1f5f9" }} />
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em" }}>Flat Search Preferences</span>
                    <div style={{ height: 1, flex: 1, background: "#f1f5f9" }} />
                  </div>

                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Flat Type</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {FLAT_TYPES.map((f) => (
                        <button key={f} type="button" onClick={() => setProfileBhk(profileBhk === f ? "" : f)}
                          style={{ padding: "5px 13px", borderRadius: "20px", border: `1px solid ${profileBhk === f ? "#dc2626" : "#e2e8f0"}`, background: profileBhk === f ? "#fef2f2" : "white", color: profileBhk === f ? "#dc2626" : "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Preferred Area</label>
                      <select value={profileArea} onChange={(e) => setProfileArea(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid #e2e8f0", fontSize: "13px", background: "white", boxSizing: "border-box" }}>
                        <option value="">Select area…</option>
                        {POPULAR_AREAS.map((a) => <option key={a}>{a}</option>)}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Move-in Date</label>
                      <input type="date" value={profileMid} onChange={(e) => setProfileMid(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Budget / mo (₹)</label>
                      <input type="number" value={profileBudget} onChange={(e) => setProfileBudget(e.target.value)} placeholder="25000" min="0" step="500"
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1px solid #e2e8f0", fontSize: "13px", boxSizing: "border-box" }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>My Main Priority</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {PRIORITIES.map((p) => (
                        <button key={p} type="button" onClick={() => setProfilePriority(p)}
                          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 13px", borderRadius: "9px", border: `1px solid ${profilePriority === p ? "#dc2626" : "#e2e8f0"}`, background: profilePriority === p ? "#fef2f2" : "white", color: profilePriority === p ? "#b91c1c" : "#374151", fontSize: "13px", fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
                          <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${profilePriority === p ? "#dc2626" : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {profilePriority === p && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc2626", display: "block" }} />}
                          </span>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {profileMsg.text && (
                <div style={{ marginBottom: "12px", padding: "9px 13px", borderRadius: "9px", fontSize: "13px", fontWeight: 500, background: profileMsg.type === "ok" ? "#f0fdf4" : "#fef2f2", color: profileMsg.type === "ok" ? "#166534" : "#b91c1c", border: `1px solid ${profileMsg.type === "ok" ? "#bbf7d0" : "#fecaca"}` }}>
                  {profileMsg.text}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button type="submit" disabled={profileSaving}
                  style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "white", fontWeight: 700, fontSize: "13px", cursor: profileSaving ? "wait" : "pointer", opacity: profileSaving ? 0.7 : 1 }}>
                  {profileSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </PageShell>
  );
}
