/**
 * MovEazy Partners — the broker app.
 *
 * Served at partners.moveazy.co.in (root) and at moveazy.co.in/partners, from
 * the same bundle as the customer site. Inventory is the home screen; the +
 * creates a Property or a Lead; WhatsApp is always an external hand-off.
 *
 * The gate, in order:
 *   signed out            → the landing page; "Become Partner" takes the mobile
 *                           number first, then Google (lib/partnerSignup.js)
 *   no mobile on file     → the number from Become Partner is saved to the
 *                           account; otherwise the site-wide RequirePhoneModal asks
 *   not yet a partner     → registered automatically (partner_register)
 *   pending               → a holding screen, until the CRM approves
 *                           (auto-approve is on by default, so usually never)
 *   approved, or staff    → the app
 * An invite opened before sign-in is remembered and redeemed once the gate
 * clears, so "tap link → Google → number → you're in the group" is one flow.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Clock, ShieldOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  acceptInvite, fetchLeads, fetchMyGroups, fetchPartnerInventory, fetchPartnerMe, fetchSavedIds, friendlyError,
  hasPremium, pp, registerPartner, toggleSaved,
} from "../../lib/partners";
import { claimCrmListings, fetchPartnerStatus } from "../../lib/partnerPlans";
import { JoinPremiumBar, PremiumExplainer } from "./demoMode";
import { useUnreadCount } from "./PartnerInbox";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { clearPendingSignup, pendingSignupPhone, stampPartnerSignup } from "../../lib/partnerSignup";
import { BottomNav, CreateSheet, Loading, PartnerStyles, ToastHost, WhatsAppIcon, toast } from "./partnerUi";
import PartnerLanding from "./PartnerLanding";

const InventoryHome = lazy(() => import("./InventoryHome"));
const PropertyDetail = lazy(() => import("./PropertyDetail"));
const PropertyContacts = lazy(() => import("./PropertyContacts"));
const AddProperty = lazy(() => import("./AddProperty"));
const EditSharing = lazy(() => import("./EditSharing"));
const LeadsList = lazy(() => import("./LeadsList"));
const LeadForm = lazy(() => import("./LeadForm"));
const LeadDetail = lazy(() => import("./LeadDetail"));
const LeadMatches = lazy(() => import("./LeadMatches"));
const GroupsList = lazy(() => import("./GroupsList"));
const GroupDetail = lazy(() => import("./GroupDetail"));
const MorePage = lazy(() => import("./MorePage"));
const PremiumPage = lazy(() => import("./PremiumPage"));
const MyQrPage = lazy(() => import("./MyQrPage"));
const SavedPage = lazy(() => import("./SavedPage"));
const JoinPage = lazy(() => import("./JoinPage"));
const PaymentReturn = lazy(() => import("./PremiumJourney").then((m) => ({ default: m.PaymentReturn })));
const WelcomePremium = lazy(() => import("./PremiumJourney").then((m) => ({ default: m.WelcomePremium })));
const ReferralsPage = lazy(() => import("./PremiumJourney").then((m) => ({ default: m.ReferralsPage })));
const SalesFunnel = lazy(() => import("./SalesFunnel"));
const AiMatcher = lazy(() => import("./AiMatcher"));
const Insights = lazy(() => import("./Insights"));
const BuildingLeads = lazy(() => import("./BuildingLeads"));
const NotificationsPage = lazy(() => import("./PartnerInbox").then((m) => ({ default: m.NotificationsPage })));
const CuratedListPage = lazy(() => import("./PartnerInbox").then((m) => ({ default: m.CuratedListPage })));

const PartnerContext = createContext(null);
export const usePartner = () => useContext(PartnerContext);

export const INVITE_KEY = "mz_partner_invite";
const UI_KEY = "mz_partner_ui";

function readUi() {
  try {
    return JSON.parse(sessionStorage.getItem(UI_KEY) || "null") || {};
  } catch {
    return {};
  }
}

function Holding({ icon, title, children }) {
  return (
    <div className="pz-center">
      <div style={{ maxWidth: 380 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--gl)", color: "var(--g)", display: "grid",
          placeItems: "center", margin: "0 auto 16px" }}>{icon}</div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{title}</h1>
        <div style={{ color: "var(--dim)", fontSize: 15, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
}

function teamWa(text) {
  return `${MOVEAZY_TEAM_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

/** Everything after the gate: shared data, nav, routes. */
// Screens where the sticky Join Premium button would be in the way.
const NO_BAR = /^\/(premium|welcome|referrals|add|leads\/new|leads\/[^/]+\/edit|property\/[^/]+\/(sharing|contacts))/;

