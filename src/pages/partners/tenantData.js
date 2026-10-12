/**
 * The tenant board and open reminders, loaded once and shared by Home, the
 * tenant list and each tenant's page. `reload()` after anything changes them.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchBoard, fetchOpenReminders } from "../../lib/partnerTenants";

const EMPTY = { board: [], reminders: [] };
let cache = null;
let inflight = null;
const listeners = new Set();

function load() {
  if (!inflight) {
    inflight = Promise.all([fetchBoard().catch(() => null), fetchOpenReminders().catch(() => null)])
      .then(([board, reminders]) => {
        cache = { board: board ?? cache?.board ?? [], reminders: reminders ?? cache?.reminders ?? [] };
        for (const f of listeners) f(cache);
        return cache;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function useTenants() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    listeners.add(setData);
    load();
    return () => { listeners.delete(setData); };
  }, []);
  const reload = useCallback(() => load(), []);
  return { ...(data ?? EMPTY), loaded: Boolean(data), reload };
}
