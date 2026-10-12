/**
 * Explore societies, for a signed-in tenant: is it live (the CRM's switch;
 * staff always), their office and budget, and the societies near it with a
 * flat to rent — each with its commute, and whether a flat fits the budget.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { commuteMinutes } from "../../lib/commute";
import { fetchExploreLive, fetchExploreSocieties } from "../../lib/society";
import { fetchUserRequirement, rowToPrefs } from "../../lib/userRequirements";

export function useExploreLive() {
  const [live, setLive] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchExploreLive().then((v) => { if (alive) setLive(Boolean(v)); });
    return () => { alive = false; };
  }, []);
  return live;
}

/** Sorted nearest first; the budget fit and commute added to each. */
export function shapeSocieties(list = [], prefs = null) {
  const office = prefs?.office?.lat != null ? prefs.office : null;
  const max = prefs?.budgetMax ? prefs.budgetMax * (prefs.stretch ? 1.15 : 1) : null;
  return list
    .map((s) => ({
      ...s,
      commute: office ? commuteMinutes(office, { lat: s.latitude, lng: s.longitude }) : null,
      inBudget: max ? Number(s.min_rent) <= max : null,
    }))
    .sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
}

export function useExploreSocieties() {
  const { user, loading } = useAuth();
  const [state, setState] = useState({ loading: true, live: null, prefs: null, societies: [], error: "" });
  useEffect(() => {
    if (loading) return undefined;
    let alive = true;
    (async () => {
      try {
        const prefs = user?.uid ? rowToPrefs(await fetchUserRequirement(user.uid)) : null;
        const o = prefs?.office;
        const r = await fetchExploreSocieties(o?.lat ?? null, o?.lng ?? null, 25);
        if (alive) setState({ loading: false, live: Boolean(r?.live), prefs, societies: shapeSocieties(r?.societies ?? [], prefs), error: "" });
      } catch (e) {
        if (alive) setState({ loading: false, live: null, prefs: null, societies: [], error: e?.message || "Couldn't load societies." });
      }
    })();
    return () => { alive = false; };
  }, [user?.uid, loading]);
  return state;
}
