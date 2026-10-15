/**
 * Every CRM section, in the desktop rail's order — and the phone's Home grid
 * and top-bar titles. `scope` hides a section from whoever lacks it.
 */
import {
  BarChart3, Bell, Briefcase, Building2, CalendarCheck, Columns3, CreditCard, House, Inbox, Landmark,
  QrCode, ScanLine, Settings, ShieldCheck, Smartphone, UserPlus, Users, Wallet, Wrench,
} from "lucide-react";
import { SCOPES } from "../../lib/adminScopes";

export const RAIL = [
  { to: "/crm/clients", code: "CL", label: "Clients", icon: Users, group: "Tenants" },
  // Before Pipeline: it is the tab with work waiting on somebody, and a queue
  // nobody walks past is a queue nobody clears.
  { to: "/crm/notifications", code: "NF", label: "Notifications", icon: Bell, group: "Tenants" },
  { to: "/crm/pipeline", code: "PI", label: "Pipeline", icon: Columns3, group: "Tenants" },
  { to: "/crm/properties", code: "PR", label: "Properties", icon: Building2, group: "Flats" },
  { to: "/crm/brokers", code: "BR", label: "Brokers", icon: Briefcase, group: "Partners" },
  // Tenants partner brokers brought — theirs, never in Clients.
  { to: "/crm/broker-leads", code: "BL", label: "Broker leads", icon: UserPlus, group: "Partners" },
  // Partners' To-Let poster scans: top brokers, hotspot areas, the map.
  { to: "/crm/qr-scans", code: "QS", label: "QR scans", icon: ScanLine, group: "Partners" },
  // Brokers asking for MovEazy leads: check payments, pick and give.
  { to: "/crm/lead-requests", code: "LR", label: "Lead requests", icon: Inbox, scope: SCOPES.PARTNERS_MANAGE, group: "Partners" },
  // Owners' buildings with a QR: assign the partner, work the visit requests.
  { to: "/crm/owner-qr", code: "QR", label: "Owner QR", icon: QrCode, group: "Flats" },
  { to: "/crm/societies", code: "SO", label: "Societies", icon: Landmark, scope: SCOPES.PROPERTIES_WRITE, group: "Flats" },
  // The owner app's queue: repairs, service bookings, designer calls, owners.
  { to: "/crm/ops", code: "IO", label: "Inventory Ops", icon: Wrench, group: "Flats" },
  { to: "/crm/visits", code: "VS", label: "Visits", icon: CalendarCheck, group: "Tenants" },
  { to: "/crm/payments", code: "PY", label: "Payments", icon: Wallet, group: "Tenants" },
  // Partners and owners in their apps: time spent, last sign-in, every button pressed.
  { to: "/crm/app-analytics", code: "AN", label: "App analytics", icon: BarChart3, scope: SCOPES.ANALYTICS_READ, group: "Partners" },
  { to: "/crm/team", code: "TM", label: "Team", icon: ShieldCheck, scope: SCOPES.ROLES_WRITE, group: "Admin" },
  { to: "/crm/settings", code: "ST", label: "Settings", icon: Settings, group: "Admin" },
];

/** The phone's own screens: on its bottom bar, and on Home's grid. */
export const PHONE_ONLY = [
  { to: "/crm/home", label: "Home", icon: House },
  { to: "/crm/partner-payments", label: "Partner payments", icon: CreditCard, group: "Partners" },
  { to: "/crm/partner-usage", label: "Partner usage", icon: Smartphone, group: "Partners" },
];

/** The phone's bottom bar. */
export const PHONE_TABS = [
  { to: "/crm/home", label: "Home", icon: House },
  { to: "/crm/partner-payments", label: "Payments", icon: CreditCard },
  { to: "/crm/notifications", label: "Alerts", icon: Bell, badge: true },
  { to: "/crm/partner-usage", label: "Partners", icon: Smartphone },
  { to: "/crm/clients", label: "Clients", icon: Users },
];

export const GROUPS = ["Tenants", "Partners", "Flats", "Admin"];

/** Screens that aren't sections of their own, for the phone's title. */
const SUBPAGES = [
  { to: "/crm/buildings", label: "Building" },
  { to: "/crm/properties/new", label: "New property" },
];

/** The section a path belongs to — longest match, so /crm/partner-usage/x is Partner usage. */
export function sectionFor(pathname) {
  const all = [...PHONE_ONLY, ...RAIL, ...SUBPAGES];
  return all
    .filter((s) => pathname === s.to || pathname.startsWith(`${s.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0] ?? null;
}
