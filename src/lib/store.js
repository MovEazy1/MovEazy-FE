import seedListings from "../data/listingsData";

const KEYS = {
  listings: "moveasy_listings_v2",
  users: "moveasy_users",
  assignments: "moveasy_assignments_v1",
  sellerRequests: "moveasy_seller_requests",
  interests: "moveasy_interests_global_v1",
  notifications: "moveasy_notifications_v1",
  activity: "moveasy_activity_events_v1",
};

const DEFAULT_FILTERS = {
  bhkTypes: [],
  minRent: 10000,
  maxRent: 100000,
  availability: [],
  preferredTenants: [],
  propertyTypes: [],
  furnishing: [],
  parking: [],
  /** Multi-select area names; listing matches if title/address/location contains any */
  neighborhoods: [],
};

export const FILTER_OPTIONS = {
  bhkTypes: ["1 RK", "1 BHK", "2 BHK", "3 BHK", "3+ BHK", "Roommate needed"],
  availability: ["Immediate", "Within 15 days", "Within 30 days", "After 30 days"],
  preferredTenants: ["Family", "Company", "Bachelor Male", "Bachelor Female"],
  propertyTypes: [
    "Gated Societies",
    "Apartment",
    "Independent House/Villa",
    "Gated Community Villa",
  ],
  furnishing: ["Full", "Semi", "None"],
  parking: ["2 Wheeler", "4 Wheeler"],
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function parseRentValue(price) {
  const text = String(price || "").toLowerCase().replace(/,/g, "");
  const lakh = text.match(/(\d+(\.\d+)?)\s*lakh/);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const cr = text.match(/(\d+(\.\d+)?)\s*cr/);
  if (cr) return Math.round(Number(cr[1]) * 10000000);
  const num = text.match(/(\d+(\.\d+)?)/);
  return num ? Math.round(Number(num[1])) : 0;
}

function normalizeBhk(bhk) {
  const map = {
    "1RK": "1 RK",
    "1BHK": "1 BHK",
    "2BHK": "2 BHK",
    "3BHK": "3 BHK",
    "3+BHK": "3+ BHK",
    roommate: "Roommate needed",
  };
  return map[bhk] || bhk;
}

function normalizeListing(listing) {
  const fallbackPriceLabel = listing.price || (listing.rent ? `₹ ${listing.rent}` : "₹ 0");
  const monthlyRentSource = listing.monthlyRent ?? listing.rentPrice ?? listing.rent ?? listing.price;
  const parsedMonthlyRent = parseRentValue(monthlyRentSource);
  const normalizedMonthlyRent = Number(listing.monthlyRent) > 0 ? Number(listing.monthlyRent) : parsedMonthlyRent;
  const coordinates = Array.isArray(listing.coords) && listing.coords.length === 2 ? listing.coords : null;
  const preferredTenants = Array.isArray(listing.preferredTenants)
    ? listing.preferredTenants
    : listing.tenants
      ? [listing.tenants]
      : ["Family"];
  const parking = Array.isArray(listing.parking)
    ? listing.parking
    : typeof listing.parking === "string" && listing.parking.trim()
      ? [listing.parking.trim()]
      : ["2 Wheeler"];
  const normalizeCsvList = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
  };

  return {
    id: listing.id ?? Date.now(),
    title: listing.title ?? "Untitled listing",
    price: fallbackPriceLabel,
    monthlyRent: normalizedMonthlyRent,
    type: listing.type ?? "Rent",
    bhk: normalizeBhk(listing.bhk ?? "1 BHK"),
    address: listing.address ?? listing.location ?? "Bengaluru",
    contact: "",
    seller: listing.seller ?? "Unknown broker",
    sellerEmail: listing.sellerEmail ?? "",
    company: listing.company ?? "",
    image: listing.image ?? listing.images?.[0] ?? "",
    images: Array.isArray(listing.images) ? listing.images : (listing.image ? [listing.image] : []),
    description: listing.description ?? "",
    lat: Number(listing.lat ?? coordinates?.[0] ?? 12.9716),
    lng: Number(listing.lng ?? coordinates?.[1] ?? 77.5946),
    availability: listing.availability ?? "Immediate",
    preferredTenants,
    propertyType: listing.propertyType ?? "Apartment",
    furnishing: listing.furnishing ?? "Semi",
    parking,
    // Optional extended details (non-mandatory)
    securityDeposit: listing.securityDeposit ?? "",
    maintenanceCost: listing.maintenanceCost ?? "",
    brokerage: listing.brokerage ?? "",
    builtUpArea: listing.builtUpArea ?? "",
    areaUnit: listing.areaUnit ?? "sq ft",
    bathrooms: listing.bathrooms ?? "",
    balcony: listing.balcony ?? "",
    floorNumber: listing.floorNumber ?? "",
    totalFloors: listing.totalFloors ?? "",
    leaseType: listing.leaseType ?? "",
    ageOfProperty: listing.ageOfProperty ?? "",
    parkingInfo: listing.parkingInfo ?? "",
    gasPipeline: listing.gasPipeline ?? "",
    gatedCommunity: listing.gatedCommunity ?? "",
    furnishings: normalizeCsvList(listing.furnishings),
    amenities: normalizeCsvList(listing.amenities),
    source: listing.source ?? "manual",
    sourceUrl: listing.sourceUrl ?? "",
    assignedCustomerEmail: listing.assignedCustomerEmail ?? null,
    assignedSellerEmail: listing.assignedSellerEmail ?? listing.sellerEmail ?? null,
    updatedAt: listing.updatedAt ?? new Date().toISOString(),
  };
}

