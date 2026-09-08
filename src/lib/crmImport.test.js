import { describe, expect, it } from "vitest";
import { buildTemplateCsv, parseCsv, planImport } from "./crmImport";

describe("csv parsing", () => {
  it("keeps commas and quotes inside quoted fields", () => {
    const rows = parseCsv('name,note\n"Rao, Ananya","She said ""maybe"" twice"\n');
    expect(rows[1]).toEqual(["Rao, Ananya", 'She said "maybe" twice']);
  });

  it("handles a newline inside a quoted field", () => {
    const rows = parseCsv('name,note\nAnanya,"line one\nline two"\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("line one\nline two");
  });

  it("drops fully blank lines", () => {
    expect(parseCsv("a,b\n\n\nc,d\n")).toHaveLength(2);
  });
});

describe("the downloadable template", () => {
  it("round-trips, and its guide rows import as nothing", () => {
    const plan = planImport(parseCsv(buildTemplateCsv()));
    // Both the hint row and the example row are prefixed with "#", so someone
    // can fill the sheet in without first deleting the instructions.
    expect(plan.clients).toHaveLength(0);
    expect(plan.skipped).toBe(2);
    expect(plan.errors).toHaveLength(0);
  });
});

describe("planning an import", () => {
  const header =
    "name,phone,email,status,temperature,localities,budget_min,budget_max,flat_types,move_in," +
    "closed_property_id,closed_rent,brokerage_amount,expected_credit_date,closed_reason";

  it("imports a historical closed deal as closed, awaiting payment", () => {
    const csv =
      `${header}\n` +
      "Ananya Rao,9845012233,a@b.com,closed_by_us,hot,HSR;Koramangala,30000,50000,2 BHK;3 BHK," +
      "15 Oct 2026,MZ-R9NAQY,22500,11250,2026-10-30,\n";
    const { clients, errors } = planImport(parseCsv(csv));

    expect(errors).toHaveLength(0);
    expect(clients).toHaveLength(1);
    const { client, requirement } = clients[0];
    expect(client.status).toBe("closed_by_us");
    expect(client.closed_property_id).toBe("MZ-R9NAQY");
    expect(client.brokerage_amount).toBe(11250);
    expect(client.expected_credit_date).toBe("2026-10-30");
    expect(client.payment_status).toBe("awaited");
    expect(client.closed_at).toBeTruthy();
    expect(requirement.localities).toEqual(["HSR", "Koramangala"]);
    expect(requirement.flat_types).toEqual(["2 BHK", "3 BHK"]);
    expect(requirement.budget_max).toBe(50000);
  });

  it("does not put a closed_outside deal on the payments list", () => {
    const csv = `${header}\nMeera,9800000000,,closed_outside,,,,,,,,,,,Went with a broker\n`;
    const { clients } = planImport(parseCsv(csv));
    expect(clients[0].client.payment_status).toBe("none");
    expect(clients[0].client.closed_reason).toBe("Went with a broker");
  });

  it("rejects an unknown status rather than silently defaulting it", () => {
    const csv = `${header}\nSomeone,9800000000,,in_progress,,,,,,,,,,,\n`;
    const { clients, errors } = planImport(parseCsv(csv));
    expect(clients).toHaveLength(0);
    expect(errors[0]).toMatch(/not a status/);
  });

  it("defaults a row with no status to a fresh lead", () => {
    const csv = `${header}\nKarthik,9800000001,,,,,,,,,,,,,\n`;
    expect(planImport(parseCsv(csv)).clients[0].client.status).toBe("fresh");
  });

  it("skips rows with neither a name nor a phone", () => {
    const csv = `${header}\n,,nobody@example.com,,,,,,,,,,,,\n`;
    const { clients, skipped } = planImport(parseCsv(csv));
    expect(clients).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("falls back to the phone number when a row has no name", () => {
    const csv = `${header}\n,9845012233,,,,,,,,,,,,,\n`;
    expect(planImport(parseCsv(csv)).clients[0].client.name).toBe("9845012233");
  });
});
