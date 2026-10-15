import { afterEach, describe, expect, it, vi } from "vitest";

// A fake API that, like Supabase's, never returns more than 1,000 rows a request.
const ROWS = Array.from({ length: 2350 }, (_, i) => ({ client_id: `c${i}`, actor_email: "a@x", type: "call", created_at: "2026-10-01" }));
const calls = [];
function query() {
  const q = {
    select: () => q, order: () => q, not: () => q, or: () => q,
    range: (from, to) => {
      calls.push([from, to]);
      const end = Math.min(to + 1, from + 1000);
      return Promise.resolve({ data: ROWS.slice(from, end), error: null });
    },
  };
  return q;
}
vi.mock("./supabase", () => ({ isSupabaseConfigured: true, supabase: { from: () => query() } }));
const { fetchLastTouch } = await import("./crmClients");

afterEach(() => { calls.length = 0; });

describe("loading every activity", () => {
  it("reads past the API's 1,000-row cap, a page at a time", async () => {
    const rows = await fetchLastTouch();
    expect(rows).toHaveLength(2350);
    expect(rows.at(-1).client_id).toBe("c2349");
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999], [2350, 3349]]);
  });
});
