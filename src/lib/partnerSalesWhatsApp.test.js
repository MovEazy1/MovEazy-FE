import { describe, expect, it } from "vitest";
import { PAY_ON_WHATSAPP, salesWhatsAppUrl } from "./partnerPlans";

describe("pay on WhatsApp (temporary, until Razorpay)", () => {
  it("sends every Pay click to the sales number with the agreed message", () => {
    expect(PAY_ON_WHATSAPP).toBe(true);
    const url = new URL(salesWhatsAppUrl());
    expect(url.origin + url.pathname).toBe("https://wa.me/918090911024");
    expect(url.searchParams.get("text")).toBe(
      "Hey, I'm interested in becoming a partner at MovEazy and want to understand more about the benefits.",
    );
  });
});
