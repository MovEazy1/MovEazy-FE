/**
 * Every listing link that leaves the app has to be attributable.
 *
 * A bare https://www.moveazy.co.in/map?listingId=MZ-… reached a customer twice:
 * once from the CRM before propertyLink existed, and once from the property
 * page's own Share button, which had quietly kept building its own URL. Both
 * arrived with no UTM parameters and no OG preview. These tests pin the shape
 * of a share link, and the last one fails if any file starts hand-rolling an
 * absolute listing URL again.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHARE_SOURCES,
  channelPropertyLink,
  facebookShareUrl,
  propertyLink,
  redditShareUrl,
  shareVia,
  socialShareTitle,
} from "./crmSettings";

const paramsOf = (url) => new URL(url).searchParams;

describe("a shared listing link", () => {
  it("points at the OG page, not straight at the map", () => {
    // /p/:id is what makes WhatsApp show the flat instead of our logo.
    expect(new URL(propertyLink("MZ-ABC123")).pathname).toBe("/p/MZ-ABC123");
  });

  it("always carries all four UTM parameters", () => {
    for (const key of Object.keys(SHARE_SOURCES)) {
      const q = paramsOf(propertyLink("MZ-ABC123", SHARE_SOURCES[key]));
      expect(q.get("utm_source"), key).toBeTruthy();
      expect(q.get("utm_medium"), key).toBeTruthy();
      expect(q.get("utm_campaign"), key).toBeTruthy();
      expect(q.get("utm_content"), key).toBe("MZ-ABC123");
    }
  });

  it("attributes each surface distinctly, so they don't read as one blob", () => {
    const sources = Object.keys(SHARE_SOURCES).map((k) => SHARE_SOURCES[k].source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("separates a copied link from the share sheet", () => {
    expect(shareVia("owner", "copy").medium).toBe("copy_link");
    expect(shareVia("owner", "native").medium).toBe("share");
  });

  it("still accepts a bare token string, the way the CRM spells it", () => {
    const q = paramsOf(propertyLink("MZ-ABC123", "mzdeadbeef"));
    expect(q.get("mz_s")).toBe("mzdeadbeef");
    expect(q.get("utm_source")).toBe("crm");
  });

  it("carries a token only when a send has one to carry", () => {
    expect(paramsOf(propertyLink("MZ-ABC123")).get("mz_s")).toBeNull();
  });
});

describe("posting a flat to a social feed", () => {
  /** The listing URL a composer was handed, pulled back out of its own link. */
  const shared = (composerUrl, param) =>
    new URL(new URL(composerUrl).searchParams.get(param));

  it("hands Facebook our OG page, so the card is the collage and not our logo", () => {
    const url = shared(facebookShareUrl("MZ-ABC123"), "u");
    expect(url.pathname).toBe("/p/MZ-ABC123");
    expect(url.searchParams.get("utm_source")).toBe("facebook");
  });

  it("hands Reddit the same page, with a title already filled in", () => {
    const composer = new URL(redditShareUrl("MZ-ABC123", "2 BHK for rent in Bellandur"));
    expect(shared(composer.href, "url").pathname).toBe("/p/MZ-ABC123");
    expect(composer.searchParams.get("title")).toBe("2 BHK for rent in Bellandur");
    expect(shared(composer.href, "url").searchParams.get("utm_source")).toBe("reddit");
  });

  it("carries no mz_s, because a public post has no one client to credit", () => {
    // A WhatsApp send goes to one person; a feed post is read by strangers, so
    // a per-client token on it would attribute every one of them to that client.
    expect(shared(facebookShareUrl("MZ-ABC123"), "u").searchParams.get("mz_s")).toBeNull();
    expect(shared(redditShareUrl("MZ-ABC123", "t"), "url").searchParams.get("mz_s")).toBeNull();
  });

  it("asks for the large collage, since a feed card is not a chat thumbnail", () => {
    // api/p.js reads utm_source to pick the OG image size — this is the input
    // that makes it serve 1200x630 rather than WhatsApp's 600x315.
    for (const url of [shared(facebookShareUrl("MZ-A"), "u"), shared(redditShareUrl("MZ-A", "t"), "url")]) {
      expect(["facebook", "reddit"]).toContain(url.searchParams.get("utm_source"));
    }
  });

  it("gives an empty string rather than a broken composer link with no listing", () => {
    expect(facebookShareUrl("")).toBe("");
    expect(redditShareUrl(undefined, "t")).toBe("");
  });

  it("writes a Reddit title a human would have typed", () => {
    expect(socialShareTitle({ flat_type: "2 BHK", area: "Bellandur", rent: 22500 }))
      .toBe("2 BHK for rent in Bellandur — ₹22,500/mo");
    expect(socialShareTitle({ area: "HSR Layout" })).toBe("Home for rent in HSR Layout");
  });
});

