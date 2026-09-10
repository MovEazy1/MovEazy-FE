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
import { SHARE_SOURCES, propertyLink, shareVia } from "./crmSettings";

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
