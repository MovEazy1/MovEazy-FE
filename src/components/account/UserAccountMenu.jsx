import { Link } from "react-router-dom";
import { getUserFirstName, getUserInitials } from "../../lib/accountNav";

const INK = "#1A2421";
const PAPER = "#F7F4ED";
const LINE = "#D9D3C4";

/** Simple link to profile — no dropdown. Sign out lives on /profile. */
export default function ProfileNavLink({ user, to = "/profile" }) {
  const initials = getUserInitials(user);
  const firstName = getUserFirstName(user);

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
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: INK,
          color: PAPER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
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
