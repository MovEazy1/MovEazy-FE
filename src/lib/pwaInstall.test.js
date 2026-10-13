import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, inAppBrowser, installPlatform, openInChromeUrl, recentlyDismissed } from "./pwaInstall";

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const INSTAGRAM_IPHONE = `${SAFARI_IPHONE} Instagram 300.0.0.0`;
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

describe("installPlatform", () => {
  it("tells phones apart", () => {
    expect(installPlatform(CHROME_ANDROID, 5)).toBe("android");
    expect(installPlatform(SAFARI_IPHONE, 5)).toBe("ios");
    expect(installPlatform(DESKTOP, 0)).toBe("other");
  });
  it("counts an iPad asking for the desktop site as iOS", () => {
    expect(installPlatform(IPAD_DESKTOP_UA, 5)).toBe("ios");
    expect(installPlatform(IPAD_DESKTOP_UA, 0)).toBe("other");
  });
});

describe("inAppBrowser", () => {
  it("spots app browsers that can't install", () => {
    expect(inAppBrowser(INSTAGRAM_IPHONE)).toBe(true);
    expect(inAppBrowser(ANDROID_WEBVIEW)).toBe(true);
    expect(inAppBrowser(CHROME_ANDROID)).toBe(false);
    expect(inAppBrowser(SAFARI_IPHONE)).toBe(false);
  });
});

describe("recentlyDismissed", () => {
  const now = Date.UTC(2026, 9, 13);
  it(`hides the banner for ${DISMISS_DAYS} days after it's closed`, () => {
    expect(recentlyDismissed(now - 86400000, now)).toBe(true);
    expect(recentlyDismissed(now - (DISMISS_DAYS * 86400000 - 1), now)).toBe(true);
    expect(recentlyDismissed(now - DISMISS_DAYS * 86400000, now)).toBe(false);
  });
  it("shows it when never closed", () => {
    expect(recentlyDismissed(null, now)).toBe(false);
    expect(recentlyDismissed("junk", now)).toBe(false);
  });
});

describe("openInChromeUrl", () => {
  it("opens the same page in Chrome, falling back to it", () => {
    const u = openInChromeUrl("https://partners.moveazy.co.in/leads?tab=moveazy");
    expect(u.startsWith("intent://partners.moveazy.co.in/leads?tab=moveazy#Intent;scheme=https;package=com.android.chrome;")).toBe(true);
    expect(u).toContain(`S.browser_fallback_url=${encodeURIComponent("https://partners.moveazy.co.in/leads?tab=moveazy")}`);
  });
});