function PartnerWorkspace({ me, reloadMe }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [status, setStatus] = useState(null);
  const [explaining, setExplaining] = useState(null);
  // No plan, not staff: the app runs on sample data and premium buttons explain themselves.
  // Staff can preview that with ?demo=1 (and turn it off with ?demo=0) — remembered on this device.
  const [previewDemo] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("demo");
      if (q === "1" || q === "0") localStorage.setItem("mz_demo_preview", q);
      return localStorage.getItem("mz_demo_preview") === "1";
    } catch {
      return false;
    }
  });
  const demo = me?.staff ? previewDemo : !hasPremium(me);
  const explain = useCallback((what) => setExplaining(what), []);
  const unread = useUnreadCount(!demo);
  const reloadStatus = useCallback(async () => {
    try { setStatus(await fetchPartnerStatus()); } catch { /* keep what we had */ }
  }, []);
  const [inventory, setInventory] = useState(null);
  const [invError, setInvError] = useState("");
  const [groups, setGroups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [saved, setSaved] = useState(() => new Set());
  const [plusOpen, setPlusOpen] = useState(false);
  const [ui, setUiState] = useState(() => ({ source: "moveazy", q: "", filters: null, scrollY: 0, ...readUi() }));

  const setUi = useCallback((patch) => {
    setUiState((cur) => {
      const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
      try { sessionStorage.setItem(UI_KEY, JSON.stringify(next)); } catch { /* private tab */ }
      return next;
    });
  }, []);

  const reloadInventory = useCallback(async () => {
    try {
      setInventory(await fetchPartnerInventory());
      setInvError("");
    } catch (e) {
      setInvError(friendlyError(e, "Could not load inventory."));
      setInventory((cur) => cur ?? []);
    }
  }, []);
  const reloadGroups = useCallback(async () => {
    try { setGroups(await fetchMyGroups()); } catch { /* keep what we had */ }
  }, []);
  const reloadLeads = useCallback(async () => {
    try { setLeads(await fetchLeads()); } catch { /* keep what we had */ }
  }, []);

  useEffect(() => {
    reloadInventory();
    // Anything the MovEazy team added for this broker since last time.
    claimCrmListings().then((n) => { if (n > 0) reloadInventory(); });
    reloadGroups();
    reloadLeads();
    reloadStatus();
    fetchSavedIds().then(setSaved);
  }, [reloadInventory, reloadGroups, reloadLeads, reloadStatus]);

  // A plan just started: the congratulations page, once.
  const rel = pathname.slice(pp("/").replace(/\/$/, "").length) || "/";
  useEffect(() => {
    if (status?.congrats_due && !rel.startsWith("/welcome") && !rel.startsWith("/premium/return")) navigate(pp("/welcome"));
  }, [status?.congrats_due, rel, navigate]);

  // An invite opened before sign-in is redeemed here, once.
  const redeemed = useRef(false);
  useEffect(() => {
    if (redeemed.current) return;
    let token = "";
    try { token = sessionStorage.getItem(INVITE_KEY) || ""; } catch { /* ignore */ }
    if (!token) return;
    redeemed.current = true;
    (async () => {
      try {
        const gid = await acceptInvite(token);
        toast("You're in the group");
        await Promise.all([reloadGroups(), reloadInventory()]);
        navigate(pp(`/groups/${gid}`), { replace: true });
      } catch (e) {
        toast(friendlyError(e, "Could not join that group."), "error");
      } finally {
        try { sessionStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
      }
    })();
  }, [navigate, reloadGroups, reloadInventory]);

  const toggleSave = useCallback(async (propertyId) => {
    const on = !saved.has(propertyId);
    setSaved((s) => { const n = new Set(s); if (on) n.add(propertyId); else n.delete(propertyId); return n; });
    try {
      await toggleSaved(propertyId, on);
    } catch {
      setSaved((s) => { const n = new Set(s); if (on) n.delete(propertyId); else n.add(propertyId); return n; });
      toast("Could not save that", "error");
    }
  }, [saved]);

  const byId = useMemo(() => new Map((inventory ?? []).map((l) => [l.property_id, l])), [inventory]);

  const value = useMemo(() => ({
    me, reloadMe, inventory, invError, reloadInventory, byId, groups, reloadGroups, leads, setLeads, reloadLeads,
    saved, toggleSave, ui, setUi, status, reloadStatus, demo, explain, unread,
  }), [me, reloadMe, inventory, invError, reloadInventory, byId, groups, reloadGroups, leads, reloadLeads, saved,
    toggleSave, ui, setUi, status, reloadStatus, demo, explain, unread]);
  const showBar = demo && !NO_BAR.test(rel);

  return (
    <PartnerContext.Provider value={value}>
      <div className="pz-col" style={showBar ? { paddingBottom: "calc(140px + env(safe-area-inset-bottom))" } : undefined}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route index element={<InventoryHome />} />
            <Route path="property/:id" element={<PropertyDetail />} />
            <Route path="property/:id/contacts" element={<PropertyContacts />} />
            <Route path="property/:id/sharing" element={<EditSharing />} />
            <Route path="add/property" element={<AddProperty />} />
            <Route path="leads" element={<LeadsList />} />
            <Route path="leads/new" element={<LeadForm />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="leads/:id/edit" element={<LeadForm />} />
            <Route path="leads/:id/matches" element={<LeadMatches />} />
            <Route path="groups" element={<GroupsList />} />
            <Route path="groups/:id" element={<GroupDetail />} />
            <Route path="more" element={<MorePage />} />
            <Route path="premium" element={<PremiumPage />} />
            <Route path="premium/return" element={<PaymentReturn />} />
            <Route path="welcome" element={<WelcomePremium />} />
            <Route path="referrals" element={<ReferralsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="ai-matcher" element={<AiMatcher />} />
            <Route path="insights" element={<Insights />} />
            <Route path="building-leads" element={<BuildingLeads />} />
            <Route path="curated/:id" element={<CuratedListPage />} />
            <Route path="qr" element={<MyQrPage />} />
            <Route path="saved" element={<SavedPage />} />
            <Route path="*" element={<Navigate to={pp("/")} replace />} />
          </Routes>
        </Suspense>
        {/* Posting a flat is one focused screen with its own Publish bar. */}
        {!rel.startsWith("/welcome") && !rel.startsWith("/add/") && <BottomNav onPlus={() => setPlusOpen(true)} />}
        {showBar && <JoinPremiumBar />}
        {plusOpen && <CreateSheet onClose={() => setPlusOpen(false)} />}
        <PremiumExplainer what={explaining} onClose={() => setExplaining(null)} />
      </div>
    </PartnerContext.Provider>
  );
}

function Gate() {
  const { user, loading, updateUserProfile } = useAuth();
  const [me, setMe] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | need_phone | ready | error
  const [error, setError] = useState("");

  const hasPhone = Boolean(String(user?.phone || "").trim());
  const stamped = useRef(false);
  const applying = useRef(false);

  // Back from Google after "Become Partner": the number they gave is the account's.
  useEffect(() => {
    if (loading || !user?.uid) return;
    if (hasPhone) { clearPendingSignup(); return; }
    const phone = pendingSignupPhone();
    if (!phone || applying.current) return;
    applying.current = true;
    updateUserProfile(user.name || "", phone).then((r) => {
      if (r?.success) clearPendingSignup();
      else applying.current = false;
    });
  }, [loading, user?.uid, user?.name, hasPhone, updateUserProfile]);

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      let m = await fetchPartnerMe();
      if (!m?.partner) {
        await registerPartner({ name: user?.name });
        m = await fetchPartnerMe();
      }
      if (!stamped.current) {
        stamped.current = true;
        await stampPartnerSignup();
      }
      setMe(m);
      setState("ready");
    } catch (e) {
      if (e?.code === "22023" && /mobile/i.test(e?.message || "")) {
        setState("need_phone");
        return;
      }
      setError(friendlyError(e, "Could not open the partner app."));
      setState("error");
    }
  }, [user?.name]);

  useEffect(() => {
    if (!loading && user?.uid && hasPhone) load();
  }, [loading, user?.uid, hasPhone, load]);

  if (loading) return <Loading label="Opening MovEazy Partners…" />;
  // Signed-out visitors get the landing page; its sign-up returns here.
  if (!user) return <PartnerLanding />;
  if (!hasPhone || state === "need_phone") {
    // RequirePhoneModal (mounted app-wide) is open over this.
    return <Holding icon={<Clock size={28} />} title="Verify your mobile number">One step left — add the number clients and brokers reach you on.</Holding>;
  }
  if (state === "error") {
    return (
      <Holding icon={<ShieldOff size={28} />} title="Something went wrong">
        {error}
        <div style={{ marginTop: 16 }}><button type="button" className="pz-btn pz-btn--primary" onClick={load}>Try again</button></div>
      </Holding>
    );
  }
  if (state !== "ready" || !me) return <Loading label="Opening MovEazy Partners…" />;

  const status = me.partner?.status;
  if (!me.staff && status === "suspended") {
    return (
      <Holding icon={<ShieldOff size={28} />} title="Access paused">
        Your partner access has been paused. Message the MovEazy team if you think this is a mistake.
        <div style={{ marginTop: 16 }}>
          <a className="pz-btn pz-btn--primary" href={teamWa(`Hi, my MovEazy Partners access (${user.email}) is paused. Can you help?`)}
            target="_blank" rel="noreferrer"><WhatsAppIcon /> Message MovEazy</a>
        </div>
      </Holding>
    );
  }
  if (!me.staff && status !== "approved") {
    return (
      <Holding icon={<Clock size={28} />} title="Your access is pending">
        Thanks, {me.partner?.name?.split(" ")[0] || "there"} — the MovEazy team is reviewing your partner account.
        You'll get access as soon as it's approved.
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="pz-btn" onClick={load}>Check again</button>
          <a className="pz-btn pz-btn--primary" href={teamWa(`Hi, I've signed up for MovEazy Partners (${user.email}). Please approve my access.`)}
            target="_blank" rel="noreferrer"><WhatsAppIcon /> Message MovEazy</a>
        </div>
      </Holding>
    );
  }
  return <PartnerWorkspace me={me} reloadMe={load} />;
}

export default function PartnerApp() {
  return (
    <div className="pz">
      <PartnerStyles />
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* The join page renders before the gate so a signed-out invitee sees who invited them. */}
          <Route path="join/:token" element={<JoinGate />} />
          {/* Internal: the broker sales funnel, for MovEazy staff. */}
          <Route path="sales-funnel/*" element={<SalesFunnel />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </Suspense>
      <ToastHost />
    </div>
  );
}

/** Remembers the token, then hands over to the gate (which redeems it). */
function JoinGate() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <div className="pz-col"><JoinPage /></div>;
  return <JoinPage redirectWhenReady />;
}
