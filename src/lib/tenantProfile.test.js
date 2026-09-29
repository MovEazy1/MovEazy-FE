import { describe, expect, it } from "vitest";
import { FIRST_JOB, fromRow, missingSteps, normalizeLinkedIn, profileScore, scoreLabel, toRow } from "./tenantProfile";

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
    // How people actually paste it
    expect(normalizeLinkedIn("riya-sharma-12a3b4")).toBe("https://www.linkedin.com/in/riya-sharma-12a3b4");
    expect(normalizeLinkedIn("@riya-sharma")).toBe("https://www.linkedin.com/in/riya-sharma");
    expect(normalizeLinkedIn("/in/riya-sharma/")).toBe("https://www.linkedin.com/in/riya-sharma");
    expect(normalizeLinkedIn("https://www.linkedin.com/in/riya-sharma-12a3b4?utm_source=share&utm_campaign=share_via&utm_medium=android_app"))
      .toBe("https://www.linkedin.com/in/riya-sharma-12a3b4");
    expect(normalizeLinkedIn("www.linkedin.com/in/riya-sharma/details/experience/")).toBe("https://www.linkedin.com/in/riya-sharma");
    expect(normalizeLinkedIn("LinkedIn.com/in/Riya-Sharma")).toBe("https://www.linkedin.com/in/Riya-Sharma");
    expect(normalizeLinkedIn("linkedin.com/in/%E0%A4%B0%E0%A4%BF%E0%A4%AF%E0%A4%BE")).toBe("https://www.linkedin.com/in/%E0%A4%B0%E0%A4%BF%E0%A4%AF%E0%A4%BE");
    expect(normalizeLinkedIn("ab")).toBe("");
    expect(normalizeLinkedIn("riya.sharma@gmail.com")).toBe("");
    expect(normalizeLinkedIn("https://www.linkedin.com/posts/riya_activity-123")).toBe("");
    expect(profileScore({ ...signup, linkedin: "not a link" }).score).toBe(20);
  });

  it("blank answers don't count and their screen is asked again", () => {
    const p = { ...signup, currentCompany: "  ", college: "BITS Pilani", inBangaloreSince: "2024" };
    expect(profileScore(p).score).toBe(40);
    expect(missingSteps(p).map((s) => s.id)).toEqual(["currentCompany", "pastCompany", "education", "maritalStatus", "linkedin"]);
  });

  it("saves in the database's shape and reads back the same profile", () => {
    const p = { ...all, pastCompany: FIRST_JOB, maritalStatus: "family" };
    const row = toRow("u1", p);
    expect(row).toMatchObject({
      user_id: "u1", linkedin: "https://www.linkedin.com/in/riya-sharma", past_company: "", first_job: true,
      graduation_year: 2021, marital_status: "family",
    });
    expect(row).not.toHaveProperty("name");
    const { name, phone, ...fields } = p;
    expect(name && phone).toBeTruthy();
    expect(fromRow({ ...row, score: 100 })).toEqual({ ...fields, linkedin: row.linkedin });
  });

  it("never sends a value the database would refuse", () => {
    const row = toRow("u1", { linkedin: "linkedin.com/company/x", graduationYear: "1800", maritalStatus: "complicated", currentCompany: "x".repeat(300) });
    expect(row).toMatchObject({ linkedin: "", graduation_year: null, marital_status: "" });
    expect(row.current_company).toHaveLength(120);
  });
});
