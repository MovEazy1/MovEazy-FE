import { afterEach, describe, expect, it, vi } from "vitest";

const refreshSession = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { refreshSession } }) }));
vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon");
const { fetchRefreshingExpired } = await import("./supabase");

const reply = (status, body) => new Response(JSON.stringify(body), { status });
const EXPIRED = { code: "PGRST303", message: "JWT expired" };
const REST = "https://x.supabase.co/rest/v1/user_profiles?id=eq.u1";
const sent = (f, i) => new Headers(f.mock.calls[i][1].headers).get("Authorization");

afterEach(() => { vi.unstubAllGlobals(); refreshSession.mockReset(); });

describe("a request turned away with JWT expired", () => {
  it("is sent once more with a fresh token", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(401, EXPIRED)).mockResolvedValueOnce(reply(200, [{ phone: "8090911024" }]));
    vi.stubGlobal("fetch", f);
    refreshSession.mockResolvedValue({ data: { session: { access_token: "fresh" } } });
    const res = await fetchRefreshingExpired(REST, { method: "PATCH", headers: { Authorization: "Bearer old" }, body: "{}" });
    expect(res.status).toBe(200);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(sent(f, 0)).toBe("Bearer old");
    expect(sent(f, 1)).toBe("Bearer fresh");
    expect(f.mock.calls[1][1].body).toBe("{}");
  });
  it("comes back as it was when the refresh fails, and only once", async () => {
    const f = vi.fn().mockResolvedValue(reply(401, EXPIRED));
    vi.stubGlobal("fetch", f);
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error("offline") });
    expect((await fetchRefreshingExpired(REST, { headers: {} })).status).toBe(401);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("leaves every other answer, and auth's own calls, alone", async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(401, { message: "permission denied" })).mockResolvedValueOnce(reply(401, EXPIRED));
    vi.stubGlobal("fetch", f);
    await fetchRefreshingExpired(REST, { headers: {} });
    await fetchRefreshingExpired("https://x.supabase.co/auth/v1/user", { headers: {} });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(f).toHaveBeenCalledTimes(2);
  });
});
