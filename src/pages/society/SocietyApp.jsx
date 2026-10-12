/**
 * MovEazy Society — for society managers, guards and staff.
 *
 * Served at society.moveazy.co.in (root) and at moveazy.co.in/society, from
 * the same bundle as the site. The gate, in order:
 *   signed out          → splash, then mobile number + Google (no SMS OTP:
 *                         the number is saved to the account after Google)
 *   an invite link       → remembered through sign-in, then accepted
 *   no society yet       → set one up (the manager), or ask for an invite
 *   in a society         → Home · Flats · Earnings · Members; a society
 *                         waiting for MovEazy's approval says so, and works
 * Rules: MovEazy-BE/supabase/society_app.sql.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { acceptSocietyInvite, fetchSocietyMe, societyError, societyTick, sp } from "../../lib/society";
import { BottomNav, Loading, SocietyStyles, ToastHost, toast } from "./societyUi";
import { clearPendingSocietyPhone, pendingInvite, pendingSocietyPhone, rememberInvite, forgetInvite } from "./societySignup";

const Welcome = lazy(() => import("./Welcome"));
const Setup = lazy(() => import("./Setup"));
const Home = lazy(() => import("./Home"));
const AddFlat = lazy(() => import("./AddFlat"));
const FlatsList = lazy(() => import("./FlatsList"));
const FlatDetail = lazy(() => import("./FlatDetail"));
const Members = lazy(() => import("./Members"));
const Invite = lazy(() => import("./Invite"));
const Earnings = lazy(() => import("./Earnings"));
const EarningsHistory = lazy(() => import("./Earnings").then((m) => ({ default: m.EarningsHistory })));
const UpiSetup = lazy(() => import("./UpiSetup"));
const Profile = lazy(() => import("./Profile"));
const Notifications = lazy(() => import("./Notifications"));
const JoinPage = lazy(() => import("./Join"));

const SocietyContext = createContext(null);
export const useSociety = () => useContext(SocietyContext);

function Workspace({ me, reload }) {
  const { pathname } = useLocation();
  const rel = pathname.replace(/^\/society/, "") || "/";
  const showNav = ["/", "/flats", "/earnings", "/members"].includes(rel);
  // Move-out reminders and the like: whenever the app opens.
  useEffect(() => { societyTick().then((n) => { if (n > 0) reload(); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SocietyContext.Provider value={{ me, society: me.society, member: me.member, reload }}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="flats" element={<FlatsList />} />
          <Route path="flats/new" element={<AddFlat />} />
          <Route path="flats/:id" element={<FlatDetail />} />
          <Route path="flats/:id/edit" element={<AddFlat />} />
          <Route path="members" element={<Members />} />
          <Route path="invite" element={<Invite />} />
          <Route path="earnings" element={<Earnings />} />
          <Route path="earnings/history" element={<EarningsHistory />} />
          <Route path="upi" element={<UpiSetup />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="setup" element={me.member.role === "manager" ? <Setup editing /> : <Navigate to={sp("/")} replace />} />
          <Route path="*" element={<Navigate to={sp("/")} replace />} />
        </Routes>
      </Suspense>
      {showNav && <BottomNav />}
    </SocietyContext.Provider>
  );
}

function Gate() {
  const { user, loading, updateUserProfile } = useAuth();
  const [me, setMe] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const applying = useRef(false);
  const hasPhone = Boolean(String(user?.phone || "").trim());

  // Back from Google: the number typed before it is the account's.
  useEffect(() => {
    if (loading || !user?.uid) return;
    if (hasPhone) { clearPendingSocietyPhone(); return; }
    const phone = pendingSocietyPhone();
    if (!phone || applying.current) return;
    applying.current = true;
    updateUserProfile(user.name || "", phone).then((r) => {
      if (r?.success) clearPendingSocietyPhone();
      else applying.current = false;
    });
  }, [loading, user?.uid, user?.name, hasPhone, updateUserProfile]);

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? s : "loading"));
    try {
      let m = await fetchSocietyMe();
      const token = pendingInvite();
      if (token) {
        try {
          const r = await acceptSocietyInvite(token, user?.name || "");
          if (r?.joined) toast("Welcome! You've joined your society.");
          m = await fetchSocietyMe();
        } catch (e) {
          toast(societyError(e), "error");
        } finally {
          forgetInvite();
        }
      }
      setMe(m);
      setState("ready");
    } catch (e) {
      setError(societyError(e, "Couldn't open MovEazy Society."));
      setState("error");
    }
  }, [user?.name]);

  useEffect(() => {
    if (!loading && user?.uid && hasPhone) load();
  }, [loading, user?.uid, hasPhone, load]);

  if (loading) return <Loading label="Opening MovEazy Society…" />;
  if (!user) return <Welcome />;
  if (!hasPhone) return <Loading label="Saving your mobile number…" />; // RequirePhoneModal asks if none was typed
  if (state === "error") {
    return (
      <div className="sx-col" style={{ paddingTop: 80, textAlign: "center" }}>
        <p style={{ fontWeight: 700 }}>{error}</p>
        <button type="button" className="sx-btn" style={{ marginTop: 16 }} onClick={load}>Try again</button>
      </div>
    );
  }
  if (state !== "ready" || !me) return <Loading label="Opening MovEazy Society…" />;
  if (!me.member) return <Setup onDone={load} />;
  return <Workspace me={me} reload={load} />;
}

/** /join/:token — remembered, then the gate signs them in and accepts it. */
function JoinRoute() {
  const { token = "" } = useParams();
  useEffect(() => { if (token) rememberInvite(token); }, [token]);
  return <JoinPage token={token} />;
}

export default function SocietyApp() {
  useEffect(() => {
    const was = document.title;
    document.title = "MovEazy Society";
    return () => { document.title = was; };
  }, []);
  return (
    <div className="sx">
      <SocietyStyles />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="join/:token" element={<JoinRoute />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </Suspense>
      <ToastHost />
    </div>
  );
}
