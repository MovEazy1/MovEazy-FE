import { useMemo } from "react";
import { usePartner } from "./PartnerApp";
import { ALL_LOCALITIES } from "../../data/preferenceOptions";

/**
 * Every locality we know: the curated list plus every area in the inventory
 * this partner can see. Pickers offer only these (no free text), so a lead's
 * "HSR" and a listing's "HSR Layout" can't drift apart.
 */
export function useLocalities() {
  const { inventory } = usePartner() || {};
  return useMemo(() => {
    const seen = new Map();
    for (const a of [...ALL_LOCALITIES, ...(inventory ?? []).map((l) => l.area)]) {
      const name = String(a || "").trim();
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()].sort((x, y) => x.localeCompare(y));
  }, [inventory]);
}
