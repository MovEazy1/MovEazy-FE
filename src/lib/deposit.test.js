import { describe, expect, it } from "vitest";
import { autoDeposit, autoDepositHint } from "./deposit";

describe("autoDeposit", () => {
  it("is 3.5 × rent to the nearest ₹5,000", () => {
    expect(autoDeposit(27500)).toBe(95000); // 96,250
    expect(autoDeposit(30000)).toBe(105000);
    expect(autoDeposit(34000)).toBe(120000); // 1,19,000
    expect(autoDeposit(12000)).toBe(40000); // 42,000 rounds down
  });
  it("is nothing without a rent", () => {
    expect(autoDeposit(0)).toBe(0);
    expect(autoDeposit("")).toBe(0);
    expect(autoDeposit("abc")).toBe(0);
  });
  it("says what it will be", () => {
    expect(autoDepositHint(27500)).toBe("Auto: ₹95,000 (3.5 × rent)");
    expect(autoDepositHint("")).toBe("Auto: 3.5 × rent");
  });
});
