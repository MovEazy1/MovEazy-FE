/** Shared primary nav links (desktop + mobile header). */

export const SERVICE_NAV_ITEMS = [
  { label: "List My Home", path: "/list-my-flat" },
  { label: "Find My Home", path: "/plan" },
  { label: "Flat Agent", path: "/flat-agent" },
  { label: "Deposit Saver", path: "/guarantee" },
];

/** Top-level nav: Services (dropdown), About Us, Listings */
export const PRIMARY_NAV_LINKS = [
  { label: "About Us", path: "/services" },
  { label: "Listings", path: "/new-listings" },
];

export const HEADER_CTA = {
  label: "Find My Home",
  path: "/plan",
};

export const HEADER_SECONDARY_CTA = {
  label: "Login",
  path: "/login",
};

/** Flat-search checkout CTA (used on agents, contact secondary actions, etc.). */
export const FLAT_SEARCH_CTA = {
  label: "Start my flat search",
  path: "/checkout?sku=flat-search",
};

/** Legacy routes still valid — linked from footer / deep links */
export const FOOTER_NAV_LINKS = [
  { label: "Terms of Service", path: "/terms" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Contact & Support", path: "/contact" },
  { label: "Agents", path: "/agents" },
  { label: "Flat Plan", path: "/plan" },
  { label: "Guarantee", path: "/guarantee" },
];

/** Whether a nav item should show the active underline. */
export function isNavLinkActive(pathname, path) {
  if (path === "/") return pathname === "/";
  if (path === "/listings" || path === "/new-listings") {
    return (
      pathname === "/listings" ||
      pathname === "/new-listings" ||
      pathname === "/map" ||
      pathname.startsWith("/map/")
    );
  }
  if (path === "/flat-agent") {
    return pathname === "/flat-agent";
  }
  if (path === "/plan") {
    return pathname === "/plan";
  }
  if (path === "/guarantee") {
    return pathname === "/guarantee" || pathname.startsWith("/guarantee");
  }
  if (path === "/list-my-flat") {
    return pathname === "/list-my-flat";
  }
  if (path === "/services") {
    return pathname === "/services";
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isServiceNavActive(pathname) {
  return SERVICE_NAV_ITEMS.some((item) => isNavLinkActive(pathname, item.path));
}
