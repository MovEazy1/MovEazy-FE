/**
 * For CRM screens that read their own rows (visits, payments, partner lists,
 * lead requests…): is this row in the city the CRM is showing? Rows point at
 * a client, a flat or a partner, whose city is known (CrmShell's shared data,
 * broker_partners.city). Anything with no city on record is Bengaluru's —
 * everything before the other cities was (multi_city.sql).
 */
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "./CrmShell";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { DEFAULT_CITY, normalizeCity } from "../../lib/cities";
import { cityOfArea } from "../../lib/areas";

let partnerCities = null;
/** user_id → city for every partner (Bengaluru before multi_city.sql). */
export function fetchPartnerCities({ fresh = false } = {}) {
  if (partnerCities && !fresh) return partnerCities;
  partnerCities = (async () => {
    if (!isSupabaseConfigured || !supabase) return new Map();
    const { data, error } = await supabase.from("broker_partners").select("user_id,city");
    if (error) { partnerCities = null; return new Map(); }
    return new Map((data ?? []).map((p) => [p.user_id, normalizeCity(p.city) || DEFAULT_CITY]));
  })();
  return partnerCities;
}

/**
 * { all, city, client(id), user(id), flat(id), partner(id), area(name), ofClient(id), ofFlat(id), ofPartner(id) }
 * — each test true when that row belongs on screen. `all`: nothing is filtered.
 */
export function useCityFilter() {
  const { allClients = [], allInventory = [], cityState, city } = useCrm() || {};
  const inCity = cityState?.inCity;
  const [partners, setPartners] = useState(null);
  useEffect(() => { let live = true; fetchPartnerCities().then((m) => live && setPartners(m)); return () => { live = false; }; }, []);
  return useMemo(() => {
    const clientCity = new Map(allClients.map((c) => [c.id, c.city]));
    const userCity = new Map(allClients.filter((c) => c.user_id).map((c) => [c.user_id, c.city]));
    const flatCity = new Map(allInventory.map((i) => [i.property_id, i.city]));
    const ok = (c) => (inCity ? inCity(normalizeCity(c) || DEFAULT_CITY) : true);
    const ofClient = (id) => normalizeCity(clientCity.get(id)) || DEFAULT_CITY;
    const ofFlat = (id) => normalizeCity(flatCity.get(id)) || DEFAULT_CITY;
    const ofPartner = (id) => partners?.get(id) || DEFAULT_CITY;
    return {
      all: !city || city === "all",
      city,
      ready: partners !== null,
      ok,
      client: (id) => ok(ofClient(id)),
      user: (id) => ok(userCity.get(id)),
      flat: (id) => ok(ofFlat(id)),
      partner: (id) => ok(ofPartner(id)),
      area: (name) => ok(cityOfArea(name) || DEFAULT_CITY),
      ofClient, ofFlat, ofPartner,
    };
  }, [allClients, allInventory, partners, inCity, city]);
}
