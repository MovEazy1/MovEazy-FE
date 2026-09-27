/**
 * Fresh leads, Contacted leads, and no number.
 *
 * The rules that matter, because each was a way for the list to lie:
 *  - a number makes a lead; a sign-in alone never does
 *  - "contacted" means someone from MovEazy acted — the booking trigger moving
 *    a status, a note, or a row the system wrote do not count
 *  - "last on the site" is the client's own activity, never a staff edit
 *  - questionnaire defaults are not answers
 */
import { describe, expect, it } from "vitest";
import {
  QUIET_AFTER_DAYS, agoLabel, bucketOf, moveInTs, shortlistDueTs, sortClients, summariseClients,
} from "./crmLeadBuckets";

const NOW = Date.parse("2026-09-27T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);
const STAFF = "agent@moveazy.co.in";

const client = (over = {}) => ({
  id: "c1", user_id: null, phone: "9730020155", status: "fresh",
  created_at: daysAgo(3), updated_at: daysAgo(3), ...over,
});
const one = (c, sources = {}) => summariseClients([c], sources, NOW).get(c.id);

describe("which tab a client is in", () => {
  it("a number and no contact is a fresh lead", () => {
    expect(bucketOf(one(client()))).toBe("fresh");
  });

  it("a sign-in without a number is not a lead", () => {
    expect(bucketOf(one(client({ phone: "", user_id: "u1" })))).toBe("no_number");
    // A number too short to ring is no number at all.
    expect(bucketOf(one(client({ phone: "12345" })))).toBe("no_number");
  });

  it("staff WhatsApp, call, a recorded reply or a status change is contact", () => {
    for (const type of ["whatsapp", "call", "shortlist", "status", "contacted"]) {
      const s = one(client(), { activities: [{ client_id: "c1", actor_email: STAFF, type, created_at: hoursAgo(1) }] });
      expect(bucketOf(s), type).toBe("contacted");
    }
  });

  it("a note, a temperature or a system entry is not contact", () => {
    for (const type of ["note", "temperature", "system"]) {
      const s = one(client(), { activities: [{ client_id: "c1", actor_email: STAFF, type, created_at: hoursAgo(1) }] });
      expect(bucketOf(s), type).toBe("fresh");
    }
  });

  it("the client's own activity is not contact, whatever its type", () => {
    const s = one(client(), { activities: [{ client_id: "c1", actor_email: "", type: "visit", created_at: hoursAgo(1) }] });
    expect(bucketOf(s)).toBe("fresh");
  });

  it("a status the booking trigger set on its own is not contact", () => {
    // crm_visit_sync moves a client to visit_pending with nobody involved.
    expect(bucketOf(one(client({ status: "visit_pending" })))).toBe("fresh");
  });

  it("a flat we sent is contact; a row the booking trigger wrote is not", () => {
    const sent = one(client(), { shortlists: [{ client_id: "c1", status: "shared", shared_at: hoursAgo(5) }] });
    expect(bucketOf(sent)).toBe("contacted");
    const auto = one(client(), { shortlists: [{ client_id: "c1", status: "visit_scheduled", shared_at: null, shared_by: "" }] });
    expect(bucketOf(auto)).toBe("fresh");
  });

  it("someone we contacted is Contacted even with no number on file", () => {
    const s = one(client({ phone: "" }), {
      activities: [{ client_id: "c1", actor_email: STAFF, type: "call", created_at: hoursAgo(1) }],
    });
    expect(bucketOf(s)).toBe("contacted");
  });

  it("the manual mark is recorded as such", () => {
    const s = one(client(), { activities: [{ client_id: "c1", actor_email: STAFF, type: "contacted", created_at: hoursAgo(1) }] });
    expect(s.markedContacted).toBe(true);
  });
});

describe("when they were last on the site", () => {
  it("ignores crm_clients.updated_at, which staff edits move", () => {
    const s = one(client({ updated_at: hoursAgo(0.1), created_at: daysAgo(10) }));
    // Nothing of theirs on record: falls back to when they arrived, not to
    // the agent's edit a moment ago.
    expect(s.lastSiteActionAt).toBe(Date.parse(daysAgo(10)));
  });

  it("takes the latest of their activity, sessions, questionnaire and opens", () => {
    const c = client({ user_id: "u1" });
    const s = one(c, {
      activities: [
        { client_id: "c1", actor_email: "", type: "visit", created_at: hoursAgo(30) },
        { client_id: "c1", actor_email: STAFF, type: "call", created_at: hoursAgo(1) },
      ],
      engagement: [{ user_id: "u1", last_seen_at: hoursAgo(20) }],
      leads: [{ crm_client_id: "c1", updated_at: hoursAgo(6) }],
      shortlists: [{ client_id: "c1", shared_at: daysAgo(2), opened_at: hoursAgo(40) }],
    });
    expect(s.lastSiteActionAt).toBe(Date.parse(hoursAgo(6)));
    // Our call an hour ago is contact, not them being on the site.
    expect(s.lastContactAt).toBe(Date.parse(hoursAgo(1)));
  });
});

describe("how far a lead has got", () => {
  const staffCall = { client_id: "c1", actor_email: STAFF, type: "call", created_at: hoursAgo(1) };

  it("starts at prefs not filled", () => {
    expect(one(client(), { activities: [staffCall] }).stage).toBe("no_prefs");
  });

  it("does not count questionnaire defaults as answers", () => {
    // Every flat type starts ticked and a budget starts filled in; someone who
    // opened the questionnaire and left has answered nothing.
    const s = one(client(), {
      activities: [staffCall],
      leads: [{ crm_client_id: "c1", completed: false, prefs: { flatTypes: ["1 BHK", "2 BHK"], budgetMax: 45000, localities: [] } }],
    });
    expect(s.stage).toBe("no_prefs");
  });

  it("counts localities, a finished questionnaire, wizard answers or an agent's requirement", () => {
    const withLead = (lead) => one(client(), { activities: [staffCall], leads: [{ crm_client_id: "c1", ...lead }] }).stage;
    expect(withLead({ prefs: { localities: ["HSR"] } })).toBe("prefs_no_shortlist");
    expect(withLead({ completed: true, prefs: {} })).toBe("prefs_no_shortlist");
    expect(one(client({ user_id: "u1" }), {
      activities: [staffCall], ownAnswers: [{ user_id: "u1", localities: ["Bellandur"] }],
    }).stage).toBe("prefs_no_shortlist");
    expect(one(client(), { activities: [staffCall], requirements: [{ client_id: "c1", localities: ["HSR"] }] }).stage)
      .toBe("prefs_no_shortlist");
  });

  it("moves to sent-not-seen, then seen", () => {
    const sent = { client_id: "c1", status: "shared", shared_at: daysAgo(1) };
    expect(one(client(), { shortlists: [sent] }).stage).toBe("shortlisted_unseen");
    expect(one(client(), { shortlists: [{ ...sent, opened_at: hoursAgo(2) }] }).stage).toBe("shortlisted_seen");
    expect(one(client(), { shortlists: [{ ...sent, status: "okay" }] }).stage).toBe("shortlisted_seen");
  });

  it("is engaged once they like a flat or book a visit, however it happened", () => {
    expect(one(client(), { activities: [staffCall], interest: [{ client_id: "c1", signal: "liked", at: hoursAgo(3) }] }).stage)
      .toBe("engaged");
    expect(one(client(), { activities: [staffCall], interest: [{ client_id: "c1", signal: "booked", at: hoursAgo(3) }] }).stage)
      .toBe("engaged");
    // Merely opening the flat that brought them in is not engagement.
    expect(one(client(), { activities: [staffCall], interest: [{ client_id: "c1", signal: "opened_link", at: hoursAgo(3) }] }).stage)
      .toBe("no_prefs");
  });
});

describe("going quiet", () => {
  it(`is a contacted lead with nothing from us in ${QUIET_AFTER_DAYS}+ days`, () => {
    const at = (d) => one(client(), { activities: [{ client_id: "c1", actor_email: STAFF, type: "call", created_at: daysAgo(d) }] });
    expect(at(QUIET_AFTER_DAYS + 1).quiet).toBe(true);
    expect(at(1).quiet).toBe(false);
  });

  it("never applies to a closed lead", () => {
    const s = one(client({ status: "closed_by_us" }), {
      activities: [{ client_id: "c1", actor_email: STAFF, type: "status", created_at: daysAgo(30) }],
    });
    expect(s.closed).toBe(true);
    expect(s.quiet).toBe(false);
  });
});

describe("sorting", () => {
  const a = client({ id: "a", created_at: daysAgo(1) });
  const b = client({ id: "b", created_at: daysAgo(5) });
  const c = client({ id: "c", created_at: daysAgo(3) });
  const sources = {
    leads: [
      { crm_client_id: "a", updated_at: daysAgo(4) },
      { crm_client_id: "b", updated_at: hoursAgo(1) },
    ],
    activities: [
      { client_id: "a", actor_email: STAFF, type: "call", created_at: daysAgo(1) },
      { client_id: "b", actor_email: STAFF, type: "call", created_at: daysAgo(9) },
      { client_id: "c", actor_email: STAFF, type: "call", created_at: daysAgo(4) },
    ],
  };
  const sums = summariseClients([a, b, c], sources, NOW);
  const ids = (rows) => rows.map((r) => r.id);

  it("defaults to whoever was on the site most recently", () => {
    // b: an hour ago. c: nothing of its own, so when it arrived (3d).
    // a: questionnaire 4 days ago, arrived 1 day ago — its own activity wins.
    expect(ids(sortClients([a, b, c], "site", sums))).toEqual(["b", "c", "a"]);
  });

  it("can show the newest leads first", () => {
    expect(ids(sortClients([a, b, c], "newest", sums))).toEqual(["a", "c", "b"]);
  });

  it("puts the lead we've neglected longest first", () => {
    expect(ids(sortClients([a, b, c], "quiet", sums))).toEqual(["b", "c", "a"]);
  });

  it("sinks unknown move-in dates and deadlines to the bottom", () => {
    const moveIn = { a: "2026-11-01", b: "", c: "2026-10-05" };
    expect(ids(sortClients([a, b, c], "move_in", sums, { moveIn: (r) => moveInTs(moveIn[r.id]) }))).toEqual(["c", "a", "b"]);
    const due = { a: null, b: hoursAgo(-5), c: hoursAgo(-50) };
    expect(ids(sortClients([a, b, c], "deadline", sums, {
      due: (r) => shortlistDueTs(due[r.id] ? { shortlistDeadline: due[r.id] } : null),
    }))).toEqual(["b", "c", "a"]);
  });
});

describe("agoLabel", () => {
  it("reads minutes, hours, then days", () => {
    expect(agoLabel(NOW - 5 * 60000, NOW)).toBe("5m ago");
    expect(agoLabel(NOW - 5 * 3600000, NOW)).toBe("5h ago");
    expect(agoLabel(NOW - 5 * 86400000, NOW)).toBe("5d ago");
    expect(agoLabel(0, NOW)).toBe("");
  });
});
