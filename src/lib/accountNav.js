/** Shared account nav items for profile menus (ForkHome, Profile). */

export function getProfileDashboardPath() {
  return "/profile";
}

export function getAccountMenuItems(user) {
  if (!user) return [];
  return [
    { label: "My profile", to: "/profile" },
    { label: "Home", to: "/" },
  ];
}

export function getUserInitials(user) {
  return (user?.name || user?.email || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getUserFirstName(user) {
  return user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Account";
}
