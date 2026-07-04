import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchCustomerSearchProfile, saveCustomerSearchProfile } from "../lib/customerSearchProfile";
import SmartImage from "../components/SmartImage";
import PropertyModal from "../components/PropertyModal";
import { getInterestsGlobal } from "../lib/store";
import { isFirebaseConfigured } from "../lib/firebase";
import { getInterestsForCustomerEmail } from "../lib/firestoreStore";
import { getFilterHistory, getBookings } from "../lib/userActivity";
import { getSavedPropertiesMerged, toggleSavedProperty } from "../lib/savedProperties";
import { interestStatusToCustomerLabel } from "../lib/crmSync";

const FLAT_TYPES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "Villa", "PG / Hostel", "Studio"];
const POPULAR_AREAS = [
  "HSR Layout", "Koramangala", "Bellandur", "Whitefield", "Marathalli",
  "Indiranagar", "BTM Layout", "Hebbal", "Electronic City", "Hoodi",
];
const PRIORITIES = ["Rent", "Spacious Rooms", "Interiors", "Locality", "Proximity to Office"];

const TENANCY_LABELS = {
  entire_unit: "Whole unit",
  seeking_flatmate: "Seeking flatmate",
  open_to_share: "Open to share",
};

const TABS = [
  { id: "account", label: "Account" },
  { id: "saved", label: "Saved" },
  { id: "contacted", label: "Contacted" },
  { id: "searches", label: "Recent searches" },
];

const INK = "#1A2421";
const PAPER = "#F7F4ED";
const LINE = "#D9D3C4";
const MUTED = "#8B8578";
const WHITE = "#FFFEFB";
const VERIFIED = "#2D6A4F";
const RUST = "#C8500F";

function SectionCard({ title, description, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>{title}</h2>
      {description ? (
        <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px", lineHeight: 1.55 }}>{description}</p>
      ) : null}
      <div style={{ background: WHITE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 18 }}>
        {children}
      </div>
    </section>
  );
}

function EmptyState({ text }) {
  return <p style={{ margin: 0, fontSize: 14, color: MUTED, lineHeight: 1.55 }}>{text}</p>;
}

function mergeApplications(localBookings, remoteInterests) {
  const byKey = new Map();
  for (const b of localBookings) {
    byKey.set(String(b.listingId), {
      listingId: b.listingId,
      listingTitle: b.listingTitle,
      date: b.date,
      status: b.status,
      statusCode: b.applicationStatusCode,
      tenancyPreference: b.tenancyPreference,
      adultsSharing: b.adultsSharing,
      notes: b.notes,
    });
  }
  for (const row of remoteInterests) {
    const key = String(row.listingId);
    const existing = byKey.get(key);
    const date = row.createdAt?.toDate?.()?.toISOString?.() || row.submittedAt || existing?.date;
    const statusCode = row.status || existing?.statusCode;
    byKey.set(key, {
      listingId: row.listingId,
      listingTitle: row.listingTitle || existing?.listingTitle || `Listing #${row.listingId}`,
      date,
      statusCode,
      status: statusCode ? interestStatusToCustomerLabel(statusCode) : (existing?.status || "Submitted"),
      tenancyPreference: row.tenancyPreference || existing?.tenancyPreference,
      adultsSharing: row.adultsSharing || existing?.adultsSharing,
      notes: row.notes || existing?.notes,
    });
  }
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );
}

