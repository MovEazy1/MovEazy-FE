import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sessionTracker } from "../lib/sessionTracking";
import { identifySession, startSessionSync } from "../lib/sessionSync";
import { recordShareOpenFromUrl } from "../lib/shareAttribution";
import { recordMarketingClickFromUrl } from "../lib/marketingClicks";
import { captureAttribution } from "../lib/attribution";
import { useAuth } from "../context/AuthContext";
import { startAppAnalytics, trackScreen } from "../lib/appAnalytics";

export function useSessionTracking() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    // Track page change
    sessionTracker.trackPageChange(location.pathname);
    // In the partner and owner apps, each screen opened is part of the session's timeline.
    trackScreen(location.pathname);
  }, [location]);

  // Partner and owner apps: every button pressed, for the CRM's App analytics.
  useEffect(() => startAppAnalytics(), []);

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

  // A link from a tracked marketing channel carries utm_campaign. Most people
  // who tap one never sign up, so this arrival is the only trace they leave —
  // count it now or lose it.
  useEffect(() => { recordMarketingClickFromUrl(); }, []);

  // Remember where this visitor came from before the UTM parameters fall off
  // the address bar. Signup reads it back; without this, everyone who browses
  // first and registers later is recorded as having arrived out of nowhere.
  // Mount only: /p/:id redirects with a real page load, so the parameters are
  // present here, and re-running per route would inflate the touch count.
  useEffect(() => { captureAttribution(); }, []);

  return sessionTracker;
}
