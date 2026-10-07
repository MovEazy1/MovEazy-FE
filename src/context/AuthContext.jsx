import { createContext, useContext, useState, useEffect, useRef } from "react";
import { gmailSignupErrorMessage, isGmailAddress } from "../lib/emailPolicy";
import { triggerVerifiedOnboardingEmails } from "../lib/emailService";
import {
  createProfileAfterSignup,
  ensureUserProfileDocuments,
  getPendingSellerBadgeApplicationsRemote,
  getProfileForUser,
  normalizeSignupRole,
  recordSignupAttribution,
  setRoleForEmail,
  setSellerBadgeStatusForEmail,
  submitSellerBadgeApplicationRemote,
  updateUserProfileFields,
} from "../lib/profileService";
import { saveCustomerSearchProfile } from "../lib/customerSearchProfile";
import { attributionToken } from "../lib/attribution";
import { claimLead, leadSnapshot } from "../lib/leadIntake";
import { fetchUserRequirement, saveUserRequirement } from "../lib/userRequirements";
import { isEmailAdminAllowed, getEnvAdminEmails } from "../lib/adminAccess";
import { supabase, isSupabaseConfigured, normalizeSupabaseError, getSupabaseAuthSettings, storedSessionUid } from "../lib/supabase";
import { clearCacheExcept, DAY_MS } from "../lib/localCache";

const AuthContext = createContext(null);
const ADMIN_EMAILS = getEnvAdminEmails();

function getProviderLabel(sbUser) {
  return sbUser?.app_metadata?.provider || "";
}

/** Email/password accounts require a confirmed email; OAuth providers are pre-verified. */
function isSessionAllowed(sbUser) {
  if (!sbUser) return false;
  if (getProviderLabel(sbUser) !== "email") return true;
  return Boolean(sbUser.email_confirmed_at);
}

function buildUserFromSupabase(sbUser) {
  const email = String(sbUser?.email || "").toLowerCase().trim();
  const meta = sbUser?.user_metadata || {};
  const roleCandidate = meta.role || "customer";
  const role = ADMIN_EMAILS.includes(email) ? "admin" : (roleCandidate === "seller" || roleCandidate === "broker" || roleCandidate === "tenant" || roleCandidate === "owner" ? roleCandidate : "customer");
  return {
    email,
    role,
    name: meta.full_name || meta.name || (email ? email.split("@")[0] : "User"),
    phone: meta.phone || "",
    uid: sbUser.id,
    authProvider: getProviderLabel(sbUser),
    profileComplete: false,
  };
}

/**
 * The signed-in user as last read, kept on the device for 30 days so any tab —
 * a new one, the partner or owner app opened from the home screen — draws as
 * that person at once instead of behind "Loading…" while the profile is read
 * again. It was per tab (sessionStorage), so every new tab waited.
 *
 * Only trusted while Supabase's own saved session is for the same account; the
 * session handler re-reads the profile in the background either way.
 */
const USER_KEY = "moveasy_user_v2";
const USER_MAX_AGE = 30 * DAY_MS;

function cacheSessionUser(u) {
  try {
    sessionStorage.removeItem("moveasy_session_user"); // the old per-tab copy
    if (!u) {
      localStorage.removeItem(USER_KEY);
      return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify({ u, at: Date.now() }));
  } catch {
    /* ignore quota errors */
  }
}

function getCachedSessionUser() {
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    const uid = storedSessionUid();
    if (!raw?.u || !uid || raw.u.uid !== uid || !(Date.now() - raw.at < USER_MAX_AGE)) return null;
    return raw.u;
  } catch {
    return null;
  }
}

/** Saved data on this device, from apps that open on it (lib/localCache.js), is someone's: drop it on sign-out. */
function forgetDeviceData(keepUid) {
  clearCacheExcept(keepUid);
  if (keepUid) return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i) || "";
      if (k.startsWith("mz_crm_role_v1:")) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function ensureLocalAccounts() {
  const users = getUsers();
  for (const adminEmail of ADMIN_EMAILS) {
    users[adminEmail] = { ...(users[adminEmail] || {}), name: users[adminEmail]?.name || "MovEazy Admin", role: "admin" };
  }
  saveUsers(users);
  return users;
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem("moveasy_users") || "{}"); } catch { return {}; }
}
function saveUsers(users) { localStorage.setItem("moveasy_users", JSON.stringify(users)); }
function getSellerRequests() {
  try { return JSON.parse(localStorage.getItem("moveasy_seller_requests") || "[]"); } catch { return []; }
}
function saveSellerRequests(r) { localStorage.setItem("moveasy_seller_requests", JSON.stringify(r)); }

