import { describe, expect, it } from "vitest";
import { draftSummary, draftToForm, senderLine } from "./whatsappIntake";

const draft = (x = {}) => ({
  id: "d1", kind: "property", sender_kind: "partner", sender_name: "Kiran Realty", from10: "9811122233", crm_broker_id: null,
  received_at: "2026-11-02T06:00:00Z", images: ["https://x/1.jpg"], text: "2BHK HSR 32k",
  fields: {
    area: "HSR", building_name: "Sobha Daffodil", full_address: "Sector 2", landmark: "", flat_type: "2 BHK", bedrooms: 2, bathrooms: "",
    rent: 32000, deposit: "", maintenance: 3000, available_from: "2026-11-15", furnishing: "Semi Furnished", floor_number: 0,
    total_floors: 4, gender_pref: "any", occupants_allowed: ["Family"], amenities: [], house_rules: ["No Pets"],
    contact_name: "", contact_phone: "", contact_role: "", title: "2 BHK in HSR", description: "Bright flat.", notes: "Brokerage 1 month",
  },
  ...x,
});

describe("a WhatsApp draft in the property form", () => {
  it("fills the listing, keeping 0 floors and the default amenities", () => {
    const { form, images, text } = draftToForm(draft());
    expect(form).toMatchObject({ area: "HSR", full_address: "Sobha Daffodil, Sector 2", rent: 32000, deposit: "", maintenance: 3000,
      floor_number: 0, flat_type: "2 BHK", furnishing: "Semi Furnished", house_rules: ["No Pets"], posted_by: "broker" });
    expect("amenities" in form).toBe(false);
    expect(images).toEqual(["https://x/1.jpg"]);
    expect(text).toBe("2BHK HSR 32k");
  });
  it("a partner's flat: came through a broker, the partner is the person to call", () => {
    const { internal } = draftToForm(draft());
    expect(internal).toMatchObject({ source: "broker", poc_name: "Kiran Realty", poc_phone: "9811122233" });
    expect(internal.poc_note).toMatch(/^From WhatsApp on 2 Nov: Kiran Realty · 98111 22233\. Brokerage 1 month$/);
  });
  it("an owner named in the message is the person to call, and the owner's number", () => {
    const { internal, form } = draftToForm(draft({ sender_kind: "marked", fields: { ...draft().fields, contact_name: "Mr Rao", contact_phone: "9845012345", contact_role: "owner" } }));
    expect(internal).toMatchObject({ source: "owner", poc_name: "Mr Rao", poc_phone: "9845012345", owner_phone: "9845012345" });
    expect(form.posted_by).toBe("owner");
  });
  it("a marked broker matched in the Brokers directory", () => {
    const { internal } = draftToForm(draft({ sender_kind: "marked", crm_broker_id: "cb1" }));
    expect(internal).toMatchObject({ source: "broker", broker_id: "cb1" });
  });
  it("the inbox's lines", () => {
    expect(draftSummary(draft())).toBe("2 BHK · HSR · ₹32,000 · Sobha Daffodil");
    expect(senderLine({ sender_kind: "team", from10: "" })).toBe("Pasted");
  });
});
