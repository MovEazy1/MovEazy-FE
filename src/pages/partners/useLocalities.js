import { useAreas } from "../../lib/areas";
import { usePartner } from "./PartnerApp";

/**
 * Every locality a partner can pick: the CRM's list of areas (lib/areas.js)
 * for the partner's own city (multi_city.sql), A–Z. Pickers offer only these
 * (no free text), so a lead's "HSR" and a listing's "HSR Layout" can't drift apart.
 */
function usePartnerCity() {
  const me = usePartner()?.me;
  return me?.city || me?.partner?.city || "";
}

export function useLocalities() {
  return useAreas(usePartnerCity()).names;
}

/** The first few of the CRM's quick chips: the areas offered before any search. */
export function usePopularAreas(n = 5) {
  return useAreas(usePartnerCity()).chips.slice(0, n);
}