export function getFiltersInitialState() {
  return { ...DEFAULT_FILTERS };
}

export function ensureListingsInitialized() {
  const existing = readJson(KEYS.listings, null);
  if (existing && Array.isArray(existing) && existing.length) {
    const hasValidRent = existing.some((item) => Number(item?.monthlyRent || 0) > 0);
    if (hasValidRent) {
      const existingIds = new Set(existing.map((item) => item?.id));
      const additions = seedListings.filter((item) => !existingIds.has(item.id)).map(normalizeListing);
      if (!additions.length) return;
      writeJson(KEYS.listings, [...existing.map(normalizeListing), ...additions]);
      return;
    }
  }
  const normalized = seedListings.map(normalizeListing);
  writeJson(KEYS.listings, normalized);
}

export function getListings() {
  ensureListingsInitialized();
  return readJson(KEYS.listings, []).map(normalizeListing);
}

export function saveListings(listings) {
  writeJson(KEYS.listings, listings.map(normalizeListing));
}

export function upsertListing(listing) {
  const all = getListings();
  const normalized = normalizeListing(listing);
  const idx = all.findIndex((l) => l.id === normalized.id);
  if (idx >= 0) all[idx] = normalized;
  else all.unshift(normalized);
  saveListings(all);
  return normalized;
}

export function removeListing(id) {
  const filtered = getListings().filter((l) => l.id !== id);
  saveListings(filtered);
}

export function withdrawListingLocal(id) {
  const all = getListings();
  const idx = all.findIndex((l) => String(l.id) === String(id));
  if (idx < 0) return;
  all[idx] = { ...all[idx], marketStatus: "withdrawn" };
  saveListings(all);
}

export function republishListingLocal(id) {
  const all = getListings();
  const idx = all.findIndex((l) => String(l.id) === String(id));
  if (idx < 0) return;
  all[idx] = { ...all[idx], marketStatus: "published" };
  saveListings(all);
}

export function getAllUsers() {
  const users = readJson(KEYS.users, {});
  return Object.entries(users).map(([email, value]) => ({
    uid: `local-${email}`,
    email,
    name: value.name || email.split("@")[0],
    role: value.role || "customer",
    phone: value.phone || "",
  }));
}

export function getUsersByRole(role) {
  return getAllUsers().filter((u) => u.role === role);
}

export function removeUserLocally(email) {
  const users = readJson(KEYS.users, {});
  if (users[email]) {
    delete users[email];
    writeJson(KEYS.users, users);
  }
}

export function addUserLocally(email, name, role, phone = "") {
  const users = readJson(KEYS.users, {});
  users[email.toLowerCase().trim()] = { name, role, phone: String(phone || "").trim() };
  writeJson(KEYS.users, users);
}

