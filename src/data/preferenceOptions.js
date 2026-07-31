/**
 * Single source of truth for the preference vocabulary shared between the
 * demand side (Train My Broker → AIBroker.jsx, saved as a customer search
 * profile) and the supply side (List my Flat → ListMyFlat.jsx, saved to the
 * `inventory` table).
 *
 * Both sides MUST describe a home with the exact same option strings, otherwise
 * the requirement↔listing matching in lib/inventoryMatch.js can never line up.
 * Add or rename an option here once and both flows stay in lockstep.
 */

export const LOCALITIES = ["HSR", "Koramangala", "Indiranagar", "Bellandur", "Whitefield", "Electronic City", "Sarjapur", "BTM", "JP Nagar", "Marathahalli"];
export const LOCALITIES_MORE = ["Jayanagar", "Hebbal", "Mahadevpura", "Bannerghatta Rd", "Yelahanka", "Rajajinagar"];
export const OCCUPANTS = ["Bachelor", "Family", "Couple", "Working Professionals", "Students", "Pet Owner"];
export const FLAT_TYPES = ["1 RK", "1 BHK", "2 BHK", "3 BHK", "Villa", "Room in Preoccupied flat"];
export const MUST_HAVES = ["Balcony", "Gym", "Swimming Pool", "Lift", "Covered Parking", "Power Backup", "Security", "Terrace", "Garden", "Maid Room", "Modular Kitchen", "Study Room", "Pet Friendly", "Near Metro", "Near Office", "Gated Society", "Good Sunlight", "Quiet Area", "High Floor", "Low Floor"];
export const LIFESTYLE = ["Walkable cafes", "Nightlife", "Parks", "Running Track", "Office Commute", "Schools", "Hospitals", "Grocery Nearby", "Peaceful Area", "Young Crowd", "Community Living"];
export const DEALBREAKERS = ["No Sunlight", "Ground Floor", "Too Far From Metro", "Bachelor Restrictions", "Old Buildings", "Small Kitchen", "Traffic Heavy Roads", "Water Problems", "Poor Mobile Network"];
export const OFFICE_CHIPS = ["Manyata Tech Park", "Embassy Tech Village", "Bagmane Tech Park", "Electronic City", "RMZ Ecoworld", "Prestige Tech Park"];
export const AGES = ["18–24", "25–30", "31–35", "36–45", "46+"];
export const FURNISHINGS = ["Fully Furnished", "Semi Furnished", "Unfurnished"];

/** Every locality, in one flat list (for List my Flat dropdowns). */
export const ALL_LOCALITIES = [...LOCALITIES, ...LOCALITIES_MORE];

/** Budget slider bounds — mirrored by the rent field on the listing side. */
export const BUDGET = { MIN: 15000, MAX: 200000, STEP: 1000 };
