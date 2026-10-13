import { describe, expect, it } from "vitest";
import { contactPhone } from "./partners";

describe("contactPhone", () => {
  it("the sign-in number by default", () => expect(contactPhone({ phone: "9876500001", alt_phone: "9123456789", contact_primary: "main" })).toBe("9876500001"));
  it("the second number when it's primary", () => expect(contactPhone({ phone: "9876500001", alt_phone: "9123456789", contact_primary: "alt" })).toBe("9123456789"));
  it("never an empty second number", () => expect(contactPhone({ phone: "9876500001", alt_phone: "", contact_primary: "alt" })).toBe("9876500001"));
  it("no partner: empty", () => expect(contactPhone(null)).toBe(""));
});
