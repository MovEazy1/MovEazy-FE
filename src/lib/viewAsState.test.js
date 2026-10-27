// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { VIEW_AS_KEY, isViewingAs, saveViewAsState, viewAsFetch } from "./viewAsState";

const SB = "https://x.supabase.co";
const ok = (status = 200, body = "[]") => vi.fn(async () => new Response(body, { status }));
const on = (mode = "view") => saveViewAsState({ session: "s-1", key: "k", mode, target: { id: "u" } });

afterEach(() => {
  window.localStorage.removeItem(VIEW_AS_KEY);
});

describe("viewAsFetch", () => {
  it("leaves every request alone when not viewing as anyone", async () => {
    const send = ok();
    await viewAsFetch(`${SB}/rest/v1/rpc/app_track`, { method: "POST" }, send);
    expect(isViewingAs()).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(new Headers(send.mock.calls[0][1]?.headers).get("x-mz-view-as")).toBeNull();
  });

  it("marks requests with the session", async () => {
    on();
    const send = ok();
    await viewAsFetch(`${SB}/rest/v1/inventory?select=*`, { method: "GET", headers: { apikey: "a" } }, send);
    const h = new Headers(send.mock.calls[0][1].headers);
    expect(h.get("x-mz-view-as")).toBe("s-1");
    expect(h.get("apikey")).toBe("a");
  });

  it("never sends activity counters, in either mode", async () => {
    for (const mode of ["view", "act"]) {
      on(mode);
      const send = ok();
      const res = await viewAsFetch(`${SB}/rest/v1/rpc/flat_view`, { method: "POST" }, send);
      expect(send).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    }
  });

  it("never lets a payment start, even with actions allowed", async () => {
    on("act");
    const send = ok();
    const res = await viewAsFetch(`${SB}/rest/v1/rpc/partner_payment_start`, { method: "POST" }, send);
    expect(send).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
    expect((await res.json()).message).toMatch(/Payments are off/);
  });

  it("blocks uploads in view-only, and notes them with actions allowed", async () => {
    on("view");
    const url = `${SB}/storage/v1/object/listings/inventory/MZ-1/a.jpg`;
    const send = ok();
    expect((await viewAsFetch(url, { method: "POST" }, send)).status).toBe(403);
    expect(send).not.toHaveBeenCalled();

    on("act");
    const noted = vi.fn();
    await viewAsFetch(url, { method: "POST" }, ok(), noted);
    expect(noted).toHaveBeenCalledWith("listings", "inventory/MZ-1/a.jpg");
  });

  it("says when the database dropped a write", async () => {
    on();
    const heard = vi.fn();
    window.addEventListener("mz-view-as-notice", heard);
    await viewAsFetch(`${SB}/rest/v1/rpc/save_something`, { method: "POST" }, ok(203));
    window.removeEventListener("mz-view-as-notice", heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0].detail).toBe("view-only");
  });

  it("never changes the account's own settings", async () => {
    on("act");
    const send = ok();
    expect((await viewAsFetch(`${SB}/auth/v1/user`, { method: "PUT" }, send)).status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });
});
