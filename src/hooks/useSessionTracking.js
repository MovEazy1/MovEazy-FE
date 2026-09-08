import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sessionTracker } from "../lib/sessionTracking";
import { identifySession, startSessionSync } from "../lib/sessionSync";
import { recordShareOpenFromUrl } from "../lib/shareAttribution";
import { useAuth } from "../context/AuthContext";

export function useSessionTracking() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Track page change
    sessionTracker.trackPageChange(location.pathname);
  }, [location]);

  useEffect(() => {
    // Update user info when they login
    if (user) {
      sessionTracker.setUser(user.uid, user.role);
    }
    // Sessions are also written to Supabase (public.user_sessions) so the CRM
    // can sort clients by opens and time on site — browser storage alone never
    // reaches us.
    identifySession(user);
  }, [user]);

  useEffect(() => startSessionSync(), []);

  // A link shared from the CRM carries mz_s; tell the CRM it was opened.
  useEffect(() => { recordShareOpenFromUrl(); }, []);

  return sessionTracker;
}
