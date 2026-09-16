/**
 * The gap this closes: a visitor arrives from a Facebook post, browses for ten
 * minutes, and signs up from /login — by which point the UTM parameters are two
 * routes behind them. Before, that signup was recorded as coming from nowhere.
 *
 * These tests pin the three things that have to hold for the source to survive
 * the trip: the first touch is kept, a later visit cannot overwrite it, and the
 * token round-trips so a stored value can be read back.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** jsdom isn't configured for this project, so stand up only what's touched. */
function visit(search, referrer = "") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
  globalThis.window = {
    location: { search, pathname: "/map", hostname: "www.moveazy.co.in" },
  };
  globalThis.document = { referrer };
  return store;
}

/** A second page load, keeping whatever the first one wrote to storage. */
function revisit(store, search, referrer = "") {
  visit(search, referrer);
  for (const [k, v] of store) globalThis.localStorage.setItem(k, v);
  return globalThis.localStorage._store;
}

let attribution;

beforeEach(async () => {
  attribution = await import("./attribution.js");
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.window;
  delete globalThis.document;
});

describe("capturing where a visitor came from", () => {
  it("keeps a UTM source that the address bar is about to lose", () => {
    visit("?utm_source=facebook&utm_medium=social&utm_campaign=property_share&utm_content=MZ-ABC123");
    attribution.captureAttribution();

    expect(attribution.firstTouch()).toMatchObject({
      source: "facebook",
      medium: "social",
      campaign: "property_share",
      content: "MZ-ABC123",
    });
  });

  it("names the source from the referrer when the parameters were stripped", () => {
    // Pasting a link into a Facebook group drops the query string; the referring
    // host is then the only evidence left that the visit came from Facebook.
    visit("", "https://m.facebook.com/groups/12345");
    attribution.captureAttribution();

    expect(attribution.firstTouch()).toMatchObject({ source: "facebook", medium: "referral" });
  });

  it("recognises Reddit's own short domain", () => {
    visit("", "https://www.redd.it/abc");
    attribution.captureAttribution();
    expect(attribution.firstTouch().source).toBe("reddit");
  });

  it("does not treat our own pages as a referral", () => {
    visit("", "https://www.moveazy.co.in/map");
    attribution.captureAttribution();
    expect(attribution.firstTouch()).toBeNull();
  });

  it("keeps the CRM share token, which names a client no UTM can", () => {
    visit("?utm_source=crm&mz_s=mzdeadbeef01");
    attribution.captureAttribution();
    expect(attribution.signupAttribution().signup_attribution.share_token).toBe("mzdeadbeef01");
  });

  it("credits the first source, not the last", () => {
    // The whole point: someone who finds us on Reddit and comes back a week
    // later by typing the address is a Reddit signup, not a direct one.
    const store = visit("?utm_source=reddit&utm_medium=social");
    attribution.captureAttribution();
    revisit(store, "?utm_source=google&utm_medium=cpc");
    attribution.captureAttribution();

    const out = attribution.signupAttribution();
    expect(out.signup_source).toBe("reddit");
    expect(out.signup_attribution.last_source).toBe("google");
    expect(out.signup_attribution.touches).toBe(2);
  });

  it("leaves a recorded source alone on a visit that says nothing", () => {
    const store = visit("?utm_source=facebook");
    attribution.captureAttribution();
    revisit(store, "?listingId=MZ-ABC123");
    attribution.captureAttribution();

    expect(attribution.firstTouch().source).toBe("facebook");
  });

  it("has nothing to say about a visitor who arrived unattributed", () => {
    visit("");
    attribution.captureAttribution();
    expect(attribution.attributionToken()).toBe("");
    expect(attribution.signupAttribution()).toBeNull();
  });
});

describe("the token stamped on an account", () => {
  it("round-trips through the single text column it lives in", () => {
    visit("?utm_source=facebook&utm_medium=social&utm_campaign=property_share&utm_content=MZ-ABC123");
    attribution.captureAttribution();

    const parsed = attribution.parseAttributionToken(attribution.attributionToken());
    expect(parsed).toMatchObject({
      source: "facebook",
      medium: "social",
      campaign: "property_share",
      content: "MZ-ABC123",
    });
    expect(Date.parse(parsed.at)).toBeGreaterThan(0);
  });

  it("keeps its shape when a source arrives with a colon or a space in it", () => {
    // Anyone can put anything in utm_source; an unescaped colon would shift
    // every later segment along by one and silently mislabel the account.
    visit("?utm_source=some%3Apartner%20co&utm_medium=social");
    attribution.captureAttribution();

    const parsed = attribution.parseAttributionToken(attribution.attributionToken());
    expect(parsed.source).toBe("some_partner_co");
    expect(parsed.medium).toBe("social");
  });

  it("rejects anything that isn't one of ours", () => {
    expect(attribution.parseAttributionToken("")).toBeNull();
    expect(attribution.parseAttributionToken("facebook")).toBeNull();
    expect(attribution.parseAttributionToken("mza9:facebook:social:c:x:1")).toBeNull();
  });
});