export default function Profile() {
  const { user, logout, loading, updateUserProfile, refreshRole } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 640 : false);
  const [activeTab, setActiveTab] = useState("account");
  const [remoteInterests, setRemoteInterests] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [savedRevision, setSavedRevision] = useState(0);
  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [viewingListing, setViewingListing] = useState(null);

  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileBhk, setProfileBhk] = useState("");
  const [profileArea, setProfileArea] = useState("");
  const [profileMid, setProfileMid] = useState("");
  const [profileBudget, setProfileBudget] = useState("");
  const [profilePriority, setProfilePriority] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [profileLoading, setProfileLoading] = useState(true);

  const emailKey = (user?.email || "").trim().toLowerCase() || "guest@local.moveasy";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?next=/profile", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    refreshRole();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfilePhone(user.phone || "");
    }
  }, [user?.name, user?.phone, user?.uid]);

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

  useEffect(() => {
    if (!user?.email) {
      setActivityLoading(false);
      return;
    }
    let alive = true;
    setActivityLoading(true);
    (async () => {
      try {
        const interests = isFirebaseConfigured
          ? await getInterestsForCustomerEmail(emailKey).catch(() => [])
          : getInterestsGlobal().filter(
              (i) => String(i.customerEmail || "").toLowerCase() === emailKey
            );
        if (!alive) return;
        setRemoteInterests(interests);
      } catch {
        if (!alive) return;
        setRemoteInterests([]);
      } finally {
        if (alive) setActivityLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.email, emailKey]);

  useEffect(() => {
    if (!user) {
      setSaved([]);
      setSavedLoading(false);
      return;
    }
    let alive = true;
    setSavedLoading(true);
    getSavedPropertiesMerged(user)
      .then((rows) => { if (alive) setSaved(rows); })
      .finally(() => { if (alive) setSavedLoading(false); });
    return () => { alive = false; };
  }, [user, savedRevision]);

  const savedListings = saved;

  const applications = useMemo(() => {
    const local = getBookings().filter(
      (b) => String(b.customerEmail || "").toLowerCase() === emailKey
    );
    return mergeApplications(local, remoteInterests);
  }, [emailKey, remoteInterests]);

  const searchHistory = useMemo(() => getFilterHistory(user), [user]);

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
      const flatSearchMirror = {
        bhk: profileBhk || "",
        preferredAreas: profileArea ? [profileArea] : [],
        moveInDate: profileMid || "",
        budgetMax: profileBudget ? Number(profileBudget) : null,
        priority: profilePriority || "",
      };
      const [r1] = await Promise.all([
        updateUserProfile(profileName, profilePhone, flatSearchMirror),
        saveCustomerSearchProfile(user.uid, searchPayload),
      ]);
      if (r1?.success === false) throw new Error(r1.error || "Failed to save profile.");
      setProfileMsg({ type: "ok", text: "Profile saved!" });
    } catch (err) {
      setProfileMsg({ type: "err", text: err.message || "Something went wrong." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleUnsave = async (listingId, title) => {
    await toggleSavedProperty(user, { id: listingId, title });
    setSavedRevision((v) => v + 1);
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100dvh", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ background: PAPER, color: INK, fontFamily: "Inter, sans-serif", minHeight: "100dvh" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: INK }}>
            <div style={{
              width: 30, height: 30, border: `1.5px solid ${INK}`, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 500,
            }}>
              MZ
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600 }}>Moveazy</div>
          </Link>
          <div style={{ flex: 1 }} />
          <Link
            to="/"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: MUTED,
              textDecoration: "none",
              padding: "7px 14px",
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              background: WHITE,
            }}
          >
            Home
          </Link>
        </div>

        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 600, margin: "0 0 8px" }}>My profile</h1>
        <p style={{ fontSize: 14, color: MUTED, margin: "0 0 20px", lineHeight: 1.55 }}>
          Account details, saved homes, listings you contacted, and your recent searches — all in one place.
        </p>

        {/* Summary strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 24,
        }}>
          {[
            { label: "Saved", value: saved.length, tab: "saved" },
            { label: "Contacted", value: applications.length, tab: "contacted" },
            { label: "Searches", value: searchHistory.length, tab: "searches" },
            { label: "Account", value: user.email?.split("@")[0] || "You", tab: "account" },
          ].map((stat) => (
            <button
              key={stat.tab}
              type="button"
              onClick={() => setActiveTab(stat.tab)}
              style={{
                background: activeTab === stat.tab ? WHITE : "transparent",
                border: `1px solid ${activeTab === stat.tab ? INK : LINE}`,
                borderRadius: 12,
                padding: "12px 14px",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {stat.value}
              </div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: `1px solid ${activeTab === tab.id ? INK : LINE}`,
                background: activeTab === tab.id ? INK : WHITE,
                color: activeTab === tab.id ? PAPER : MUTED,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "account" && (
          <SectionCard
            title="Account & search preferences"
            description="Used when we match you to verified homes."
          >
            {profileLoading ? (
              <div style={{ color: MUTED, fontSize: 14 }}>Loading your preferences…</div>
            ) : (
              <form onSubmit={handleProfileSave}>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, paddingBottom: 16, borderBottom: `1px dashed ${LINE}` }}>
                  Signed in as <strong style={{ color: INK }}>{user.email}</strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Full name</label>
                    <input value={profileName} onChange={(e) => setProfileName(e.target.value)} required
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, boxSizing: "border-box", background: WHITE }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Phone</label>
                    <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+91 98765 43210" type="tel"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, boxSizing: "border-box", background: WHITE }} />
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Flat search preferences</div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Flat type</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {FLAT_TYPES.map((f) => (
                      <button key={f} type="button" onClick={() => setProfileBhk(profileBhk === f ? "" : f)}
                        style={{
                          padding: "6px 12px", borderRadius: 999, border: `1px solid ${profileBhk === f ? RUST : LINE}`,
                          background: profileBhk === f ? "#FBEAE0" : WHITE, color: profileBhk === f ? RUST : MUTED,
                          fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Preferred area</label>
                    <select value={profileArea} onChange={(e) => setProfileArea(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, background: WHITE, boxSizing: "border-box" }}>
                      <option value="">Select area…</option>
                      {POPULAR_AREAS.map((a) => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Move-in date</label>
                    <input type="date" value={profileMid} onChange={(e) => setProfileMid(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, boxSizing: "border-box", background: WHITE }} />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 6 }}>Budget per month (₹)</label>
                  <input type="number" value={profileBudget} onChange={(e) => setProfileBudget(e.target.value)} placeholder="25000" min="0" step="500"
                    style={{ width: "100%", maxWidth: 240, padding: "10px 12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, boxSizing: "border-box", background: WHITE }} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Main priority</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {PRIORITIES.map((p) => (
                      <button key={p} type="button" onClick={() => setProfilePriority(p)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
                          border: `1px solid ${profilePriority === p ? RUST : LINE}`,
                          background: profilePriority === p ? "#FBEAE0" : WHITE,
                          color: profilePriority === p ? RUST : INK, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
                        }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {profileMsg.text && (
                  <div style={{
                    marginBottom: 14, padding: "10px 12px", borderRadius: 8, fontSize: 13,
                    background: profileMsg.type === "ok" ? "#E3EEE7" : "#FBEAE0",
                    color: profileMsg.type === "ok" ? VERIFIED : RUST,
                    border: `1px solid ${profileMsg.type === "ok" ? VERIFIED : RUST}`,
                  }}>
                    {profileMsg.text}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button type="submit" disabled={profileSaving}
                    style={{
                      padding: "12px 24px", borderRadius: 10, border: "none", background: INK, color: PAPER,
                      fontWeight: 600, fontSize: 14, cursor: profileSaving ? "wait" : "pointer", opacity: profileSaving ? 0.7 : 1,
                    }}>
                    {profileSaving ? "Saving…" : "Save profile"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    style={{
                      padding: "12px 20px",
                      borderRadius: 10,
                      border: `1px solid ${RUST}`,
                      background: "#FBEAE0",
                      color: RUST,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </form>
            )}
          </SectionCard>
        )}

        {activeTab === "saved" && (
          <SectionCard
            title="Saved listings"
            description="Homes you bookmarked with the heart icon."
          >
            {activityLoading || savedLoading ? (
              <EmptyState text="Loading saved homes…" />
            ) : savedListings.length === 0 ? (
              <EmptyState text="No saved homes yet. When you browse listings, tap the heart to save them here." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                {savedListings.map(({ listingId, listing, savedAt }) => {
                  const price = listing?.price || (listing?.monthlyRent || listing?.rent
                    ? `₹${Number(listing.monthlyRent || listing.rent).toLocaleString("en-IN")}/mo`
                    : "");
                  return (
                    <div key={listingId} style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden", background: PAPER }}>
                      <div style={{ position: "relative" }}>
                        {listing?.image ? (
                          <SmartImage src={listing.image} alt="" listingId={listing.id} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ height: 120, background: "#EFEAE0" }} />
                        )}
                        <button
                          type="button"
                          onClick={() => handleUnsave(listingId, listing?.title)}
                          aria-label="Remove from saved"
                          title="Remove from saved"
                          style={{
                            position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 8,
                            border: `1px solid ${LINE}`, background: "rgba(255,254,251,0.95)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", boxShadow: "0 2px 8px rgba(26,36,33,0.15)",
                          }}
                        >
                          <Trash2 size={14} color={RUST} />
                        </button>
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
                          {listing?.title || `Listing #${listingId}`}
                        </div>
                        {listing?.address ? (
                          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{listing.address}</div>
                        ) : null}
                        {price ? (
                          <div style={{ fontSize: 14, fontWeight: 700, color: VERIFIED, marginTop: 6 }}>{price}</div>
                        ) : null}
                        {savedAt ? (
                          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
                            Saved {new Date(savedAt).toLocaleDateString()}
                          </div>
                        ) : null}
                        {listing ? (
                          <button
                            type="button"
                            onClick={() => setViewingListing(listing)}
                            style={{
                              marginTop: 10, width: "100%", padding: "10px 12px", borderRadius: 8,
                              border: "none", background: INK, fontSize: 13, fontWeight: 700,
                              color: PAPER, cursor: "pointer",
                            }}
                          >
                            View property
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        {viewingListing && (
          <PropertyModal
            property={viewingListing}
            onClose={() => setViewingListing(null)}
          />
        )}

        {activeTab === "contacted" && (
          <SectionCard
            title="Contacted & applications"
            description="Listings where you submitted interest. Status updates when our team moves your application forward."
          >
            {activityLoading ? (
              <EmptyState text="Loading your applications…" />
            ) : applications.length === 0 ? (
              <EmptyState text="No contacted listings yet. When you submit interest on a home, it will show up here with status updates." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {applications.map((app) => (
                  <div
                    key={app.listingId}
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: 12,
                      padding: "14px 16px",
                      background: PAPER,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{app.listingTitle}</div>
                    {app.date ? (
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                        {new Date(app.date).toLocaleString()}
                      </div>
                    ) : null}
                    <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: MUTED }}>Status: </span>
                      <span style={{ color: RUST, fontWeight: 600 }}>{app.status || "Submitted"}</span>
                      {app.tenancyPreference ? (
                        <>
                          {" · "}
                          <span style={{ color: MUTED }}>
                            {TENANCY_LABELS[app.tenancyPreference] || app.tenancyPreference}
                          </span>
                        </>
                      ) : null}
                      {app.adultsSharing ? (
                        <>
                          {" · "}
                          <span style={{ color: MUTED }}>{app.adultsSharing} people</span>
                        </>
                      ) : null}
                    </div>
                    {app.notes ? (
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 8, fontStyle: "italic" }}>{app.notes}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === "searches" && (
          <SectionCard
            title="Recent searches"
            description="Filter sessions from when you explored listings on this device."
          >
            {searchHistory.length === 0 ? (
              <EmptyState text="Your filter combinations will appear here as you explore listings." />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {searchHistory.slice(0, 20).map((h, i) => (
                  <li
                    key={`${h.at}-${i}`}
                    style={{
                      border: `1px solid ${LINE}`,
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: PAPER,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {h.at ? new Date(h.at).toLocaleString() : "Search session"}
                    </div>
                    <div style={{ color: MUTED }}>
                      {h.searchMode === "place" ? "Metro / landmark" : "Location"} ·{" "}
                      {h.selectedLocality ? `"${h.selectedLocality}"` : "Any area"}
                      {h.placeLabel ? ` · Pin: ${h.placeLabel}` : ""}
                      {h.workplaceLabel ? ` · Office: ${h.workplaceLabel}` : ""}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>
                      BHK: {(h.filters?.bhkTypes || []).join(", ") || "Any"} · Rent ₹
                      {Number(h.filters?.minRent || 0).toLocaleString("en-IN")}–₹
                      {Number(h.filters?.maxRent || 0).toLocaleString("en-IN")}
                      {(h.filters?.neighborhoods || []).length
                        ? ` · Areas: ${h.filters.neighborhoods.join(", ")}`
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: `1px dashed ${LINE}`,
        }}>
          <Link to="/" style={{ fontSize: 13, color: MUTED, fontWeight: 600, textDecoration: "none" }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
