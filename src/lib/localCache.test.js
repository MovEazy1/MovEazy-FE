import { describe, expect, it } from "vitest";
import { CACHE_VERSION, DAY_MS, cacheKey, isFresh, readCache } from "./localCache";

describe("isFresh", () => {
  const now = Date.UTC(2026, 9, 7);
  const entry = (daysAgo, v = CACHE_VERSION) => ({ v, at: now - daysAgo * DAY_MS, data: [1] });

  it("keeps a copy inside the limit", () => {
    expect(isFresh(entry(6.9), 7 * DAY_MS, now)).toBe(true);
    expect(isFresh(entry(29), 30 * DAY_MS, now)).toBe(true);
  });
  it("drops one past it, from another release, or with a clock gone backwards", () => {
    expect(isFresh(entry(7.1), 7 * DAY_MS, now)).toBe(false);
    expect(isFresh(entry(1, CACHE_VERSION - 1), 7 * DAY_MS, now)).toBe(false);
    expect(isFresh(entry(-1), 7 * DAY_MS, now)).toBe(false);
    expect(isFresh(null, 7 * DAY_MS, now)).toBe(false);
  });
});

describe("the store", () => {
  it("keys each account apart", () => {
    expect(cacheKey("u1", "crm")).toBe("u1:crm");
  });
  it("without IndexedDB (or an account) there is simply no copy", async () => {
    expect(await readCache("u1", "crm", DAY_MS)).toBeNull();
    expect(await readCache("", "crm", DAY_MS)).toBeNull();
  });
});
