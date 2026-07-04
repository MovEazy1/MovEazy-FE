import { AREA_NAMES_SORTED } from "../data/listingsData";
import listingsData from "../data/listingsData";

export const WIZARD_STEPS = [
  { id: "essentials", label: "The Essentials", progress: 33 },
  { id: "describe", label: "Describe Your Space", progress: 66 },
  { id: "publish", label: "Photos & Publish", progress: 100 },
];

export const BHK_OPTIONS = ["1 BHK", "2 BHK", "3 BHK", "4+ BHK"];

export const FURNISHING_OPTIONS = [
  { id: "Furnished", label: "Furnished", icon: "🛏️" },
  { id: "Semi-Furnished", label: "Semi-Furnished", icon: "🏠" },
  { id: "Unfurnished", label: "Unfurnished", icon: "📦" },
];

export const GENDER_OPTIONS = [
  { id: "Any", label: "Any", icon: "〰️" },
  { id: "Male", label: "Male", icon: "👨" },
  { id: "Female", label: "Female", icon: "👩" },
];

export const FLAT_AMENITIES = [
  { id: "WiFi", icon: "📶" },
  { id: "Parking", icon: "🚗" },
  { id: "Lift", icon: "🛗" },
  { id: "Power Backup", icon: "⚡" },
  { id: "AC", icon: "❄️" },
  { id: "Water Heater", icon: "🚿" },
  { id: "Balcony", icon: "🏡" },
  { id: "TV", icon: "📺" },
  { id: "Sofa", icon: "🛋️" },
  { id: "Refrigerator", icon: "🧊" },
  { id: "Microwave", icon: "📻" },
  { id: "Washing Machine", icon: "🧺" },
];

export const HOUSE_RULES = [
  { id: "Veg Only", icon: "🌱" },
  { id: "No Alcohol", icon: "🚫🍷" },
  { id: "No Smoking", icon: "🚭" },
  { id: "Pet Friendly", icon: "🐾" },
  { id: "Guests Allowed", icon: "👥" },
  { id: "Party Allowed", icon: "🎊" },
];

export const DRAFT_STORAGE_KEY = "moveazy_list_my_home_draft";

const areaCoords = new Map(
  listingsData
    .map((row) => {
      const area = String(row.address || "").split(",")[0]?.trim();
      return area ? [area, [row.lat, row.lng]] : null;
    })
    .filter(Boolean)
);

export function titleSuggestions(area) {
  const a = String(area || "").trim() || "Your Area";
  return [`${a} Flat for Rent`, `Renting ${a} Flat`];
}

export function isKnownArea(area) {
  const n = String(area || "").trim();
  return AREA_NAMES_SORTED.some((name) => name.toLowerCase() === n.toLowerCase());
}

export function normalizeBhkForSave(bhk) {
  return bhk === "4+ BHK" ? "3+ BHK" : bhk;
}

export function furnishingToSave(value) {
  if (value === "Furnished") return "Full";
  if (value === "Unfurnished") return "None";
  return "Semi";
}

