/**
 * MovEazy Partners — the broker app.
 *
 * Served at partners.moveazy.co.in (root) and at moveazy.co.in/partners, from
 * the same bundle as the customer site. Inventory is the home screen; the +
 * creates a Property or a Lead; WhatsApp is always an external hand-off.
 *
 * The gate, in order:
 *   signed out            → sign in with Google (the join page shows who invited you)
 *   no mobile on file     → the site-wide RequirePhoneModal asks for it
 *   not yet a partner     → registered automatically (partner_register)
 *   pending               → a holding screen, until the CRM approves
 *                           (auto-approve is on by default, so usually never)
 *   approved, or staff    → the app
 * An invite opened before sign-in is remembered and redeemed once the gate
 * clears, so "tap link → Google → number → you're in the group" is one flow.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Clock, ShieldOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  acceptInvite, fetchLeads, fetchMyGroups, fetchPartnerInventory, fetchPartnerMe, fetchSavedIds, friendlyError,
  pp, registerPartner, toggleSaved,
} from "../../lib/partners";
import { MOVEAZY_TEAM_WHATSAPP } from "../../config/contactChannels";
import { BottomNav, CreateSheet, Loading, PartnerStyles, ToastHost, WhatsAppIcon, toast } from "./partnerUi";
import PartnerWelcome from "./PartnerWelcome";

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
const SavedPage = lazy(() => import("./SavedPage"));
const JoinPage = lazy(() => import("./JoinPage"));

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
function PartnerWorkspace({ me, reloadMe }) {
  const navigate = useNavigate();
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
    reloadGroups();
    reloadLeads();
    fetchSavedIds().then(setSaved);
  }, [reloadInventory, reloadGroups, reloadLeads]);

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
    saved, toggleSave, ui, setUi,
  }), [me, reloadMe, inventory, invError, reloadInventory, byId, groups, reloadGroups, leads, reloadLeads, saved,
    toggleSave, ui, setUi]);

  return (
    <PartnerContext.Provider value={value}>
      <div className="pz-col">
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
            <Route path="saved" element={<SavedPage />} />
            <Route path="*" element={<Navigate to={pp("/")} replace />} />
          </Routes>
        </Suspense>
        <BottomNav onPlus={() => setPlusOpen(true)} />
        {plusOpen && <CreateSheet onClose={() => setPlusOpen(false)} />}
      </div>
    </PartnerContext.Provider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | need_phone | ready | error
  const [error, setError] = useState("");

  const hasPhone = Boolean(String(user?.phone || "").trim());

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      let m = await fetchPartnerMe();
      if (!m?.partner) {
        await registerPartner({ name: user?.name });
        m = await fetchPartnerMe();
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
  if (!user) return <PartnerWelcome />;
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
