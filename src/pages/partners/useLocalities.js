import { useAreas } from "../../lib/areas";

/**
 * Every locality a partner can pick: the CRM's list of areas (lib/areas.js),
 * A–Z. Pickers offer only these (no free text), so a lead's "HSR" and a
 * listing's "HSR Layout" can't drift apart.
 */
export function useLocalities() {
  return useAreas().names;
}

/** The first few of the CRM's quick chips: the areas offered before any search. */
export function usePopularAreas(n = 5) {
  return useAreas().chips.slice(0, n);
}
