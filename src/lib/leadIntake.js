/**
 * What we know about a tenant before they have an account.
 *
 * The funnel used to open with a Google wall on the first real click, and
 * everyone not ready to hand over an account left without a trace. Now we ask
 * for a mobile number, run the preference questionnaire, and only then put up
 * the signup gate — so a drop-off at the gate still leaves a lead the team can
 * call, and the person who does sign up has already done the work.
 *
 * Identity here is the browser, not the phone. A number typed into a form is
 * unverified; keying resumable state to it would let anyone type a stranger's
 * number and read their answers back. So state is keyed by `lead_key`, 128
 * random bits kept in localStorage — unguessable, and it never leaves the
 * device. The phone is data we collect, not a credential we trust.
 *
 * Every write goes to two places: localStorage, so a reopened tab resumes
 * instantly and a blocked network doesn't lose the answers, and a
 * security-definer RPC, because the visitor has no session and cannot write to
 * a table directly. localStorage is the cache; the database is the record.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { anonId } from "./sessionSync";
import { firstTouch } from "./attribution";

const KEY_STORAGE = "moveazy_lead_key";
const SNAPSHOT_STORAGE = "moveazy_lead";

const empty = () => ({
  name: "", phone: "", prefs: null, step: 0, completed: false,
  // "questionnaire" or "direct_property" — someone who answered nine questions
  // told us what they want; someone who opened a shared link told us only
  // which flat caught their eye, which is what propertyId keeps.
  leadType: "", propertyId: "",
});

function readLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — the RPC copy is still the record */
  }
}

/**
 * This browser's lead key, minted on first use.
 *
 * Deliberately not `anonId()`, which is seeded from Math.random and already
 * written to user_sessions: anything that can be guessed would expose one
 * visitor's answers and phone number to another. getRandomValues is the whole
 * reason this is a separate value.
 */
export function leadKey() {
  try {
    let key = localStorage.getItem(KEY_STORAGE);
    if (key && key.length >= 24) return key;

    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      // No crypto: still better than a guessable id, and this browser is old
      // enough that it is not the one we are protecting against.
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY_STORAGE, key);
    return key;
  } catch {
    return "";
  }
}

/** The cached lead, readable synchronously — what the UI gates on. */
export function leadSnapshot() {
  return { ...empty(), ...(readLocal(SNAPSHOT_STORAGE) || {}) };
}

/** Has this browser given us a number yet? The phone gate's whole question. */
export function hasLeadPhone() {
  return Boolean(leadSnapshot().phone);
}

/**
 * Persist part of a lead. Fields left undefined are untouched rather than
 * cleared, so a step saving only its own answer cannot wipe an earlier one.
 * Best-effort by design: losing a step to a failed network is not worth
 * interrupting somebody halfway through a questionnaire.
 */
export async function saveLead(patch = {}) {
  const key = leadKey();
  if (!key) return leadSnapshot();

  const next = { ...leadSnapshot() };
  for (const field of ["name", "phone", "prefs", "step", "completed", "leadType", "propertyId"]) {
    if (patch[field] !== undefined) next[field] = patch[field];
  }
  // Someone who has started answering questions is a questionnaire lead, and
  // opening a shared link later must not demote them — they have told us what
  // they want, which is worth more than which flat they last tapped. Keyed on
  // actual progress, not on the field's own default, or a brand-new lead would
  // count as a questionnaire one and could never be marked direct.
  const prev = leadSnapshot();
  if (prev.step > 0 || prev.completed) next.leadType = "questionnaire";
  if (prev.propertyId) next.propertyId = prev.propertyId;
  // completed latches: reopening the questionnaire to change an answer must
  // not un-complete a lead the CRM has already acted on.
  next.completed = leadSnapshot().completed || Boolean(next.completed);
  writeLocal(SNAPSHOT_STORAGE, next);

  if (!isSupabaseConfigured || !supabase) return next;

  const touch = firstTouch();
  try {
    await supabase.rpc("save_lead_intake", {
      p_lead_key: key,
      p_anon_id: anonId(),
      p_name: patch.name ?? null,
      p_phone: patch.phone ?? null,
      p_prefs: patch.prefs ?? null,
      p_step: patch.step ?? null,
      p_completed: patch.completed ?? null,
      p_utm: touch
        ? { source: touch.source, medium: touch.medium, campaign: touch.campaign, content: touch.content }
        : null,
      p_lead_type: patch.leadType ?? null,
      p_property_id: patch.propertyId ?? null,
    });
  } catch {
    /* kept locally; the next step's save carries the same fields again */
  }
  return next;
}

/**
 * Pull this browser's lead back from the server and refresh the cache.
 *
 * Covers the case localStorage cannot: same browser, but the snapshot was
 * evicted while the key survived. Returns the merged view.
 */
export async function loadLead() {
  const key = leadKey();
  const cached = leadSnapshot();
  if (!key || !isSupabaseConfigured || !supabase) return cached;

  try {
    const { data, error } = await supabase.rpc("get_lead_intake", { p_lead_key: key });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return cached;

    const merged = {
      ...cached,
      name: row.name || cached.name,
      phone: row.phone || cached.phone,
      leadType: row.lead_type || cached.leadType,
      propertyId: row.property_id || cached.propertyId,
      // The server's answers win: they are the ones the CRM is looking at.
      prefs: row.prefs && Object.keys(row.prefs).length ? row.prefs : cached.prefs,
      step: Math.max(Number(row.step) || 0, cached.step || 0),
      completed: Boolean(row.completed) || cached.completed,
    };
    writeLocal(SNAPSHOT_STORAGE, merged);
    return merged;
  } catch {
    return cached;
  }
}

/**
 * Hand this lead to the account that just signed up.
 *
 * Preferences are written by the caller through saveUserRequirement, which
 * already owns that mapping. The RPC does the parts the client cannot: marking
 * the lead claimed, pointing the CRM row at the new account so the lead and the
 * customer stop being two rows, and copying the phone onto the profile so
 * RequirePhoneModal doesn't ask for a number they already gave us.
 *
 * Safe to call on every sign-in: the server only claims a lead once.
 */
export async function claimLead() {
  const key = leadKey();
  if (!key || !isSupabaseConfigured || !supabase) return null;
  try {
    await supabase.rpc("claim_lead_intake", { p_lead_key: key });
  } catch {
    return null;
  }
  return leadSnapshot();
}

/** Test seam. */
export function clearLead() {
  try {
    localStorage.removeItem(SNAPSHOT_STORAGE);
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* nothing to clear */
  }
}
