/**
 * Roughly how long it takes to get from a flat to the office.
 *
 * The questionnaire asks for a commute tolerance in minutes, and the matcher
 * scores against it, but a card never said what the commute actually *is* —
 * so "30 min works for me" was a preference nobody could check against the
 * flat in front of them.
 *
 * This is an estimate, deliberately. A real answer means a routing API, one
 * request per flat per office, with a key, a bill and a round trip before the
 * card can render; a swipe deck would stall on five of them. Straight-line
 * distance is already on hand — both ends carry coordinates — so the estimate
 * costs nothing and is available the moment a card mounts.
 *
 * Two constants turn that distance into minutes, and both are deliberately
 * conservative: it is better to say 30 and have someone arrive in 25 than the
 * reverse.
 */
import { haversineKm } from "./geo";

/**
 * Roads are not straight. Across Indian cities the driven distance runs about
 * 1.3–1.5x the straight line; Bengaluru's lakes and one-ways push it to the
 * upper half of that.
 */
const ROAD_FACTOR = 1.4;

/**
 * Door-to-door average for a two-wheeler in Bengaluru traffic, which is what
 * the question asks about ("one-way, by bike"). Well under the open-road
 * speed, because almost none of the trip is open road.
 */
const BIKE_KMPH = 18;

/** Past this, the estimate is guesswork and the card shouldn't pretend. */
const MAX_SENSIBLE_KM = 60;

/**
 * Number(null) is 0 and Number("") is 0, which here would read as a real
 * coordinate on the equator and, worse, as a commute tolerance of zero
 * minutes — rejecting every flat instead of meaning "not set".
 */
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** {lat, lng} from any of the shapes a listing or an office answer arrives in. */
export function coordsOf(x) {
  if (!x || typeof x !== "object") return null;
  const lat = num(x.lat ?? x.latitude);
  const lng = num(x.lng ?? x.lon ?? x.longitude);
  if (lat === null || lng === null) return null;
  // 0,0 is the Atlantic — it means "this field was never filled in".
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * Estimated one-way commute in whole minutes, or null when either end has no
 * coordinates — in which case the caller should show nothing rather than a
 * number it cannot stand behind.
 */
export function commuteMinutes(from, to) {
  const a = coordsOf(from);
  const b = coordsOf(to);
  if (!a || !b) return null;

  const straightKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
  if (!Number.isFinite(straightKm) || straightKm > MAX_SENSIBLE_KM) return null;

  const minutes = Math.round((straightKm * ROAD_FACTOR) / BIKE_KMPH * 60);
  // A flat across the road still costs you the walk down and the helmet.
  return Math.max(minutes, 5);
}

/** "22 min" — for a card. The "~" is added by the caller that has room for it. */
export function formatCommute(minutes) {
  if (minutes === null || minutes === undefined) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Whether this flat is inside the commute the person said they wanted.
 *
 * The tolerance is soft when they ticked "comfortable going a little beyond
 * this for great properties" — the grace is a quarter over, enough to keep a
 * flat six minutes past a 30-minute line without letting an hour through.
 */
export function withinCommute(minutes, tolerance, flexible = true) {
  const limit = num(tolerance);
  if (minutes === null || limit === null) return true;
  return minutes <= (flexible ? limit * 1.25 : limit);
}