function normalizeSellerBadgeStatus(value) {
  if (value === "verified") return "verified";
  if (value === "pending") return "pending";
  if (value === "rejected") return "rejected";
  return "none";
}

function isE2EAuthBypassEnabled() {
  return import.meta.env.MODE !== "production" && localStorage.getItem("moveasy_e2e_auth_bypass") === "1";
}

function getE2EVerifiedAccounts() {
  try { return JSON.parse(localStorage.getItem("moveasy_e2e_verified") || "{}"); } catch { return {}; }
}

function saveE2EVerifiedAccounts(value) {
  localStorage.setItem("moveasy_e2e_verified", JSON.stringify(value));
}

/**
 * Move a pre-signup lead onto the account that just appeared.
 *
 * Split between client and server on purpose. The preferences are written here
 * through saveUserRequirement, which already owns the prefs-to-columns mapping
 * and is covered by its own tests; duplicating it in PL/pgSQL would be a second
 * copy to keep in step. claim_lead_intake() does only the parts the browser
 * cannot: marking the lead claimed, pointing its CRM row at the new account so
 * the lead and the customer stop being two rows in the pipeline, and copying
 * the phone onto the profile.
 *
 * Safe to run on every sign-in — the server claims a lead once, and the
 * requirement write is skipped for anyone who already has one, so a returning
 * user's saved preferences are never overwritten by a stale browser snapshot.
 */
async function adoptLeadIntake(sbUser) {
  const lead = leadSnapshot();
  if (!lead?.prefs || !lead.completed) {
    // Nothing worth carrying over, but still tell the server: the phone and the
    // CRM link are worth claiming even from an abandoned questionnaire.
    await claimLead();
    return;
  }

  const existing = await fetchUserRequirement(sbUser.id).catch(() => null);
  if (!existing) {
    await saveUserRequirement(
      { uid: sbUser.id, email: sbUser.email, name: lead.name || "" },
      lead.prefs,
    );
  }
  await claimLead();
}

