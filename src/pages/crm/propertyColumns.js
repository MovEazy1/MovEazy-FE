/**
 * What each column of the Properties table holds, as the string the cell shows.
 *
 * Its own module so the filtering can be tested: importing it from the page
 * drags in PropertyModal and Leaflet, which reach for `window` at load and put
 * the whole file out of reach of a node test run.
 *
 * The accessors deliberately return the *rendered* text rather than the
 * underlying field. Somebody ticking "2 BHK · Semi Furnished" is ticking the
 * row they can see, and a filter matching on flat_type alone would take in
 * rows whose cells read differently.
 *
 * inr and shortDate are duplicated from crmUi.jsx for the same reason — two
 * one-line formatters are a smaller cost than a JSX import in a data module,
 * and the table's own cells still use crmUi's copies.
 */

const inr = (n) =>
  Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";

const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

export const COLUMNS = [
  { key: "id",     label: "Id",     of: (l) => l.property_id || "—" },
  { key: "home",   label: "Home",   of: (l) => `${l.flat_type || "—"}${l.furnishing ? ` · ${l.furnishing}` : ""}` },
  { key: "area",   label: "Area",   of: (l) => l.area || "—" },
  { key: "rent",   label: "Rent",   of: (l) => inr(l.rent) || "—" },
  { key: "owner",  label: "Owner",  of: (l) => l.poster_name || "—" },
  { key: "source", label: "Source", of: (l) => l.source || "—" },
  { key: "added",  label: "Added",  of: (l) => shortDate(l.created_at) || "—" },
];

/**
 * Does this row survive the ticked filters?
 *
 * Any ticked value within a column, every ticked column at once — which is how
 * somebody reads them: "2 or 3 BHK, in HSR". A column with nothing ticked is
 * not a filter at all.
 */
export function matchesFilters(listing, filters = {}) {
  return COLUMNS.every((col) => {
    const picked = filters[col.key];
    return !picked || picked.size === 0 || picked.has(col.of(listing));
  });
}

/** Every distinct value each column holds, across the rows given. */
export function optionsFor(rows = []) {
  const out = {};
  for (const col of COLUMNS) {
    out[col.key] = [...new Set(rows.map(col.of))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }
  return out;
}
