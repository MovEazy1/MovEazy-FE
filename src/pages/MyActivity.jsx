import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageShell from "../components/layout/PageShell";
import { getListings } from "../lib/store";
import { isFirebaseConfigured } from "../lib/firebase";
import { getListingsData, isListingPubliclyVisible } from "../lib/firestoreStore";
import { getSavedMap, getFilterHistory, getBookings, setMapRestorePayload } from "../lib/userActivity";

const tenancyLabels = {
  entire_unit: "Whole unit",
  seeking_flatmate: "Seeking flatmate",
  open_to_share: "Open to share",
};

export default function MyActivity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 768 : false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = isFirebaseConfigured ? await getListingsData({ limitCount: 500 }) : getListings();
        if (!alive) return;
        setListings(rows.filter(isListingPubliclyVisible));
      } catch {
        if (!alive) return;
        setListings(getListings());
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const emailKey = (user?.email || "").trim().toLowerCase() || "guest@local.moveasy";
  const saved = useMemo(() => getSavedMap(user), [user]);
  const savedListings = useMemo(() => {
    const ids = new Set(saved.map((s) => String(s.listingId)));
    return listings.filter((l) => ids.has(String(l.id)));
  }, [saved, listings]);

  const history = useMemo(() => getFilterHistory(user), [user]);
  const bookings = useMemo(() => {
    const all = getBookings();
    return all.filter((b) => String(b.customerEmail || "").toLowerCase() === emailKey);
  }, [user, emailKey]);

  const cardBtn = {
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    background: "white",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  };

  return (
    <PageShell
      variant="marketing"
      overlayOnly
      style={{ background: "linear-gradient(180deg, #fff8f5 0%, #f8fafc 100%)" }}
    >
      <header
        style={{
          padding: isMobile ? "14px 16px" : "18px 28px",
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.95)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 26, fontWeight: 800, color: "#0f172a" }}>Saved and activity</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#64748b", maxWidth: 560, lineHeight: 1.5 }}>
            Saved homes, applications you submitted from the map, and recent filter sessions on this device.
          </p>
        </div>
        <button type="button" onClick={() => navigate("/map")} style={{ ...cardBtn, background: "#b91c1c", color: "white", borderColor: "#b91c1c" }}>
          Back to map
        </button>
      </header>

      <main style={{ padding: isMobile ? "16px 14px 32px" : "24px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>Saved listings</h2>
          {savedListings.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>No saved homes yet. Tap the heart on a property card or in the detail view.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {savedListings.map((l) => (
                <div key={l.id} style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,0.06)" }}>
                  {l.image ? (
                    <img src={l.image} alt="" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ height: 140, background: "#f1f5f9" }} />
                  )}
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", lineHeight: 1.35 }}>{l.title}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{l.address}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d", marginTop: 8 }}>{l.price}</div>
                    <button type="button" onClick={() => navigate(`/map?listingId=${encodeURIComponent(l.id)}`)} style={{ ...cardBtn, marginTop: 10, width: "100%" }}>
                      Open on map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>Applications and status</h2>
          {bookings.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>No applications yet. Open a listing and use Submit interest.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bookings.map((b, idx) => (
                <div
                  key={`${b.listingId}-${idx}`}
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "14px 16px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{b.listingTitle}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                      {b.date ? new Date(b.date).toLocaleString() : ""}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 8, color: "#334155" }}>
                      <strong>Status:</strong>{" "}
                      <span style={{ color: "#b45309", fontWeight: 700 }}>{b.status || "Submitted"}</span>
                      {b.tenancyPreference ? (
                        <>
                          {" "}
                          · <strong>Preference:</strong> {tenancyLabels[b.tenancyPreference] || b.tenancyPreference}
                        </>
                      ) : null}
                      {b.adultsSharing ? (
                        <>
                          {" "}
                          · <strong>Split among:</strong> {b.adultsSharing} people
                        </>
                      ) : null}
                    </div>
                    {b.notes ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, fontStyle: "italic" }}>{b.notes}</div> : null}
                  </div>
                  <button type="button" onClick={() => navigate(`/map?listingId=${encodeURIComponent(b.listingId)}`)} style={cardBtn}>
                    View listing
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>Recent searches (filters)</h2>
          {history.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>Your filter combinations will appear here as you explore the map.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {history.slice(0, 20).map((h, i) => (
                <li
                  key={`${h.at}-${i}`}
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "12px 14px",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{h.at ? new Date(h.at).toLocaleString() : ""}</div>
                    <div style={{ marginTop: 4 }}>
                      {h.searchMode === "place" ? "Metro / landmark" : "Location text"} · {h.selectedLocality ? `“${h.selectedLocality}”` : "Any text"}
                      {h.placeLabel ? ` · Pin: ${h.placeLabel}` : ""}
                      {h.workplaceLabel ? ` · Office: ${h.workplaceLabel}` : ""}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
                      BHK: {(h.filters?.bhkTypes || []).join(", ") || "Any"} · Rent ₹{Number(h.filters?.minRent || 0).toLocaleString("en-IN")}–₹
                      {Number(h.filters?.maxRent || 0).toLocaleString("en-IN")}
                      {(h.filters?.neighborhoods || []).length ? ` · Areas: ${h.filters.neighborhoods.join(", ")}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMapRestorePayload({
                        filters: h.filters,
                        selectedLocality: h.selectedLocality || "",
                        mapSearchInput: h.selectedLocality || h.workplaceLabel || "",
                        searchMode: h.searchMode || "local",
                        commuteRadiusKm:
                          h.commuteRadiusKm != null && Number.isFinite(Number(h.commuteRadiusKm))
                            ? Number(h.commuteRadiusKm)
                            : undefined,
                        placeAnchor:
                          h.placeLat != null && h.placeLng != null
                            ? { lat: h.placeLat, lng: h.placeLng, label: h.placeLabel || "Saved place" }
                            : null,
                        workplaceAnchor:
                          h.workLat != null && h.workLng != null
                            ? { lat: h.workLat, lng: h.workLng, label: h.workplaceLabel || "Office" }
                            : null,
                      });
                      navigate("/map");
                    }}
                    style={cardBtn}
                  >
                    Restore on map
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 12, lineHeight: 1.5 }}>
            Restore reapplies filters, location text, and saved metro or workplace pins when those were stored for that session.
          </p>
        </section>
      </main>
    </PageShell>
  );
}
