/**
 * What these pin down is the one thing in the marketing dashboards that cannot
 * be fixed after the fact: the link.
 *
 * Everything else — a wrong label, a missing column, a broken tile — is a
 * redeploy away from correct. A link pasted into a Facebook group is not. If it
 * goes out pointing at localhost, or without the campaign parameter, every
 * person who taps it arrives as organic traffic and no later change can credit
 * them back to the channel that earned them.
 */
import { afterEach, describe, expect, it } from "vitest";
import { channelLink, isMissingMigration, normalizeSlug, pct } from "./marketing.js";

const PROD = "https://www.moveazy.co.in";

/** jsdom isn't configured for this project, so stand up only what's touched. */
function on(hostname, origin = `https://${hostname}`) {
  globalThis.window = { location: { hostname, origin } };
}

afterEach(() => {
  delete globalThis.window;
});

const rishav = {
  slug: "rishav",
  utm_source: "rishav",
  utm_medium: "group",
  utm_campaign: "mkt_rishav",
  landing_path: "/",
};

describe("channelLink", () => {
  it("carries the campaign, which is what the signup is later matched on", () => {
    on("www.moveazy.co.in");
    const url = new URL(channelLink(rishav));
    expect(url.searchParams.get("utm_campaign")).toBe("mkt_rishav");
    expect(url.searchParams.get("utm_source")).toBe("rishav");
    expect(url.searchParams.get("utm_medium")).toBe("group");
  });

  it("points at production from a dev machine", () => {
    // The copy button is how nearly every one of these links gets created, and
    // a localhost URL in a Facebook post is unrecoverable.
    on("localhost", "http://localhost:5173");
    expect(channelLink(rishav).startsWith(`${PROD}/?`)).toBe(true);
  });

  it("stays on the current host when that host is already ours", () => {
    on("moveazy.co.in", "https://moveazy.co.in");
    expect(channelLink(rishav).startsWith("https://moveazy.co.in/?")).toBe(true);
  });

  it("falls back to production with no window at all", () => {
    delete globalThis.window;
    expect(channelLink(rishav).startsWith(`${PROD}/?`)).toBe(true);
  });

  it("respects a channel's own landing page, and normalises a missing slash", () => {
    on("www.moveazy.co.in");
    expect(channelLink({ ...rishav, landing_path: "/map" })).toContain(`${PROD}/map?`);
    expect(channelLink({ ...rishav, landing_path: "map" })).toContain(`${PROD}/map?`);
  });

  it("produces nothing rather than an untrackable link when the campaign is missing", () => {
    on("www.moveazy.co.in");
    expect(channelLink({ ...rishav, utm_campaign: "" })).toBe("");
    expect(channelLink(null)).toBe("");
  });
});

describe("normalizeSlug", () => {
  it("strips what a URL can't carry", () => {
    expect(normalizeSlug("  Reddit HSR/Kora! ")).toBe("reddithsrkora");
    expect(normalizeSlug("FB-Page")).toBe("fb-page");
  });

  it("caps the length so the slug can't outgrow the column check", () => {
    expect(normalizeSlug("a".repeat(80))).toHaveLength(40);
  });
});

describe("isMissingMigration", () => {
  it("recognises an unapplied migration, whichever way PostgREST reports it", () => {
    // An empty dashboard and an unrun migration look identical on screen, and
    // the fix for each is completely different — so this has to be told apart.
    expect(isMissingMigration({ code: "42883" })).toBe(true);
    expect(isMissingMigration({ code: "PGRST202" })).toBe(true);
    expect(isMissingMigration({ message: 'relation "public.marketing_channels" does not exist' })).toBe(true);
    expect(isMissingMigration({ message: "permission denied" })).toBe(false);
  });
});

describe("pct", () => {
  it("reads as a conversion rate, and says nothing when there is nothing to divide by", () => {
    expect(pct(3, 12)).toBe("25%");
    expect(pct(0, 12)).toBe("0%");
    expect(pct(5, 0)).toBe("—");
  });
});
