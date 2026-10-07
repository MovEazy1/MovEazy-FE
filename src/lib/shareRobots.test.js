/**
 * Shared links: people go straight on, robots get the preview card.
 * Runs the real edge handlers with no Supabase configured.
 */
import { describe, expect, it } from "vitest";
import { isPreviewRobot } from "../../api/_bots.js";
import p from "../../api/p.js";
import share from "../../api/share.js";

const PHONE = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("isPreviewRobot", () => {
  it("knows the preview robots", () => {
    for (const ua of [
      "WhatsApp/2.24.10.85 A", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Twitterbot/1.0", "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
      "TelegramBot (like TwitterBot)", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", "Mozilla/5.0 (compatible; Googlebot/2.1)", "",
    ]) expect(isPreviewRobot(ua)).toBe(true);
  });
  it("and lets people through", () => {
    expect(isPreviewRobot(PHONE)).toBe(false);
    expect(isPreviewRobot(IPHONE)).toBe(false);
  });
});

describe("/p/:id", () => {
  const url = "https://www.moveazy.co.in/api/p?listingId=MZ-ABC123&utm_source=whatsapp&mz_s=mzdeadbeef01";
  it("sends a person straight to the flat, tracking intact, uncached", async () => {
    const res = await p(new Request(url, { headers: { "user-agent": PHONE } }));
    expect(res.status).toBe(302);
    const to = new URL(res.headers.get("location"));
    expect(to.pathname).toBe("/property/MZ-ABC123");
    expect(to.searchParams.get("mz_s")).toBe("mzdeadbeef01");
    expect(to.searchParams.get("utm_source")).toBe("whatsapp");
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
  });
  it("gives WhatsApp the preview page", async () => {
    const res = await p(new Request(url, { headers: { "user-agent": "WhatsApp/2.24.10.85 A" } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/<meta property="og:title"/);
  });
});

describe("/b, /c, /building", () => {
  it("serves a person the app without looking anything up", async () => {
    const calls = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (u) => { calls.push(String(u)); return new Response("<html><head><title>x</title></head></html>"); };
    try {
      const res = await share(new Request("https://www.moveazy.co.in/api/share?kind=building&id=ABC234", { headers: { "user-agent": IPHONE } }));
      expect(res.status).toBe(200);
      expect(calls.every((u) => u.endsWith("/index.html"))).toBe(true);
      expect(res.headers.get("cache-control")).toMatch(/no-store/);
    } finally {
      globalThis.fetch = real;
    }
  });
});