export function wizardToListingForm(wizard, pinPosition) {
  const area = String(wizard.area || "").trim();
  const city = String(wizard.city || "Bengaluru").trim();
  const nearby = String(wizard.nearbyAddress || "").trim();
  const monthlyRent = Number(wizard.monthlyRent) || 0;
  const addressParts = [area, city].filter(Boolean);
  const address = nearby ? `${nearby}, ${addressParts.join(", ")}` : addressParts.join(", ");

  const preferredTenants = [];
  if (wizard.genderPreference === "Male") preferredTenants.push("Bachelor Male");
  else if (wizard.genderPreference === "Female") preferredTenants.push("Bachelor Female");
  else preferredTenants.push("Family", "Bachelor");

  const propertyType =
    wizard.listingKind === "vacant_room" ? "Room" : "Apartment";

  return {
    title: String(wizard.propertyName || "").trim(),
    price: monthlyRent > 0 ? `₹ ${monthlyRent.toLocaleString("en-IN")} / month` : "",
    bhk: normalizeBhkForSave(wizard.bhk),
    address,
    seller: wizard.seller || "",
    sellerEmail: wizard.sellerEmail || "",
    agentPhonePrivate: wizard.isAgentBroker ? wizard.agentPhonePrivate || "" : "",
    ownerPhonePrivate: wizard.ownerPhonePrivate || "",
    image: "",
    imagesText: "",
    source: wizard.source || "owner-list-my-home",
    sourceUrl: "",
    description: String(wizard.description || "").trim(),
    monthlyRent,
    availability: wizard.availableFrom || "Immediate",
    propertyType,
    furnishing: furnishingToSave(wizard.furnishing),
    preferredTenants,
    parking: wizard.amenitiesSelected.includes("Parking") ? ["2 Wheeler", "4 Wheeler"] : ["2 Wheeler"],
    securityDeposit: String(wizard.securityDeposit || "").trim(),
    maintenanceCost: "",
    brokerage: wizard.isAgentBroker ? "Yes" : "",
    builtUpArea: "",
    areaUnit: "sq ft",
    bathrooms: "",
    balcony: wizard.amenitiesSelected.includes("Balcony") ? "Yes" : "",
    floorNumber: "",
    totalFloors: "",
    leaseType: "",
    ageOfProperty: "",
    parkingInfo: wizard.amenitiesSelected.includes("Parking") ? "Available" : "",
    gasPipeline: "",
    gatedCommunity: "",
    amenitiesText: wizard.amenitiesSelected.join(", "),
    furnishingsText: wizard.furnishing,
    houseRulesText: wizard.houseRulesSelected.join(", "),
    lat: Number(pinPosition?.[0] ?? wizard.lat),
    lng: Number(pinPosition?.[1] ?? wizard.lng),
    listingKind: wizard.listingKind,
    city,
    area,
    nearbyAddress: nearby,
    availableFrom: wizard.availableFrom,
    isAgentBroker: wizard.isAgentBroker,
    genderPreference: wizard.genderPreference,
  };
}

export function coordsForArea(area) {
  const hit = areaCoords.get(String(area || "").trim());
  return hit ? { lat: hit[0], lng: hit[1] } : { lat: 12.9716, lng: 77.5946 };
}

export function validateStep(stepIndex, wizard) {
  const errors = [];
  if (stepIndex === 0) {
    if (!String(wizard.area || "").trim()) errors.push("Area");
    else if (!isKnownArea(wizard.area)) errors.push("Area (select from dropdown)");
    if (!Number(wizard.monthlyRent) || Number(wizard.monthlyRent) <= 0) errors.push("Monthly Rent");
    if (!String(wizard.availableFrom || "").trim()) errors.push("Available From");
    if (!String(wizard.bhk || "").trim()) errors.push("Your flat size");
  }
  if (stepIndex === 1) {
    if (!String(wizard.propertyName || "").trim()) errors.push("Property Name");
  }
  if (stepIndex === 2) {
    if (!wizard.termsAccepted) errors.push("Terms and conditions");
    const essentials = validateStep(0, wizard);
    const describe = validateStep(1, wizard);
    errors.push(...essentials, ...describe);
  }
  return [...new Set(errors)];
}

export function ownerWizardDefaults(user) {
  const email = String(user?.email || "").toLowerCase().trim();
  return {
    listingKind: "entire_flat",
    city: "Bengaluru",
    area: "",
    nearbyAddress: "",
    monthlyRent: "",
    securityDeposit: "",
    availableFrom: "",
    isAgentBroker: false,
    agentPhonePrivate: "",
    ownerPhonePrivate: "",
    bhk: "2 BHK",
    furnishing: "Furnished",
    amenitiesSelected: [],
    houseRulesSelected: [],
    genderPreference: "Any",
    propertyName: "",
    description: "",
    termsAccepted: false,
    seller: user?.name || "Owner",
    sellerEmail: email,
    source: "owner-list-my-home",
    lat: 12.9716,
    lng: 77.5946,
  };
}
