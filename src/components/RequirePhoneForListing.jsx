/**
 * The one thing we ask before showing a flat somebody was sent.
 *
 * A shared /p/:id link used to land on a Google wall. The flat was the thing
 * being offered and it was the one thing they could not see — so the share did
 * the hard part, getting someone interested enough to tap, and then spent it
 * on an account prompt. Most of them left.
 *
 * Now it asks for a mobile number and opens the flat. Booking a visit still
 * needs an account (PropertyModal gates that itself); looking does not.
 *
 * Only for a session that *opened* on a property. Reaching a flat from inside
 * the app — the swipe deck, the map — never mounts this, because that person
 * arrived through a surface that already asked.
 */
import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RequirePhoneFirst from "./RequirePhoneFirst";
import { hasLeadPhone } from "../lib/leadIntake";

export default function RequirePhoneForListing() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { propertyId } = useParams();

  // Captured on this component's first render — a fresh page load, not an
  // in-app navigation. Browsing to a property from inside the app doesn't
  // remount it, so the gate never fires there.
  const [isDeepLinkEntry] = useState(
    () =>
      location.pathname.startsWith("/property/") ||
      // The older shape, still arriving from links sent before /property/:id
      // existed. The route redirects, but this runs before that lands.
      (location.pathname === "/map" && new URLSearchParams(location.search).has("listingId")),
  );

  const [given, setGiven] = useState(() => hasLeadPhone());

  // A signed-in visitor has already given us more than this asks for.
  const gate = isDeepLinkEntry && !loading && !user && !given;
  if (!gate) return null;

  const flat =
    propertyId ||
    new URLSearchParams(location.search).get("listingId") ||
    location.pathname.split("/property/")[1] ||
    "";

  return (
    <RequirePhoneFirst
      open
      // No way out, unlike the gate on the home page. There, dismissing costs
      // the visitor nothing — the site is still behind it. Here the whole page
      // is one flat, so a dismissed gate would leave them staring at a blank
      // screen with nothing to go back to.
      dismissible={false}
      // Saved with the number in one write. Which flat brought them in is the
      // only thing we know about what this person wants, and it is what the
      // CRM shows beside their number.
      extra={{ leadType: "direct_property", propertyId: flat }}
      onDone={() => setGiven(true)}
    />
  );
}
