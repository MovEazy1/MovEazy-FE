import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ isSupabaseConfigured: false, supabase: null }));
const { prefsToRow, rowToPrefs } = await import("./userRequirements");

describe("the 'Anything else?' ticks", () => {
  it("save in the order offered, keep only real options, and come back", () => {
    const row = prefsToRow({ aboutMe: ["I have a car", "I have a cat", "I have a horse", "I have a car"], priority: [] }, { uid: "u1" });
    expect(row.notes.aboutMe).toEqual(["I have a cat", "I have a car"]);
    expect(rowToPrefs(row).aboutMe).toEqual(["I have a cat", "I have a car"]);
  });
  it("are empty for answers saved before the question existed", () => {
    expect(rowToPrefs({ notes: {} }).aboutMe).toEqual([]);
    expect(prefsToRow({}, { uid: "u1" }).notes.aboutMe).toEqual([]);
  });
});
