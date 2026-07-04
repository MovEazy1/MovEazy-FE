const apartmentPhotos = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1560185127-6a1bdb9c7b63?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1600607687939-ce8a6a8b9d1d?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=900",
  "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?auto=format&fit=crop&q=80&w=900"
];

const localities = [
  ["Indiranagar", "Bangalore", 12.9719, 77.6412, 68000],
  ["Koramangala", "Bangalore", 12.9352, 77.6245, 52000],
  ["Whitefield", "Bangalore", 12.9698, 77.75, 46000],
  ["HSR Layout", "Bangalore", 12.9141, 77.6411, 41000],
  ["Bellandur", "Bangalore", 12.93, 77.6762, 48000],
  ["Jayanagar", "Bangalore", 12.925, 77.5938, 39000],
  ["Hebbal", "Bangalore", 13.0358, 77.597, 44000],
  ["Sarjapur Road", "Bangalore", 12.8996, 77.6815, 42000],
  ["Bandra West", "Mumbai", 19.0596, 72.8295, 95000],
  ["Andheri West", "Mumbai", 19.1363, 72.8277, 72000],
  ["Powai", "Mumbai", 19.1176, 72.906, 82000],
  ["Worli", "Mumbai", 19.0176, 72.8177, 175000],
  ["Thane West", "Mumbai", 19.2183, 72.9781, 48000],
  ["Lower Parel", "Mumbai", 18.9959, 72.8303, 130000],
  ["Gurgaon Sector 56", "Delhi NCR", 28.4253, 77.0986, 65000],
  ["DLF Phase 5", "Delhi NCR", 28.4565, 77.0957, 105000],
  ["Noida Sector 62", "Delhi NCR", 28.6279, 77.3649, 36000],
  ["Saket", "Delhi NCR", 28.5245, 77.2066, 78000],
  ["Vasant Kunj", "Delhi NCR", 28.5205, 77.1587, 90000],
  ["Greater Kailash", "Delhi NCR", 28.5485, 77.2432, 110000],
  ["Koregaon Park", "Pune", 18.5362, 73.8938, 52000],
  ["Hinjewadi", "Pune", 18.5913, 73.7389, 34000],
  ["Kharadi", "Pune", 18.5515, 73.9348, 38000],
  ["Baner", "Pune", 18.559, 73.7868, 43000],
  ["Aundh", "Pune", 18.5593, 73.8077, 40000],
  ["Banjara Hills", "Hyderabad", 17.4126, 78.4483, 62000],
  ["Gachibowli", "Hyderabad", 17.4401, 78.3489, 44000],
  ["Madhapur", "Hyderabad", 17.4483, 78.3915, 47000],
  ["Jubilee Hills", "Hyderabad", 17.4326, 78.4071, 85000],
  ["Hitech City", "Hyderabad", 17.4435, 78.3772, 52000],
  ["Adyar", "Chennai", 13.0067, 80.2578, 46000],
  ["OMR Sholinganallur", "Chennai", 12.901, 80.2279, 33000],
  ["Anna Nagar", "Chennai", 13.085, 80.21, 43000],
  ["Velachery", "Chennai", 12.9756, 80.2209, 36000],
  ["Salt Lake Sector V", "Kolkata", 22.5797, 88.4337, 32000],
  ["New Town", "Kolkata", 22.58, 88.47, 30000],
  ["Alipore", "Kolkata", 22.5354, 88.3311, 68000],
  ["C Scheme", "Jaipur", 26.9124, 75.7873, 36000],
  ["Vesu", "Surat", 21.1418, 72.7709, 30000],
  ["Satellite", "Ahmedabad", 23.0303, 72.5178, 42000],
  ["Mahadevpura", "Bangalore", 12.9516, 77.68, 40000]
];

const portals = ["Housing.com", "MagicBricks", "NoBroker", "CommonFloor", "PropTiger", "IndiaProperty", "OLX Properties", "Sulekha Properties", "99acres"];
const brokers = ["Aarav Realty", "Urban Nest Brokers", "MetroKey Estates", "BlueRoof Properties", "Prime Door Realty", "SquareFeet Partners", "Cityscape Homes", "TrustLease Brokers"];
const bhks = ["1 BHK", "2 BHK", "3 BHK", "3+ BHK"];
const propertyTypes = ["Apartment", "Gated Societies", "Independent House/Villa", "Gated Community Villa"];
const furnishing = ["Semi", "Full", "None"];
const availability = ["Immediate", "Within 15 days", "Within 30 days", "After 30 days"];

/** Locality names for map filter chips (Bangalore only). */
export const AREA_NAMES_SORTED = [...new Set(localities.filter(row => row[1] === "Bangalore").map((row) => row[0]))].sort((a, b) => a.localeCompare(b));

const listingsData = localities.map(([locality, city, lat, lng, baseRent], index) => {
  const bhk = bhks[index % bhks.length];
  const monthlyRent = baseRent + (index % 5) * 3500;
  const images = [0, 1, 2].map((offset) => apartmentPhotos[(index + offset) % apartmentPhotos.length]);
  const broker = brokers[index % brokers.length];
  const source = portals[index % portals.length];
  return {
    id: index + 1,
    title: `${bhk} ${propertyTypes[index % propertyTypes.length]} in ${locality}`,
    rent: monthlyRent.toLocaleString("en-IN"),
    price: `₹ ${monthlyRent.toLocaleString("en-IN")}`,
    monthlyRent,
    bhk,
    type: "Rent",
    propertyType: propertyTypes[index % propertyTypes.length],
    location: city,
    address: `${locality}, ${city}`,
    coords: [lat, lng],
    lat,
    lng,
    availability: availability[index % availability.length],
    furnishing: furnishing[index % furnishing.length],
    preferredTenants: index % 3 === 0 ? ["Family", "Company"] : index % 3 === 1 ? ["Family"] : ["Bachelor Male", "Bachelor Female"],
    parking: index % 2 === 0 ? ["2 Wheeler", "4 Wheeler"] : ["2 Wheeler"],
    image: images[0],
    images,
    seller: broker,
    sellerEmail: `${broker.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\\.$/g, "")}@moveasy.example`,
    contact: `+91 98${String(70000000 + index * 137921).slice(0, 8)}`,
    company: broker,
    source: `sample:${source}`,
    sourceUrl: "",
    description: `Sample partner listing near ${locality} with verified map coordinates, broker attribution, and editable gallery photos. Replace with licensed feed data in Admin when available.`,
  };
});

export default listingsData;
