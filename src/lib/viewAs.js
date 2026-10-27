/**
 * "View as a user" — the super admin's side (view_as.sql, api/view-as.js).
 *
 * start: the server opens a session and a one-time sign-in for the account;
 * the admin's own sign-in is put aside, the browser becomes that user, and
 * every request after that is marked (lib/viewAsState.js) so the database
 * keeps it view-only, or records it when actions are allowed.
 * exit: ends the session, signs the user's session out, and puts the admin's
 * own sign-in back.
 */
import { supabase } from "./supabase";
import { VIEW_AS_PATH, saveViewAsState, viewAsState } from "./viewAsState";

export const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** Where each kind of account lives, on www paths. */
export const VIEW_AS_APPS = [
  { role: "tenant", label: "Tenant site", path: "/" },
  { role: "owner", label: "Owner app", path: "/owners" },
  { role: "partner", label: "Partner app", path: "/partners" },
  { role: "society", label: "Society app", path: "/society" },
  { role: "crm", label: "CRM", path: "/crm" },
];
export const appsFor = (roles = []) => VIEW_AS_APPS.filter((a) => a.role === "tenant" || roles.includes(a.role));

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

/* ── The portal (signed in as the super admin) ────────────────────────────── */

export const searchUsers = (q) => rpc("view_as_search", { p_q: q }).then((r) => r ?? []);
export const fetchViewAsHistory = (limit = 40) => rpc("view_as_history", { p_limit: limit }).then((r) => r ?? []);
export const fetchViewAsChanges = (session) => rpc("view_as_session_changes", { p_session: session }).then((r) => r ?? []);
export const keepViewAsChanges = (session) => rpc("view_as_keep", { p_session: session });

/** Puts back what the session changed, and removes the files it uploaded. → { reverted, skipped, removed } */
export async function revertViewAs(session) {
  const out = await rpc("view_as_revert", { p_session: session });
  const { data: { session: auth } = {} } = await supabase.auth.getSession();
  let removed = 0;
  try {
    const r = await fetch("/api/view-as", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${auth?.access_token || ""}` },
      body: JSON.stringify({ action: "remove-uploads", session }),
    });
    removed = (await r.json().catch(() => ({})))?.removed || 0;
  } catch { /* the rows are back; a stray file can be removed later */ }
  return { ...out, removed };
}

/** Become `user` ({ id, email, name, roles }) and open `path`. */
export async function startViewAs(user, path = "/") {
  if (viewAsState()) throw new Error("You're already viewing as someone — exit first.");
  const { data: { session: admin } = {} } = await supabase.auth.getSession();
  if (!admin?.refresh_token) throw new Error("Sign in again.");
  const r = await fetch("/api/view-as", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${admin.access_token}` },
    body: JSON.stringify({ action: "start", userId: user.id }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.tokenHash) throw new Error(body.error || "Couldn't open this account.");

  // The admin's own sign-in, kept to come back to.
  const now = Date.now();
  saveViewAsState({
    session: body.session, key: body.key, mode: "view",
    target: { id: user.id, email: body.email, name: user.name || body.name || "", roles: user.roles || ["tenant"] },
    admin: { access_token: admin.access_token, refresh_token: admin.refresh_token },
    startedAt: now, lastActive: now, panel: true,
  });
  const { error } = await supabase.auth.verifyOtp({ token_hash: body.tokenHash, type: "magiclink" });
  if (error) {
    await restoreAdmin(admin);
    saveViewAsState(null);
    throw new Error(`Couldn't sign in as them: ${error.message}`);
  }
  await control("begin").catch(() => {});
  window.location.assign(path);
}

/* ── While viewing as someone ─────────────────────────────────────────────── */

export async function control(action, reason = "") {
  const st = viewAsState();
  if (!st) return null;
  return rpc("view_as_control", { p_session: st.session, p_key: st.key, p_action: action, p_reason: reason });
}

/** "view" or "act". */
export async function setViewAsMode(mode) {
  const st = viewAsState();
  if (!st) return;
  const out = await control(mode);
  saveViewAsState({ ...viewAsState(), mode: out?.mode || mode });
}

export function touchViewAs() {
  const st = viewAsState();
  if (st) saveViewAsState({ ...st, lastActive: Date.now() });
}

async function restoreAdmin(admin) {
  if (!admin?.refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token: admin.access_token, refresh_token: admin.refresh_token });
  if (error) await supabase.auth.refreshSession({ refresh_token: admin.refresh_token }).catch(() => {});
}

/**
 * Back to the admin's own account. `reason`: "exit" or "idle". Lands on the
 * portal, which asks to revert or keep whatever was changed.
 */
export async function exitViewAs(reason = "exit") {
  const st = viewAsState();
  if (!st) return;
  await control("end", reason).catch(() => {});
  // Their session ends here, not just in this browser.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  saveViewAsState(null);
  await restoreAdmin(st.admin);
  window.location.assign(`${VIEW_AS_PATH}?done=${encodeURIComponent(st.session)}${reason === "idle" ? "&idle=1" : ""}`);
}
