import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { sessionTracker } from "../lib/sessionTracking";
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
  }, [user]);

  return sessionTracker;
}
