/**
 * Every owner-app screen, rendered with a realistic portfolio, so a screen that
 * throws on real data fails here rather than in front of an owner. Server-side
 * render: effects do not run, so nothing touches the network.
 *
 * Also pins the V1 scope decision: no screen talks about rent payments, dues
 * or receipts.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "u1", name: "Priya Kumar", email: "priya@example.com", phone: "9876500001" },
    loading: false, logout: () => {}, loginWithGoogle: async () => ({ success: true }),
  }),
}));
vi.mock("../../components/ListingMapPicker", () => ({ default: () => null }));
vi.mock("../../components/SmartImage", () => ({ default: () => null }));

const { OwnerContext } = await import("./OwnerApp");
const screens = {
  OwnerHome: (await import("./OwnerHome")).default,
  PropertiesList: (await import("./PropertiesList")).default,
  PropertyForm: (await import("./PropertyForm")).default,
  PropertyDetail: (await import("./PropertyDetail")).default,
  FindTenant: (await import("./FindTenant")).default,
  TenantsList: (await import("./TenantsList")).default,
  TenantForm: (await import("./TenantForm")).default,
  TenantProfile: (await import("./TenantProfile")).default,
  ServicesHome: (await import("./ServicesHome")).default,
  RepairsList: (await import("./RepairsList")).default,
  NewRepair: (await import("./NewRepair")).default,
  RequestDetail: (await import("./RequestDetail")).default,
  IncreaseRent: (await import("./IncreaseRent")).default,
  DesignerCall: (await import("./DesignerCall")).default,
  DocumentsPage: (await import("./DocumentsPage")).default,
  NotificationsPage: (await import("./NotificationsPage")).default,
  MorePage: (await import("./MorePage")).default,
};

const property = (over) => ({
  property_id: "MZ-OWN001", status: "rented", title: "2 BHK in HSR Layout", area: "HSR Layout", nearby_areas: [],
  full_address: "27th Main", rent: 32000, deposit: 100000, flat_type: "2 BHK", bedrooms: 2, furnishing: "Fully Furnished",
  property_type: "Apartment", area_sqft: 1200, images: ["https://x.test/a.jpg", "https://x.test/b.jpg"], cover_image_url: "https://x.test/a.jpg",
  amenities: [], description: "", view_count: 40, likes: 3, visit_requests: 1, visits_booked: 2, upcoming_visits: 1,
  shortlisted: 2, open_requests: 1, active_tenants: 1, linked_at: "2026-01-01T00:00:00Z", available_from: null, ...over,
});
const properties = [
  property(),
  property({ property_id: "MZ-OWN002", status: "published", area: "Bellandur", flat_type: "1 BHK", rent: 22000, images: [], cover_image_url: "" }),
  property({ property_id: "MZ-OWN003", status: "paused", area: "Whitefield", flat_type: "3 BHK", rent: 45000 }),
];
const tenants = [
  { id: "t1", property_id: "MZ-OWN001", name: "Rahul Mehta", phone: "9876543210", email: "rahul@example.com", occupation: "Engineer",
    company: "Google", linkedin_url: "https://www.linkedin.com/in/rahul", move_in_date: "2025-01-15", lease_end_date: "2026-10-10",
    moved_out_on: null, notes: "", status: "active", created_at: "2025-01-10T00:00:00Z" },
  { id: "t2", property_id: "MZ-OWN003", name: "Sneha Iyer", phone: "9876543211", email: "", occupation: "", company: "",
    linkedin_url: "", move_in_date: "2024-02-01", lease_end_date: null, moved_out_on: "2026-06-30", notes: "", status: "past", created_at: "2024-01-20T00:00:00Z" },
];
const requests = [
  { id: "r1", property_id: "MZ-OWN001", property_ids: ["MZ-OWN001"], kind: "repair", category: "plumbing", service_id: null,
    title: "Plumbing repair", description: "Kitchen tap", photos: [], preferred_date: null, preferred_slot: "any",
    status: "awaiting_approval", vendor_name: "Ravi", vendor_phone: "9000000000", scheduled_at: null, quote_amount: 3500,
    quote_note: "Replace mixer", quote_status: "pending", final_cost: null, resolved_at: null, created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-21T10:00:00Z", events: [{ at: "2026-09-20T10:00:00Z", actor: "owner", kind: "created", message: "Repair requested" }] },
  { id: "r2", property_id: "MZ-OWN001", property_ids: ["MZ-OWN001", "MZ-OWN002"], kind: "designer_call", category: "designer",
    service_id: null, title: "Home Designer call", description: "", photos: [], preferred_date: "2026-10-02", preferred_slot: "evening",
    status: "open", vendor_name: "", vendor_phone: "", scheduled_at: null, quote_amount: null, quote_note: "", quote_status: "none",
    final_cost: null, resolved_at: null, created_at: "2026-09-25T10:00:00Z", updated_at: "2026-09-25T10:00:00Z", events: [] },
];
const ctx = {
  me: { owner: { name: "Priya Kumar", phone: "9876500001", email: "priya@example.com", status: "approved", approved_at: "2026-01-01" }, staff: false },
  reloadMe: () => {}, properties, propError: "", reloadProperties: async () => {},
  byId: new Map(properties.map((p) => [p.property_id, p])), tenants, setTenants: () => {}, reloadTenants: async () => {},
  ratings: { t1: { tenant_id: "t1", stars: 4, comment: "Pays on time" } }, setRatings: () => {},
  requests, setRequests: () => {}, reloadRequests: async () => {},
  ui: { occ: "all", q: "", sort: "recent", area: "", type: "" }, setUi: () => {},
};

function render(name, path, route = path.split("?")[0]) {
  const Screen = screens[name];
  // React marks text-node boundaries with <!-- --> in server output; the
  // screen reads them as one string, so the test does too.
  return renderToString(
    <MemoryRouter initialEntries={[`/owners${path}`]}>
      <OwnerContext.Provider value={ctx}>
        <Routes><Route path={`/owners${route}`} element={<Screen />} /></Routes>
      </OwnerContext.Provider>
    </MemoryRouter>,
  ).replaceAll("<!-- -->", "");
}

const CASES = [
  ["OwnerHome", "/", "/", ["YOUR PORTFOLIO", "3 properties", "Needs your attention", "Approve a quote", "Increase Rent"]],
  ["PropertiesList", "/properties", "/properties", ["My Properties", "Occupied (1)", "Vacant (2)", "Find a Tenant"]],
  ["PropertyForm", "/properties/new", "/properties/new", ["Add Property", "Is it rented right now?"]],
  ["PropertyForm", "/properties/MZ-OWN001/edit", "/properties/:id/edit", ["Edit Property", "32000"]],
  ["PropertyDetail", "/properties/MZ-OWN001", "/properties/:id", ["2 BHK in HSR Layout", "1,200 sq ft", "Rahul Mehta", "Increase Rent"]],
  ["FindTenant", "/properties/MZ-OWN002/find-tenant", "/properties/:id/find-tenant", ["Live on MovEazy", "Visit times", "Interested renters"]],
  ["TenantsList", "/tenants", "/tenants", ["My Tenants", "Rahul Mehta", "Lease ends"]],
  ["TenantForm", "/tenants/new?property=MZ-OWN001", "/tenants/new", ["Add Tenant", "Move-in date"]],
  ["TenantProfile", "/tenants/t1", "/tenants/:id", ["Rahul Mehta", "Personal Information", "linkedin.com/in/rahul", "Your rating"]],
  ["ServicesHome", "/services", "/services", ["Home Services", "Repairs &amp; requests"]],
  ["RepairsList", "/repairs", "/repairs", ["Repairs &amp; Maintenance", "Needs approval", "Home Designer call"]],
  ["NewRepair", "/repairs/new", "/repairs/new", ["Select Service", "Plumbing", "Submit Request"]],
  ["RequestDetail", "/repairs/r1", "/repairs/:id", ["Quote waiting for you", "Approve", "Ravi"]],
  ["IncreaseRent", "/increase-rent?property=MZ-OWN001", "/increase-rent", ["FREE HOME DESIGNER CALL", "Call requested"]],
  ["DesignerCall", "/designer-call", "/designer-call", ["Which properties?", "Book my free call"]],
  ["DocumentsPage", "/documents", "/documents", ["Documents", "Add document"]],
  ["NotificationsPage", "/notifications", "/notifications", ["Notifications"]],
  ["MorePage", "/more", "/more", ["Priya Kumar", "Verified", "Help &amp; Support", "Logout"]],
];

describe("owner app screens", () => {
  for (const [name, path, route, expected] of CASES) {
    it(`${name} renders ${path}`, () => {
      const html = render(name, path, route);
      for (const text of expected) expect(html).toContain(text);
      // V1 keeps no rent records: nothing may talk as if it did.
      expect(html).not.toMatch(/overdue|payment history|rent collected|next due|receipt|bank details|rental income/i);
    });
  }
});
