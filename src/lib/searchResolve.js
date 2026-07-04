import { applyListingFilters, getFiltersInitialState, getListings } from "./store";

export function filterListingsByLocalityQuery(listings, locality) {
  const q = String(locality || "").trim().toLowerCase();
  if (!q) return listings;
  return listings.filter((l) =>
    [l.title, l.address, l.location].filter(Boolean).some((text) => String(text).toLowerCase().includes(q))
  );
}

/**
 * Picks a listing that matches the hero search when possible; widens BHK/property filters so
 * locality + budget still returns a real row instead of an empty map.
 */
export function pickFirstListingForHeroSearch({ locality, bhk, propertyType, minRent, maxRent }) {
  const base = getListings();
  const min = Number(minRent) || 0;
  const max = Number(maxRent) || 999999999;
  const tryOnce = (bhkTypes, propertyTypes) => {
    const filters = {
      ...getFiltersInitialState(),
      bhkTypes: bhkTypes?.length ? bhkTypes : [],
      propertyTypes: propertyTypes?.length ? propertyTypes : [],
      minRent: min,
      maxRent: max,
    };
    let rows = applyListingFilters(base, filters);
    rows = filterListingsByLocalityQuery(rows, locality);
    return rows;
  };

  const bhkArr = bhk ? [bhk] : [];
  const ptArr = propertyType && propertyType !== "Property Type" ? [propertyType] : [];

  let rows = tryOnce(bhkArr, ptArr);
  if (!rows.length && bhkArr.length) rows = tryOnce([], ptArr);
  if (!rows.length && ptArr.length) rows = tryOnce([], []);
  if (!rows.length) rows = tryOnce([], []);
  if (!rows.length) {
    rows = applyListingFilters(base, { ...getFiltersInitialState(), minRent: min, maxRent: max });
    rows = filterListingsByLocalityQuery(rows, locality);
  }
  if (!rows.length) rows = applyListingFilters(base, { ...getFiltersInitialState(), minRent: min, maxRent: max });
  return rows[0] || null;
}
