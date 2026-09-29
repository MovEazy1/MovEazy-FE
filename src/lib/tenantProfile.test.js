import { describe, expect, it } from "vitest";
import { FIRST_JOB, missingSteps, normalizeLinkedIn, profileScore, scoreLabel } from "./tenantProfile";

const signup = { name: "Riya Sharma", phone: "9876543210" };
const all = {
  ...signup, linkedin: "linkedin.com/in/riya-sharma", currentCompany: "Swiggy", pastCompany: "Infosys",
  college: "BITS Pilani", graduationYear: "2021", inBangaloreSince: "2023",
};

describe("tenant profile score", () => {
  it("starts at 20 from sign-up alone", () => {
    expect(profileScore(signup)).toMatchObject({ score: 20, complete: false });
    expect(scoreLabel(20)).toBe("Getting started");
  });

  it("adds each field's points as it is filled", () => {
    expect(profileScore({ ...signup, currentCompany: "Swiggy" }).score).toBe(35);
    expect(profileScore({ ...signup, currentCompany: "Swiggy", pastCompany: FIRST_JOB }).score).toBe(45);
    expect(profileScore({ ...signup, college: "BITS Pilani", graduationYear: "2021" }).score).toBe(35);
  });

  it("every field filled, single: Excellent 90", () => {
    const r = profileScore({ ...all, maritalStatus: "single" });
    expect(r).toMatchObject({ score: 90, complete: true });
    expect(scoreLabel(r.score)).toBe("Excellent");
  });

  it("every field filled, a family: Outstanding 100", () => {
    for (const status of ["married", "family"]) {
      const r = profileScore({ ...all, maritalStatus: status });
      expect(r).toMatchObject({ score: 100, complete: true });
      expect(scoreLabel(r.score)).toBe("Outstanding");
    }
  });

  it("no family bonus until the profile is complete", () => {
    expect(profileScore({ ...signup, maritalStatus: "married" }).score).toBe(30);
  });

  it("only a real LinkedIn profile link counts", () => {
    expect(normalizeLinkedIn("https://www.linkedin.com/in/riya-sharma/")).toBe("https://www.linkedin.com/in/riya-sharma");
    expect(normalizeLinkedIn("in.linkedin.com/in/riya_s?trk=x")).toBe("https://www.linkedin.com/in/riya_s");
    expect(normalizeLinkedIn("linkedin.com/company/swiggy")).toBe("");
    expect(normalizeLinkedIn("riya sharma")).toBe("");
    expect(profileScore({ ...signup, linkedin: "not a link" }).score).toBe(20);
  });

  it("blank answers don't count and their screen is asked again", () => {
    const p = { ...signup, currentCompany: "  ", college: "BITS Pilani", inBangaloreSince: "2024" };
    expect(profileScore(p).score).toBe(40);
    expect(missingSteps(p).map((s) => s.id)).toEqual(["linkedin", "currentCompany", "pastCompany", "education", "maritalStatus"]);
  });
});
