import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sessionTracker } from "../lib/sessionTracking";
import { identifySession, startSessionSync } from "../lib/sessionSync";
import { recordShareOpenFromUrl } from "../lib/shareAttribution";
import { captureAttribution } from "../lib/attribution";
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

  // Remember where this visitor came from before the UTM parameters fall off
  // the address bar. Signup reads it back; without this, everyone who browses
  // first and registers later is recorded as having arrived out of nowhere.
  // Mount only: /p/:id redirects with a real page load, so the parameters are
  // present here, and re-running per route would inflate the touch count.
  useEffect(() => { captureAttribution(); }, []);

  return sessionTracker;
}
