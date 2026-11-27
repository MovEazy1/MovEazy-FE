/**
 * /rent — the rent-agreement surface for a person: their agreements and a
 * "Request" form. Works on every host; the requester's role comes from the app
 * it opens in (owner / broker / tenant).
 */
import RentAgreementsPanel from "../components/rent/RentAgreementsPanel";

export default function RentAgreements({ role = "tenant" }) {
  return <RentAgreementsPanel role={role} title="Rent agreements" />;
}
