/**
 * Once someone signs in with a mobile number, the partner flats they opened on
 * this phone in the last week (before signing in) become those partners'
 * website leads (lib/websiteLeads.js, partner_website_leads.sql). Renders nothing.
 */
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { claimEarlierViews } from "../lib/websiteLeads";

export default function ClaimEarlierViews() {
  const { user } = useAuth();
  const uid = user?.uid || user?.id || "";
  const hasPhone = Boolean(String(user?.phone || "").trim());
  useEffect(() => {
    if (uid && hasPhone) void claimEarlierViews(uid);
  }, [uid, hasPhone]);
  return null;
}
