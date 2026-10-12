/**
 * What the AI matcher remembers, loaded once and shared by the Home card, the
 * matcher and each tenant's page: MovEazy tenants assigned to this broker,
 * every list sent (with likes and skips), the flats never to suggest again,
 * and visits. `reload()` after sending a list or fixing a visit.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchMyAssignedLeads } from "../../lib/partnerLeads";
import { fetchMyCuratedLists } from "../../lib/partnerCurated";
import { fetchMatcherSeen, fetchMyVisits } from "../../lib/partnerMatcher";

const EMPTY = { assigned: [], lists: [], seen: {}, visits: [] };
let cache = null;
let inflight = null;
const listeners = new Set();

function load() {
  if (!inflight) {
    inflight = Promise.all([
      fetchMyAssignedLeads().catch(() => []),
      fetchMyCuratedLists().catch(() => []),
      fetchMatcherSeen().catch(() => ({})),
      fetchMyVisits().catch(() => []),
    ]).then(([assigned, lists, seen, visits]) => {
      cache = { assigned, lists, seen, visits };
      for (const f of listeners) f(cache);
      return cache;
    }).finally(() => { inflight = null; });
  }
  return inflight;
}

export function useMatcherData() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    listeners.add(setData);
    if (!cache) load();
    return () => { listeners.delete(setData); };
  }, []);
  const reload = useCallback(() => load(), []);
  return { ...(data ?? EMPTY), loaded: Boolean(data), reload };
}
