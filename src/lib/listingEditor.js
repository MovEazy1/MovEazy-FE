/** Shared listing form defaults and helpers (admin + List My Home). */

export const DEFAULT_LISTING_FORM = {
  title: "",
  price: "",
  bhk: "2 BHK",
  address: "",
  area: "",
  city: "Bengaluru",
  seller: "",
  sellerEmail: "",
  agentPhonePrivate: "",
  ownerPhonePrivate: "",
  image: "",
  imagesText: "",
  source: "manual",
  sourceUrl: "",
  description: "",
  monthlyRent: 25000,
  availability: "Immediate",
  propertyType: "Apartment",
  furnishing: "Semi",
  preferredTenants: ["Family", "Bachelor"],
  parking: ["2 Wheeler"],
  securityDeposit: "",
  maintenanceCost: "",
  brokerage: "",
  builtUpArea: "",
  sizeSqft: "",
  areaUnit: "sq ft",
  bathrooms: "",
  balcony: "",
  floorNumber: "",
  totalFloors: "",
  leaseType: "",
  ageOfProperty: "",
  parkingInfo: "",
  gasPipeline: "",
  gatedCommunity: "",
  amenitiesText: "",
  furnishingsText: "",
  status: "published",
  isHandover: false,
  waterTimings: "",
  societyRules: "",
  depositTerms: "",
  landlordInfo: "",
  lat: 12.9716,
  lng: 77.5946,
};

export function toList(value, fallback) {
  if (Array.isArray(value) && value.length) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

export function normalizeUrlList(value) {
  const raw = [];
  if (Array.isArray(value)) raw.push(...value);
  else if (typeof value === "string" && value.trim()) raw.push(...value.split(/\r?\n|,/));
  return raw.map((x) => String(x || "").trim()).filter(Boolean);
}

export function pickListingMediaUrls(listing) {
  const candidates = [
    listing?.images,
    listing?.photos,
    listing?.gallery,
    listing?.media,
    listing?.mediaUrls,
    listing?.imageUrls,
  ];
  const urls = [];
  candidates.forEach((c) => urls.push(...normalizeUrlList(c)));
  if (listing?.image) urls.unshift(String(listing.image).trim());
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    const k = u.toLowerCase();
    if (!u || seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

export function listingToForm(listing) {
  const mediaUrls = pickListingMediaUrls(listing);
  return {
    title: listing.title || listing.display_title || "",
    price: listing.price || "",
    bhk: listing.bhk || listing.bhk_type || "2 BHK",
    address: listing.address || listing.full_address || listing.location_details || "",
    area: listing.area || "",
    city: listing.city || "Bengaluru",
    seller: listing.seller || listing.owner_name || "",
    sellerEmail: listing.sellerEmail || listing.owner_email || "",
    image: listing.image || listing.cover_image_url || mediaUrls[0] || "",
    imagesText: mediaUrls.length ? mediaUrls.join("\n") : "",
    source: listing.source || "manual",
    sourceUrl: listing.sourceUrl || "",
    description: listing.description || "",
    monthlyRent: Number(listing.monthlyRent || listing.monthly_rent || listing.rent_amount || 25000),
    availability: listing.availability || "Immediate",
    propertyType: listing.propertyType || listing.property_type || "Apartment",
    furnishing: listing.furnishing || "Semi",
    preferredTenants: toList(listing.preferredTenants, ["Family"]),
    parking: toList(listing.parking, ["2 Wheeler"]),
    securityDeposit: listing.securityDeposit || listing.security_deposit || listing.deposit_amount || "",
    maintenanceCost: listing.maintenanceCost || "",
    brokerage: listing.brokerage || "",
    builtUpArea: listing.builtUpArea || listing.built_up_area || "",
    sizeSqft: listing.sizeSqft || listing.size_sqft || "",
    areaUnit: listing.areaUnit || "sq ft",
    bathrooms: listing.bathrooms || "",
    balcony: listing.balcony || "",
    floorNumber: listing.floorNumber || listing.floor_number || "",
    totalFloors: listing.totalFloors || listing.total_floors || "",
    leaseType: listing.leaseType || listing.lease_type || "",
    ageOfProperty: listing.ageOfProperty || listing.age_of_property || "",
    parkingInfo: listing.parkingInfo || listing.parking_info || "",
    gasPipeline: listing.gasPipeline || listing.gas_pipeline || "",
    gatedCommunity: listing.gatedCommunity || listing.gated_community || "",
    amenitiesText: Array.isArray(listing.amenities) ? listing.amenities.join(", ") : listing.amenities || "",
    furnishingsText: Array.isArray(listing.furnishings) ? listing.furnishings.join(", ") : listing.furnishings || "",
    status: listing.status || listing.marketStatus || "published",
    isHandover: listing.isHandover || listing.is_handover || false,
    waterTimings: listing.waterTimings || listing.water_timings || "",
    societyRules: listing.societyRules || listing.society_rules || "",
    depositTerms: listing.depositTerms || listing.deposit_terms || "",
    landlordInfo: listing.landlordInfo || listing.landlord_info || "",
    lat: Number(listing.lat || 12.9716),
    lng: Number(listing.lng || 77.5946),
    agentPhonePrivate: "",
    ownerPhonePrivate: "",
  };
}

export function parseFormMediaUrls(form) {
  const raw = String(form.imagesText || form.image || "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const url of raw) {
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out.slice(0, 24);
}

export function isVideoUrl(url) {
  const u = String(url || "").toLowerCase();
  return u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".ogg") || u.endsWith(".mov") || u.includes("video");
}

export function ownerListingFormDefaults(user) {
  const email = String(user?.email || "").toLowerCase().trim();
  return {
    ...DEFAULT_LISTING_FORM,
    seller: user?.name || "Owner",
    sellerEmail: email,
    source: "owner-list-my-home",
  };
}