function buildUserFromProfile(sbUser, profile) {
  return {
    email: profile.email,
    role: profile.role || "customer",
    name: profile.name,
    phone: profile.phone || "",
    uid: profile.uid || sbUser.id,
    authProvider: getProviderLabel(sbUser),
    profileComplete: profile.profileComplete === true,
    sellerBadgeStatus: profile.sellerBadgeStatus ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedSessionUser());
  // Known on this device already: draw now, confirm in the background.
  const [loading, setLoading] = useState(() => isSupabaseConfigured && !getCachedSessionUser());
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [adminAllowed, setAdminAllowed] = useState(() => getCachedSessionUser()?.role === "admin");
  const [pendingSellerBadgeApplications, setPendingSellerBadgeApplications] = useState([]);

  const loadPendingSellerBadgeApplications = async () => {
    if (!isSupabaseConfigured) return;
    setPendingSellerBadgeApplications(await getPendingSellerBadgeApplicationsRemote());
  };

  // The account the session handler last ran for, and that run. Supabase
  // reports the same session more than once as a page opens (getSession, then
  // the listener's own start-up event) and again on every token refresh; each
  // used to run the whole chain below, so every app opened with its profile
  // fetched eight times over before anything could render.
  const handled = useRef({ uid: undefined, run: null });

  const handleSession = (session) => {
    setSupabaseSession(session);
    const uid = session?.user?.id ?? null;
    if (handled.current.uid === uid && handled.current.run) return handled.current.run;
    const run = runSession(session);
    handled.current = { uid, run };
    return run;
  };

  const runSession = async (session) => {
    const sbUser = session?.user || null;
    if (!sbUser || !isSessionAllowed(sbUser)) {
      setUser(null);
      setAdminAllowed(false);
      cacheSessionUser(null);
      forgetDeviceData(null);
      return;
    }
    // Somebody else's saved data never outlives a switch of account.
    forgetDeviceData(sbUser.id);
    // Best-effort repair/attribution steps — must never be able to block or
    // corrupt the real profile read below. They used to share handleSession's
    // one try/catch with getProfileForUser, so any transient failure here (a
    // rate limit, a cold start, a not-yet-applied migration column) skipped
    // the real read entirely and fell into the phone-less fallback further
    // down — which then got cached, so someone who'd already saved a phone
    // number was asked for it again on the next page load.
    //
    // They run beside the profile read now, not in front of it: they are a
    // returning user's no-ops, and waiting on them held every app on its
    // loading screen for several round trips.
    const repairs = (async () => {
      try { await ensureUserProfileDocuments(sbUser); } catch { /* best-effort */ }
      try {
        // Google sign-in never passes through signup(), so this is the only place
        // an OAuth account can be credited to the post that produced it. Ignores
        // anyone whose account is not minutes old, and never overwrites a source.
        // (Already self-protecting internally — wrapped again here too, so a
        // change to that function can't reopen the bug above.)
        await recordSignupAttribution(sbUser);
      } catch { /* best-effort */ }
      try {
        // Everything they told us before signing up now belongs to this account.
        // It happens here rather than in the login modal because Google sign-in
        // redirects the browser away: by the time they are back, anything
        // holding a callback is long gone, and this handler is the only thing
        // that survives the trip.
        //
        // Wrapped like its neighbours — an unclaimed lead is a nuisance, being
        // dropped into the phone-less fallback is a bug the visitor sees.
        await adoptLeadIntake(sbUser);
      } catch { /* best-effort */ }
    })();

    try {
      let profile = await getProfileForUser(sbUser);
      if (!String(profile.phone || "").trim()) {
        // A new account's number arrives with the repairs (the lead it gave
        // before signing up is claimed onto it) — wait for them and read again,
        // or the phone gate would ask for a number we already have.
        await repairs;
        profile = await getProfileForUser(sbUser);
      }
      const allowed = await isEmailAdminAllowed(profile.email);
      setAdminAllowed(allowed);
      const effectiveRole = allowed ? "admin" : (profile.role === "admin" ? "customer" : profile.role);
      const u = buildUserFromProfile(sbUser, { ...profile, role: effectiveRole });
      setUser(u);
      cacheSessionUser(u);
      if (u.role === "admin") loadPendingSellerBadgeApplications();
    } catch {
      const fallback = buildUserFromSupabase(sbUser);
      const allowed = await isEmailAdminAllowed(fallback.email).catch(() => false);
      setAdminAllowed(allowed);
      if (allowed) fallback.role = "admin";
      setUser(fallback);
      cacheSessionUser(fallback);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      ensureLocalAccounts();
      setLoading(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      handleSession(data?.session ?? null).finally(() => setLoading(false));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A refreshed token is the same person: keep the session current, but
      // don't re-read the profile and re-run the sign-in steps for it.
      if (event === "TOKEN_REFRESHED") { setSupabaseSession(session); return; }
      // A changed account (their email, say) is read again from scratch.
      if (event === "USER_UPDATED") handled.current = { uid: undefined, run: null };
      handleSession(session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const e = email.toLowerCase().trim();

    if (isE2EAuthBypassEnabled()) {
      const users = getUsers();
      const verified = getE2EVerifiedAccounts();
      if (!users[e]) return { success: false, error: "Invalid email or password." };
      if (!verified[e]) {
        return {
          success: false,
          error: "Please verify your email first. Check your inbox and spam for a message from Supabase / Google.",
          unverified: true,
        };
      }
      const u = { email: e, role: users[e].role || "customer", name: users[e].name || e.split("@")[0] };
      setUser(u);
      return { success: true, role: u.role };
    }

    if (!isSupabaseConfigured || !supabase) {
      const users = ensureLocalAccounts();
      const local = users[e];
      if (!local || local.password !== password) return { success: false, error: "Invalid email or password." };
      const u = { email: e, role: local.role || "customer", name: local.name || e.split("@")[0] };
      setUser(u);
      sessionStorage.setItem("moveasy_session_user", JSON.stringify(u));
      return { success: true, role: u.role };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
      if (error) return { success: false, error: normalizeSupabaseError(error) };
      const sbUser = data?.user;
      if (!sbUser) return { success: false, error: "Sign-in failed." };
      if (!isSessionAllowed(sbUser)) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: "Please verify your email first. Check your inbox and spam for a message from Supabase / Google.",
          unverified: true,
        };
      }
      await ensureUserProfileDocuments(sbUser);
      const profile = await getProfileForUser(sbUser);
      const allowed = await isEmailAdminAllowed(profile.email);
      setAdminAllowed(allowed);
      const effectiveRole = allowed ? "admin" : (profile.role === "admin" ? "customer" : profile.role);
      const u = buildUserFromProfile(sbUser, { ...profile, role: effectiveRole });
      setUser(u);
      const onboardingEmail = await triggerVerifiedOnboardingEmails({ profile: u });
      return {
        success: true,
        role: u.role,
        emailWarning: onboardingEmail.ok || onboardingEmail.alreadySent
          ? ""
          : onboardingEmail.error || "Welcome email is queued for retry.",
      };
    } catch (error) {
      return { success: false, error: normalizeSupabaseError(error) };
    }
  };

  const loginWithGoogle = async () => {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Google sign-in requires Supabase configuration." };
    }
    try {
      // Check the provider is actually enabled before redirecting, so a disabled
      // provider surfaces a clean in-app message instead of a raw Supabase error page.
      const settings = await getSupabaseAuthSettings();
      if (settings?.external && settings.external.google !== true) {
        return {
          success: false,
          error: "Google sign-in isn't enabled on this project yet. Enable it in Supabase → Authentication → Providers → Google (needs a Google OAuth Client ID & Secret).",
        };
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + window.location.pathname + window.location.search },
      });
      if (error) return { success: false, error: error.message };
      return { success: true }; // browser redirects to Google; caller should not act further
    } catch (error) {
      return { success: false, error: error.message || "Google sign-in failed." };
    }
  };

  const resendVerificationEmail = async (email) => {
    const e = email.toLowerCase().trim();
    if (isE2EAuthBypassEnabled()) {
      const verified = getE2EVerifiedAccounts();
      verified[e] = true;
      saveE2EVerifiedAccounts(verified);
      return { success: true, info: "We sent another verification email. Check spam if you do not see it." };
    }
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Supabase is not configured." };
    }
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: e });
      if (error) return { success: false, error: normalizeSupabaseError(error) };
      return { success: true, info: "We sent another verification email. Check spam if you do not see it." };
    } catch (error) {
      return { success: false, error: normalizeSupabaseError(error) };
    }
  };

  const forgotPassword = async (email) => {
    const e = String(email || "").toLowerCase().trim();
    if (!e) return { success: false, error: "Enter your email first." };
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Forgot password requires Supabase configuration." };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo: window.location.origin + "/login",
      });
      if (error) return { success: false, error: error.message };
      return { success: true, info: "Password reset email sent. Check inbox and spam." };
    } catch (error) {
      return { success: false, error: error.message || "Could not send reset email." };
    }
  };

  const signup = async (email, password, name, role = "customer", phone = "", searchProfile = null) => {
    const e = email.toLowerCase().trim();
    if (!isGmailAddress(e)) return { success: false, error: gmailSignupErrorMessage() };
    const users = getUsers();
    const normalizedRole = normalizeSignupRole(role);
    if (isE2EAuthBypassEnabled()) {
      if (users[e]) return { success: false, error: "Account already exists. Please login." };
      users[e] = {
        name: name || e.split("@")[0],
        role: normalizedRole,
        phone,
        sellerBadgeStatus: normalizedRole === "seller" || normalizedRole === "broker" ? "none" : undefined,
      };
      saveUsers(users);
      return {
        success: true,
        requiresVerification: true,
        info: "We sent a verification link to your email. Open it, then return here and sign in.",
      };
    }
    if (!isSupabaseConfigured || !supabase) {
      if (users[e]) return { success: false, error: "Account already exists. Please login." };
      users[e] = {
        name: name || e.split("@")[0],
        role: normalizedRole,
        phone,
        password,
        sellerBadgeStatus: normalizedRole === "seller" || normalizedRole === "broker" ? "none" : undefined,
      };
      saveUsers(users);
      const u = { email: e, role: normalizedRole, name: users[e].name };
      setUser(u);
      sessionStorage.setItem("moveasy_session_user", JSON.stringify(u));
      return { success: true, role: normalizedRole };
    }
    try {
      // The token also rides along in user_metadata, which needs no migration
      // and no session — so a signup that stops at "confirm your email" is still
      // attributable even if the profile write below finds nowhere to land.
      const signupToken = attributionToken();
      const { data, error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          data: {
            full_name: name || e.split("@")[0],
            role: normalizedRole,
            ...(signupToken ? { attribution_token: signupToken } : {}),
          },
        },
      });
      if (error) return { success: false, error: normalizeSupabaseError(error) };
      const sbUser = data?.user;
      if (!sbUser) return { success: false, error: "Sign-up failed." };
      await createProfileAfterSignup({ sbUser, name: name || e.split("@")[0], role: normalizedRole, phone });
      // force: this is unambiguously a signup, so don't make it prove the
      // account is new by its timestamp.
      await recordSignupAttribution(sbUser, { force: true });

      if (normalizedRole === "customer" && searchProfile && isSupabaseConfigured && sbUser.id) {
        try {
          await saveCustomerSearchProfile(sbUser.id, searchProfile);
        } catch {
          /* search profile is optional at signup */
        }
      }

      if (data.session === null) {
        return {
          success: true,
          requiresVerification: true,
          info: "We sent a verification link to your email. Open it, then return here and sign in.",
        };
      }

      const profile = await getProfileForUser(sbUser);
      const allowed = await isEmailAdminAllowed(profile.email);
      setAdminAllowed(allowed);
      const effectiveRole = allowed ? "admin" : (profile.role === "admin" ? "customer" : profile.role);
      const u = buildUserFromProfile(sbUser, { ...profile, role: effectiveRole });
      setUser(u);
      const onboardingEmail = await triggerVerifiedOnboardingEmails({ profile: u });
      return {
        success: true,
        role: u.role,
        emailWarning: onboardingEmail.ok || onboardingEmail.alreadySent
          ? ""
          : onboardingEmail.error || "Welcome email is queued for retry.",
      };
    } catch (error) {
      return { success: false, error: normalizeSupabaseError(error) };
    }
  };

  const getPendingSellerBadgeApplications = () => {
    if (isSupabaseConfigured) return pendingSellerBadgeApplications;
    const users = getUsers();
    return Object.entries(users)
      .filter(([, value]) => (value.role || "customer") === "seller" && normalizeSellerBadgeStatus(value.sellerBadgeStatus) === "pending")
      .map(([email, value]) => ({
        email,
        name: value.name || email.split("@")[0],
        application: value.sellerBadgeApplication || null,
      }));
  };

  const submitSellerBadgeApplication = async ({ phone, businessName, gst }) => {
    if (!user?.email) return { success: false, error: "Not signed in." };
    if (isSupabaseConfigured) {
      if (user.role !== "seller") return { success: false, error: "Only seller accounts can request a verified badge." };
      if (!String(phone || "").trim() || !String(businessName || "").trim()) return { success: false, error: "Business name and phone are required." };
      if (normalizeSellerBadgeStatus(user.sellerBadgeStatus) === "verified") return { success: false, error: "You are already verified." };
      try {
        await submitSellerBadgeApplicationRemote(user.uid, {
          phone: String(phone).trim(),
          businessName: String(businessName).trim(),
          gst: String(gst || "").trim(),
          submittedAt: new Date().toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message || "Failed to submit application." };
      }
    }
    const users = getUsers();
    const row = users[user.email];
    if (!row || (row.role || "customer") !== "seller") {
      return { success: false, error: "Only seller accounts can request a verified badge." };
    }
    if (normalizeSellerBadgeStatus(row.sellerBadgeStatus) === "verified") {
      return { success: false, error: "You are already verified." };
    }
    if (!String(phone || "").trim() || !String(businessName || "").trim()) {
      return { success: false, error: "Business name and phone are required." };
    }
    users[user.email] = {
      ...row,
      sellerBadgeStatus: "pending",
      sellerBadgeApplication: {
        phone: String(phone).trim(),
        businessName: String(businessName).trim(),
        gst: String(gst || "").trim(),
        submittedAt: new Date().toISOString(),
      },
    };
    saveUsers(users);
    return { success: true };
  };

  const updateUserProfile = async (name, phone, flatSearchMirror) => {
    if (!user?.uid) return { success: false, error: "Not signed in." };
    try {
      const trimmedName = String(name || "").trim();
      const trimmedPhone = String(phone || "").trim();
      await updateUserProfileFields(user.uid, {
        name: trimmedName,
        phone: trimmedPhone,
        flatSearch: flatSearchMirror || undefined,
      });
      // setUser alone left the sessionStorage snapshot stale — a page reload
      // right after saving could briefly start from that old, phone-less
      // cached value again.
      const next = { ...user, name: trimmedName, phone: trimmedPhone };
      setUser(next);
      cacheSessionUser(next);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || "Failed to save profile." };
    }
  };

  const approveSellerBadge = async (email) => {
    const e = String(email).toLowerCase().trim();
    if (isSupabaseConfigured) {
      const ok = await setSellerBadgeStatusForEmail(e, "verified");
      if (ok) await loadPendingSellerBadgeApplications();
      return ok;
    }
    const users = getUsers();
    if (!users[e]) return false;
    users[e] = {
      ...users[e],
      sellerBadgeStatus: "verified",
      sellerBadgeVerifiedAt: new Date().toISOString(),
    };
    saveUsers(users);
    return true;
  };

  const rejectSellerBadge = async (email) => {
    const e = String(email).toLowerCase().trim();
    if (isSupabaseConfigured) {
      const ok = await setSellerBadgeStatusForEmail(e, "rejected");
      if (ok) await loadPendingSellerBadgeApplications();
      return ok;
    }
    const users = getUsers();
    if (!users[e]) return false;
    users[e] = {
      ...users[e],
      sellerBadgeStatus: "rejected",
      sellerBadgeRejectedAt: new Date().toISOString(),
    };
    saveUsers(users);
    return true;
  };

  const requestSeller = () => {
    if (!user) return;
    const requests = getSellerRequests();
    if (requests.find((r) => r.email === user.email)) return;
    requests.push({ email: user.email, name: user.name, date: new Date().toISOString(), status: "pending" });
    saveSellerRequests(requests);
  };

  const approveSeller = async (email) => {
    const e = String(email).toLowerCase().trim();
    if (isSupabaseConfigured) {
      await setRoleForEmail(e, "seller");
      return;
    }
    const users = getUsers();
    if (users[e]) { users[e].role = "seller"; saveUsers(users); }
    const requests = getSellerRequests();
    saveSellerRequests(requests.map((r) => r.email === e ? { ...r, status: "approved" } : r));
  };

  const rejectSeller = (email) => {
    const e = String(email).toLowerCase().trim();
    const requests = getSellerRequests();
    saveSellerRequests(requests.map((r) => r.email === e ? { ...r, status: "rejected" } : r));
  };

  const logout = async () => {
    setUser(null);
    setAdminAllowed(false);
    cacheSessionUser(null);
    sessionStorage.removeItem("moveasy_session_user");
    if (isSupabaseConfigured && supabase) {
      try { await supabase.auth.signOut(); } catch { /* noop */ }
    }
  };

  const refreshRole = () => {
    if (!user) return;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        const sbUser = data?.session?.user;
        if (!sbUser) return undefined;
        return ensureUserProfileDocuments(sbUser)
          .then(() => getProfileForUser(sbUser))
          .then((profile) => {
            const allowedPromise = isEmailAdminAllowed(profile.email);
            return allowedPromise.then((allowed) => {
              setAdminAllowed(allowed);
              const effectiveRole = allowed ? "admin" : (profile.role === "admin" ? "customer" : profile.role);
              setUser(buildUserFromProfile(sbUser, { ...profile, role: effectiveRole }));
            });
          });
      }).catch(() => undefined);
      return;
    }
    const users = getUsers();
    const u = users[user.email];
    if (u && u.role !== user.role) {
      const updated = { ...user, role: u.role };
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      adminAllowed,
      supabaseSession,
      isSupabaseConfigured,
      login,
      loginWithGoogle,
      // aliases kept for pages built directly against the Supabase-native API
      loginWithSupabase: login,
      signupWithSupabase: signup,
      loginWithSupabaseGoogle: loginWithGoogle,
      forgotPasswordSupabase: forgotPassword,
      signup,
      forgotPassword,
      resendVerificationEmail,
      logout,
      requestSeller,
      approveSeller,
      rejectSeller,
      refreshRole,
      updateUserProfile,
      getSellerRequests,
      getPendingSellerBadgeApplications,
      submitSellerBadgeApplication,
      approveSellerBadge,
      rejectSellerBadge,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
