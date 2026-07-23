import { Link } from "react-router-dom";
import { getUserFirstName, getUserInitials } from "../../lib/accountNav";

const INK = "#1A2421";
const PAPER = "#F7F4ED";
const LINE = "#D9D3C4";

/** Simple link to profile — no dropdown. Sign out lives on /profile.
 * @param {boolean} compact — render just the circular avatar, no name label (for tight nav bars). */
export default function ProfileNavLink({ user, to = "/profile", compact = false }) {
  const initials = getUserInitials(user);
  const firstName = getUserFirstName(user);

  const avatar = (
    <div
      style={{
        width: compact ? 34 : 26,
        height: compact ? 34 : 26,
        borderRadius: "50%",
        background: INK,
        color: PAPER,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: compact ? 12 : 10,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );

  if (compact) {
    return (
      <Link to={to} aria-label={firstName ? `${firstName}'s profile` : "Your profile"} style={{ display: "inline-flex", textDecoration: "none" }}>
        {avatar}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#FFFEFB",
        border: `1px solid ${LINE}`,
        borderRadius: 999,
        padding: "5px 14px 5px 6px",
        fontSize: 13,
        fontWeight: 600,
        color: INK,
        textDecoration: "none",
      }}
    >
      {avatar}
      {firstName}
    </Link>
  );
}

/** Compact signed-out CTA matching paper pages. */
export function SignInLink({ to = "/auth" }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: INK,
        background: "#FFFEFB",
        border: `1px solid ${LINE}`,
        padding: "7px 16px",
        borderRadius: 8,
        textDecoration: "none",
      }}
    >
      Sign in
    </Link>
  );
}