export function updateUserLocally(email, { name, role, phone }) {
  const users = readJson(KEYS.users, {});
  const key = email.toLowerCase().trim();
  if (!users[key]) return;
  users[key] = {
    ...users[key],
    ...(name !== undefined ? { name } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(phone !== undefined ? { phone: String(phone || "").trim() } : {}),
  };
  writeJson(KEYS.users, users);
}

export function getAssignments() {
  return readJson(KEYS.assignments, []);
}

export function addAssignment({
  listingId,
  customerEmail,
  customerName = "",
  customerPhone = "",
  sellerEmail,
  sellerName = "",
  sellerContactPhone = "",
  listingTitle = "",
  notes,
  createdBy,
}) {
  const record = {
    id: Date.now(),
    listingId,
    listingTitle: String(listingTitle || "").slice(0, 200),
    customerEmail,
    customerName: String(customerName || "").trim().slice(0, 120),
    customerPhone: String(customerPhone || "").trim().slice(0, 40),
    sellerEmail,
    sellerName: String(sellerName || "").trim().slice(0, 120),
    sellerContactPhone: String(sellerContactPhone || "").trim().slice(0, 40),
    notes: notes || "",
    status: "assigned",
    createdBy: createdBy || "admin",
    createdAt: new Date().toISOString(),
  };
  const all = getAssignments();
  all.unshift(record);
  writeJson(KEYS.assignments, all);

  const listings = getListings();
  const idx = listings.findIndex((l) => l.id === listingId);
  if (idx >= 0) {
    listings[idx] = {
      ...listings[idx],
      assignedCustomerEmail: customerEmail,
      assignedCustomerName: record.customerName || null,
      assignedCustomerPhone: record.customerPhone || null,
      assignedSellerEmail: sellerEmail,
      updatedAt: new Date().toISOString(),
    };
    saveListings(listings);
  }
  return record;
}

export function getSellerRequests() {
  return readJson(KEYS.sellerRequests, []);
}

function listingMatchesNeighborhoods(listing, neighborhoods) {
  if (!neighborhoods?.length) return true;
  const hay = [listing.title, listing.address, listing.location]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return neighborhoods.some((n) => hay.includes(String(n).toLowerCase()));
}

/** --- Local CRM (used when Firebase is off or as browser cache) --- */

export function appendInterestGlobal(record) {
  const all = readJson(KEYS.interests, []);
  const row = {
    id: String(Date.now()),
    ...record,
    createdAt: record.createdAt || new Date().toISOString(),
    status: record.status || "new",
  };
  all.unshift(row);
  writeJson(KEYS.interests, all.slice(0, 800));
  return row;
}

export function getInterestsGlobal() {
  return readJson(KEYS.interests, []);
}

export function updateInterestGlobal(id, updates) {
  const all = readJson(KEYS.interests, []);
  const idx = all.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  writeJson(KEYS.interests, all);
  return all[idx];
}

export function pushNotificationLocal(payload) {
  const all = readJson(KEYS.notifications, []);
  const row = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  all.unshift(row);
  writeJson(KEYS.notifications, all.slice(0, 500));
  return row;
}

export function getNotificationsLocal() {
  return readJson(KEYS.notifications, []);
}

export function markNotificationLocalRead(id) {
  const all = readJson(KEYS.notifications, []);
  const idx = all.findIndex((r) => String(r.id) === String(id));
  if (idx < 0) return;
  all[idx] = { ...all[idx], read: true };
  writeJson(KEYS.notifications, all);
}

export function appendUserActivityEvent({ actorEmail, type, summary, meta }) {
  const all = readJson(KEYS.activity, []);
  const email = String(actorEmail || "").toLowerCase().trim() || "guest@local.moveasy";
  all.unshift({
    id: `a-${Date.now()}`,
    actorEmail: email,
    type: String(type || "event"),
    summary: String(summary || "").slice(0, 400),
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: new Date().toISOString(),
  });
  writeJson(KEYS.activity, all.slice(0, 2000));
}

export function getUserActivityEvents(actorEmail) {
  const email = String(actorEmail || "").toLowerCase().trim();
  return readJson(KEYS.activity, []).filter((r) => String(r.actorEmail).toLowerCase() === email);
}

export function applyListingFilters(listings, filters) {
  return listings.filter((listing) => {
    if (filters.bhkTypes.length && !filters.bhkTypes.includes(listing.bhk)) return false;
    if (listing.monthlyRent < filters.minRent || listing.monthlyRent > filters.maxRent) return false;
    if (filters.availability.length && !filters.availability.includes(listing.availability)) return false;
    if (
      filters.preferredTenants.length &&
      !filters.preferredTenants.some((tenant) => listing.preferredTenants.includes(tenant))
    ) {
      return false;
    }
    if (filters.propertyTypes.length && !filters.propertyTypes.includes(listing.propertyType)) return false;
    if (filters.furnishing.length && !filters.furnishing.includes(listing.furnishing)) return false;
    if (filters.parking.length && !filters.parking.every((p) => listing.parking.includes(p))) return false;
    if (!listingMatchesNeighborhoods(listing, filters.neighborhoods || [])) return false;
    return true;
  });
}