describe("nothing builds its own absolute listing URL", () => {
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.(js|jsx)$/.test(name) ? [full] : [];
    });

  it("has no hand-rolled origin + /map?listingId= anywhere in src", () => {
    // Relative navigate("/map?listingId=…") is in-app routing and fine. What
    // this catches is an absolute URL — the shape that gets pasted into a chat.
    const offenders = walk("src")
      .filter((f) => !f.endsWith("shareLinks.test.js"))
      .filter((f) => /(origin|https?:\/\/[^`"']+)\}?\/map\?listingId=/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

/**
 * Posting to a named channel is what separates /marketing/fbpage from
 * /marketing/fbprofile. Both surfaces are utm_source=facebook, so the campaign
 * is the only thing that tells them apart — and it has to survive into the
 * composer URL, not just the raw link, or a share made through the Facebook
 * dialog is credited to nobody.
 */
describe("posting a listing to a marketing channel", () => {
  const fbpage = {
    slug: "fbpage",
    label: "Facebook page",
    platform: "facebook",
    utm_source: "facebook",
    utm_medium: "page",
    utm_campaign: "mkt_fbpage",
  };
  const rishav = { ...fbpage, slug: "rishav", utm_source: "rishav", utm_medium: "group", utm_campaign: "mkt_rishav" };

  it("carries the channel's own parameters, plus the property", () => {
    const q = paramsOf(channelPropertyLink("MZ-ABC123", fbpage));
    expect(q.get("utm_source")).toBe("facebook");
    expect(q.get("utm_medium")).toBe("page");
    expect(q.get("utm_campaign")).toBe("mkt_fbpage");
    expect(q.get("utm_content")).toBe("MZ-ABC123");
    expect(new URL(channelPropertyLink("MZ-ABC123", fbpage)).pathname).toBe("/p/MZ-ABC123");
  });

  it("tells two channels on the same platform apart", () => {
    // The reason platform and campaign are separate fields at all.
    const a = paramsOf(channelPropertyLink("MZ-1", fbpage)).get("utm_campaign");
    const b = paramsOf(channelPropertyLink("MZ-1", rishav)).get("utm_campaign");
    expect(a).not.toBe(b);
  });

  it("survives the trip through Facebook's sharer", () => {
    const outer = new URL(facebookShareUrl("MZ-ABC123", fbpage));
    const inner = new URL(outer.searchParams.get("u"));
    expect(inner.searchParams.get("utm_campaign")).toBe("mkt_fbpage");
    expect(inner.pathname).toBe("/p/MZ-ABC123");
  });

  it("survives the trip through Reddit's submit form", () => {
    const outer = new URL(redditShareUrl("MZ-ABC123", "2 BHK in HSR", {
      ...fbpage, platform: "reddit", utm_source: "reddit", utm_medium: "community",
      utm_campaign: "mkt_reddithsrkora",
    }));
    const inner = new URL(outer.searchParams.get("url"));
    expect(inner.searchParams.get("utm_campaign")).toBe("mkt_reddithsrkora");
    expect(outer.searchParams.get("title")).toBe("2 BHK in HSR");
  });

  it("still produces an attributable link when no channel is given", () => {
    // Before any channel exists for a platform, the share must still work and
    // still be attributed — just to the platform rather than to a surface.
    const q = paramsOf(channelPropertyLink("MZ-ABC123", null, "facebook"));
    expect(q.get("utm_source")).toBe("facebook");
    expect(q.get("utm_campaign")).toBeTruthy();
  });
});
