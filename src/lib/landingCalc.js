/**
 * The two landing-page calculators, as pure functions so the numbers on the
 * page are the numbers in the tests.
 *
 * Every rate here (shares, prices, painting costs, the owner's hourly value)
 * arrives from the admin-editable landing settings (lib/landingSettings.js);
 * the defaults below are only what the page shows before they load.
 */

/**
 * Broker: extra monthly income from working MovEazy stock and MovEazy clients.
 *
 *   properties × avg brokerage × property share   (MovEazy-posted flats, default 50%)
 * + clients    × avg brokerage × client share     (tenants MovEazy sends you, default 70%)
 * − the monthly Premium fee
 */
export function brokerEarnings({
  properties = 2, clients = 1, avgBrokerage = 25000, propertyShare = 50, clientShare = 70, fee = 1499,
} = {}) {
  const fromProperties = Math.max(0, properties) * avgBrokerage * (propertyShare / 100);
  const fromClients = Math.max(0, clients) * avgBrokerage * (clientShare / 100);
  const gross = fromProperties + fromClients;
  return {
    fromProperties: Math.round(fromProperties),
    fromClients: Math.round(fromClients),
    fee,
    gross: Math.round(gross),
    net: Math.round(gross - fee),
    // How many times the fee comes back. Null when there is nothing to divide.
    multiple: fee > 0 && gross > 0 ? Math.round(gross / fee) : null,
  };
}

/**
 * Owner: extra value a year from letting MovEazy run the flat.
 *
 *   painting saved   tenant changes × (market painting cost − MovEazy's cost)
 * + time saved       tenant changes × hours per change × the owner's hourly value
 * + upkeep time      hours per maintenance cycle × hourly value ÷ years per cycle
 * + rent recovered   tenant changes × (vacant days without − with MovEazy) × daily rent
 *
 * The % is that total over a year's rent.
 */
export function ownerReturns({
  rent = 50000, changesPerYear = 1, paintMarket = 50000, paintMoveazy = 25000, hoursPerChange = 10,
  hourlyValue = 2000, maintEveryYears = 3, maintHours = 8, vacantDaysWithout = 20, vacantDaysWith = 7,
} = {}) {
  const changes = Math.max(0, changesPerYear);
  const paintingSaved = changes * Math.max(0, paintMarket - paintMoveazy);
  const timeSaved = changes * Math.max(0, hoursPerChange) * hourlyValue;
  const maintTimeSaved = maintEveryYears > 0 ? (Math.max(0, maintHours) * hourlyValue) / maintEveryYears : 0;
  const daysRecovered = Math.max(0, vacantDaysWithout - vacantDaysWith) * changes;
  const extraRent = daysRecovered * (rent / 30);
  const total = paintingSaved + timeSaved + maintTimeSaved + extraRent;
  const annualRent = rent * 12;
  return {
    paintingSaved: Math.round(paintingSaved),
    timeSaved: Math.round(timeSaved),
    maintTimeSaved: Math.round(maintTimeSaved),
    daysRecovered,
    extraRent: Math.round(extraRent),
    total: Math.round(total),
    pct: annualRent > 0 ? Math.round((total / annualRent) * 1000) / 10 : 0,
  };
}

export const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
