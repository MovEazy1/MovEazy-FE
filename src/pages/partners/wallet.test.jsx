import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));

const { EarnCta } = await import("./Wallet");
const html = (r, me = {}) => renderToString(<MemoryRouter><EarnCta r={r} me={me} /></MemoryRouter>);
const ON = { moveazy_inventory: { active: true } };

describe("Earn Commission: the button under the estimator", () => {
  it("gives Premium and trial partners only the invite buttons", () => {
    for (const out of [html({ premium: true, can_refer: true, code: "ARJ1" }), html({ premium: false, can_refer: true, code: "ARJ1" }, { tiers: ON })]) {
      expect(out).toContain("Invite partners on WhatsApp");
      expect(out).not.toContain("Renew Premium");
      expect(out).not.toContain("Trial counts");
    }
    expect(html({ premium: true, can_refer: false })).toBe("");
  });
  it("still points everyone else to Premium", () => {
    expect(html({ premium: false, can_refer: true })).toContain("Renew Premium to keep earning");
    const free = html({ premium: false, can_refer: false });
    expect(free).toContain("Go Premium to start earning");
    expect(free).toContain("Trial counts");
  });
});
