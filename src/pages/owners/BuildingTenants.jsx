/**
 * Every tenant who has seen one of the owner's buildings — the ones the
 * MovEazy team brought and the ones whose number came from the QR — with the
 * numbers on top and where each stands (owner_building_tenants in
 * building_tenants_board.sql). Read-only: the team updates it from the CRM.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Empty, Loading, TopBar } from "./ownerUi";
import BuildingTenantsBoard from "../../components/BuildingTenantsBoard";
import { fetchOwnerBuildingTenants } from "../../lib/buildings";
import { op } from "../../lib/owners";

export default function BuildingTenants() {
  const { id } = useParams();
  const [d, setD] = useState(undefined);
  useEffect(() => {
    fetchOwnerBuildingTenants(id).then((r) => setD(r || null), () => setD(null));
  }, [id]);

  if (d === undefined) return <><TopBar title="Tenants" back={op(`/buildings/${id}`)} /><Loading /></>;
  if (!d) return <><TopBar title="Tenants" back={op("/properties")} /><Empty>That property isn't in your account.</Empty></>;
  return (
    <>
      <TopBar title={`${d.building.name} · tenants`} back={op(`/buildings/${id}`)} />
      <div className="oz-pad">
        <p className="oz-hint" style={{ margin: "0 2px 4px" }}>
          Everyone who has seen your flats — through MovEazy's team, the MovEazy website or your QR — and where each one stands. The
          MovEazy team keeps it up to date; tenants MovEazy sent stay in touch through MovEazy.
        </p>
        <BuildingTenantsBoard tenants={d.tenants ?? []} />
      </div>
    </>
  );
}
