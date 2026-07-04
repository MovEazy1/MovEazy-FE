import { createContext, useContext, useState, useEffect } from "react";
import { gmailSignupErrorMessage, isGmailAddress } from "../lib/emailPolicy";
import { triggerVerifiedOnboardingEmails } from "../lib/emailService";
import {
  createProfileAfterSignup,
  ensureUserProfileDocuments,
  getPendingSellerBadgeApplicationsRemote,
  getProfileForUser,
  normalizeSignupRole,
  setRoleForEmail,
  setSellerBadgeStatusForEmail,
  submitSellerBadgeApplicationRemote,
  updateUserProfileFields,
} from "../lib/profileService";
import { saveCustomerSearchProfile } from "../lib/customerSearchProfile";
import { isEmailAdminAllowed, getEnvAdminEmails } from "../lib/adminAccess";
import { supabase, isSupabaseConfigured, normalizeSupabaseError } from "../lib/supabase";

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
  const role = ADMIN_EMAILS.includes(email) ? "admin" : (roleCandidate === "seller" || roleCandidate === "broker" ? roleCandidate : "customer");
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

function cacheSessionUser(u) {
  if (!u) {
    sessionStorage.removeItem("moveasy_session_user");
    return;
  }
  try {
    sessionStorage.setItem("moveasy_session_user", JSON.stringify(u));
  } catch {
    /* ignore quota errors */
  }
}

function getCachedSessionUser() {
  try {
    const cached = sessionStorage.getItem("moveasy_session_user");
    return cached ? JSON.parse(cached) : null;
  } catch {
    sessionStorage.removeItem("moveasy_session_user");
    return null;
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
  const [loading, setLoading] = useState(() => isSupabaseConfigured);
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [adminAllowed, setAdminAllowed] = useState(false);
  const [pendingSellerBadgeApplications, setPendingSellerBadgeApplications] = useState([]);

  const loadPendingSellerBadgeApplications = async () => {
    if (!isSupabaseConfigured) return;
    setPendingSellerBadgeApplications(await getPendingSellerBadgeApplicationsRemote());
  };

  const handleSession = async (session) => {
    setSupabaseSession(session);
    const sbUser = session?.user || null;
    if (!sbUser || !isSessionAllowed(sbUser)) {
      setUser(null);
      setAdminAllowed(false);
      cacheSessionUser(null);
      return;
    }
    try {
      await ensureUserProfileDocuments(sbUser);
      const profile = await getProfileForUser(sbUser);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      const { data, error } = await supabase.auth.signUp({
        email: e,
        password,
        options: { data: { full_name: name || e.split("@")[0], role: normalizedRole } },
      });
      if (error) return { success: false, error: normalizeSupabaseError(error) };
      const sbUser = data?.user;
      if (!sbUser) return { success: false, error: "Sign-up failed." };
      await createProfileAfterSignup({ sbUser, name: name || e.split("@")[0], role: normalizedRole, phone });

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
      setUser(prev => ({ ...prev, name: trimmedName, phone: trimmedPhone }));
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
