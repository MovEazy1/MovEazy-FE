import { useEffect, useMemo, useState } from "react";
import MediaUploadField from "../MediaUploadField";
import ListingMapPicker from "../ListingMapPicker";
import { isVideoUrl, parseFormMediaUrls } from "../../lib/listingEditor";

const inputStyle = { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", width: "100%" };

/**
 * Admin-style create/edit listing form (shared with List My Home).
 */
export default function ListingEditorForm({
  form,
  setForm,
  pinPosition,
  setPinPosition,
  photoFiles,
  setPhotoFiles,
  editingId = null,
  onSubmit,
  title = "Create listing",
  hint = "For now, every field is optional. If seller email is empty or invalid, the listing is stored under your signed-in email. If monthly rent is 0, a number from the price label is used when possible.",
  msg = "",
  msgKind = "ok",
  warning = "",
  submitLabel,
  lockSellerEmail = false,
  hideSourceFields = false,
}) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 900 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const parsedListingMediaUrls = useMemo(() => parseFormMediaUrls(form), [form.imagesText, form.image]);
  const btn = { padding: "8px 16px", borderRadius: "8px", border: "none", fontWeight: 600, fontSize: "13px", cursor: "pointer" };
  const gridCols = isMobile ? "1fr" : "repeat(4, 1fr)";
  const span2 = isMobile ? "auto" : "span 2";
  const span4 = isMobile ? "auto" : "span 4";

  return (
    <div style={{ background: "white", padding: isMobile ? "12px" : "16px", borderRadius: "12px" }}>
      <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "10px" }}>{editingId ? "Edit listing" : title}</div>
      {hint ? (
        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px", lineHeight: 1.45 }}>{hint}</div>
      ) : null}
      {msg ? (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: `1px solid ${msgKind === "err" ? "#fecaca" : "#bbf7d0"}`,
            background: msgKind === "err" ? "#fef2f2" : "#f0fdf4",
            color: msgKind === "err" ? "#b91c1c" : "#15803d",
          }}
        >
          {msg}
          {warning ? (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#92400e", fontWeight: 600 }}>{warning}</div>
          ) : null}
        </div>
      ) : null}
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gridTemplateColumns: gridCols, gap: "10px" }}
      >
        <input style={inputStyle} placeholder="Title (optional)" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        <input style={inputStyle} placeholder="Price label (optional, e.g. ₹40,000 / month)" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
        <input
          style={inputStyle}
          type="number"
          min={0}
          step="any"
          placeholder="Monthly rent (optional)"
          value={Number.isFinite(Number(form.monthlyRent)) ? form.monthlyRent : 0}
          onChange={(e) => setForm((p) => ({ ...p, monthlyRent: e.target.value === "" ? 0 : Number(e.target.value) }))}
        />
        <select style={inputStyle} value={form.bhk} onChange={(e) => setForm((p) => ({ ...p, bhk: e.target.value }))}>
          <option>1 RK</option>
          <option>1 BHK</option>
          <option>2 BHK</option>
          <option>3 BHK</option>
          <option>3+ BHK</option>
        </select>
        <input style={inputStyle} placeholder="Address (optional)" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        <input style={inputStyle} placeholder="Area / locality (e.g. HSR Layout)" value={form.area || ""} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))} />
        <input style={inputStyle} placeholder="City (default: Bengaluru)" value={form.city || ""} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
        <select style={inputStyle} value={form.status || "published"} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
          <option value="published">Published</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="draft">Draft</option>
          <option value="available">Available</option>
          <option value="rented">Rented</option>
        </select>
        <input style={inputStyle} placeholder="Seller name (optional)" value={form.seller} onChange={(e) => setForm((p) => ({ ...p, seller: e.target.value }))} />
        <input
          style={inputStyle}
          type="text"
          placeholder="Seller email (optional)"
          value={form.sellerEmail}
          readOnly={lockSellerEmail}
          onChange={(e) => setForm((p) => ({ ...p, sellerEmail: e.target.value }))}
        />
        <div style={{ gridColumn: span2, fontSize: 12, color: "#64748b", lineHeight: 1.45, padding: "6px 0" }}>
          Broker and owner numbers are stored only in <strong>private</strong> fields — they are not on the public listing document.
        </div>
        <input style={inputStyle} placeholder="Agent / broker number (private)" value={form.agentPhonePrivate} onChange={(e) => setForm((p) => ({ ...p, agentPhonePrivate: e.target.value }))} />
        <input style={inputStyle} placeholder="Owner / landlord number (private)" value={form.ownerPhonePrivate} onChange={(e) => setForm((p) => ({ ...p, ownerPhonePrivate: e.target.value }))} />
        <input style={inputStyle} placeholder="Main photo URL" value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} />
        {!hideSourceFields ? (
          <>
            <input style={inputStyle} placeholder="Source / portal" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} />
            <input style={inputStyle} placeholder="Source URL" value={form.sourceUrl} onChange={(e) => setForm((p) => ({ ...p, sourceUrl: e.target.value }))} />
          </>
        ) : null}
        <textarea
          placeholder="Gallery photo URLs, one per line"
          value={form.imagesText}
          onChange={(e) => setForm((p) => ({ ...p, imagesText: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "70px" }}
        />
        <textarea
          placeholder="Listing description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "70px" }}
        />
        <input style={inputStyle} placeholder="Security deposit — e.g. 3 months or 126000" value={form.securityDeposit} onChange={(e) => setForm((p) => ({ ...p, securityDeposit: e.target.value }))} />
        <input style={inputStyle} placeholder="Maintenance cost (optional)" value={form.maintenanceCost} onChange={(e) => setForm((p) => ({ ...p, maintenanceCost: e.target.value }))} />
        <input
          style={inputStyle}
          placeholder="Preferred tenants — e.g. Family, Bachelor"
          value={Array.isArray(form.preferredTenants) ? form.preferredTenants.join(", ") : form.preferredTenants || ""}
          onChange={(e) => setForm((p) => ({ ...p, preferredTenants: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
        />
        <input style={inputStyle} placeholder="Brokerage (optional)" value={form.brokerage} onChange={(e) => setForm((p) => ({ ...p, brokerage: e.target.value }))} />
        <input style={inputStyle} placeholder="Built up area (optional)" value={form.builtUpArea} onChange={(e) => setForm((p) => ({ ...p, builtUpArea: e.target.value }))} />
        <input style={inputStyle} placeholder="Size in sq ft (optional)" value={form.sizeSqft || ""} onChange={(e) => setForm((p) => ({ ...p, sizeSqft: e.target.value }))} />
        <input style={inputStyle} placeholder="Bathrooms (optional)" value={form.bathrooms} onChange={(e) => setForm((p) => ({ ...p, bathrooms: e.target.value }))} />
        <input style={inputStyle} placeholder="Balcony (optional)" value={form.balcony} onChange={(e) => setForm((p) => ({ ...p, balcony: e.target.value }))} />
        <input style={inputStyle} placeholder="Floor no. (optional)" value={form.floorNumber} onChange={(e) => setForm((p) => ({ ...p, floorNumber: e.target.value }))} />
        <input style={inputStyle} placeholder="Total floors (optional)" value={form.totalFloors} onChange={(e) => setForm((p) => ({ ...p, totalFloors: e.target.value }))} />
        <input style={inputStyle} placeholder="Lease type (optional)" value={form.leaseType} onChange={(e) => setForm((p) => ({ ...p, leaseType: e.target.value }))} />
        <input style={inputStyle} placeholder="Age of property (optional)" value={form.ageOfProperty} onChange={(e) => setForm((p) => ({ ...p, ageOfProperty: e.target.value }))} />
        <input style={inputStyle} placeholder="Parking info (optional)" value={form.parkingInfo} onChange={(e) => setForm((p) => ({ ...p, parkingInfo: e.target.value }))} />
        <input style={inputStyle} placeholder="Gas pipeline (optional)" value={form.gasPipeline} onChange={(e) => setForm((p) => ({ ...p, gasPipeline: e.target.value }))} />
        <input style={inputStyle} placeholder="Gated community (optional)" value={form.gatedCommunity} onChange={(e) => setForm((p) => ({ ...p, gatedCommunity: e.target.value }))} />
        <input style={inputStyle} placeholder="Water timings (optional, e.g. 6-8am, 6-8pm)" value={form.waterTimings || ""} onChange={(e) => setForm((p) => ({ ...p, waterTimings: e.target.value }))} />
        <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed #e2e8f0", paddingTop: "8px", marginTop: "4px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>Tenancy & legal details</div>
        <textarea
          placeholder="Society rules (optional)"
          value={form.societyRules || ""}
          onChange={(e) => setForm((p) => ({ ...p, societyRules: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "64px" }}
        />
        <textarea
          placeholder="Deposit terms (optional, e.g. 2 months, non-refundable after 11 months)"
          value={form.depositTerms || ""}
          onChange={(e) => setForm((p) => ({ ...p, depositTerms: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "64px" }}
        />
        <textarea
          placeholder="Landlord info (optional, e.g. Mr. Sharma — NRI owner, POA managed)"
          value={form.landlordInfo || ""}
          onChange={(e) => setForm((p) => ({ ...p, landlordInfo: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "64px" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer", gridColumn: span2 }}>
          <input
            type="checkbox"
            checked={!!form.isHandover}
            onChange={(e) => setForm((p) => ({ ...p, isHandover: e.target.checked }))}
            style={{ width: 16, height: 16 }}
          />
          This is a tenant handover listing (pass-it-forward)
        </label>
        <textarea
          placeholder="Furnishings (comma separated, optional)"
          value={form.furnishingsText}
          onChange={(e) => setForm((p) => ({ ...p, furnishingsText: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "64px" }}
        />
        <textarea
          placeholder="Amenities (comma separated, optional)"
          value={form.amenitiesText}
          onChange={(e) => setForm((p) => ({ ...p, amenitiesText: e.target.value }))}
          style={{ ...inputStyle, gridColumn: span2, minHeight: "64px" }}
        />
        {parsedListingMediaUrls.length > 0 ? (
          <div style={{ gridColumn: "1 / -1", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              Current saved media ({parsedListingMediaUrls.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
              {parsedListingMediaUrls.map((url) => (
                <div key={url} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  {isVideoUrl(url) ? (
                    <video src={url} controls style={{ width: "100%", height: 78, objectFit: "cover", display: "block" }} />
                  ) : (
                    <img src={url} alt="" loading="lazy" style={{ width: "100%", height: 78, objectFit: "cover", display: "block" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ gridColumn: span4 }}>
          <MediaUploadField files={photoFiles} setFiles={setPhotoFiles} maxFiles={12} title="Listing Media Upload" />
        </div>
        <div style={{ gridColumn: span4, marginTop: "4px", fontSize: "12px", fontWeight: 600, color: "#334155" }}>
          Map pin: {pinPosition?.[0]?.toFixed(4)}, {pinPosition?.[1]?.toFixed(4)} — search to move map, then click to place the pin.
        </div>
        <div style={{ gridColumn: span4 }}>
          <ListingMapPicker
            key={String(editingId || "new")}
            markerPosition={pinPosition}
            onMarkerChange={setPinPosition}
            height={260}
            initialZoom={13}
          />
        </div>
        <button
          type="submit"
          style={{ ...btn, background: "#16a34a", color: "white", gridColumn: span4, marginTop: "8px", padding: "12px 18px", fontSize: "15px" }}
        >
          {submitLabel || (editingId ? "Update listing" : "Create listing")}
        </button>
      </form>
    </div>
  );
}
