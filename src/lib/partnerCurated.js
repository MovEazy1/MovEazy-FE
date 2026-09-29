/**
 * A broker's curated lists for their tenants, the tenant's swipes, broker
 * notifications, sold-out flags, and the CRM's view of broker-sourced tenants.
 * The rules live in MovEazy-BE/supabase/partner_launch.sql § 8–9.
 *
 * Separate from MovEazy's own curated shares (lib/crmCurated*, /curated/:token):
 * a broker's list lives at /c/<token> and its tenants never become MovEazy leads.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { PUBLIC_ORIGIN } from "./partners";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const curatedUrl = (token) => `${PUBLIC_ORIGIN}/c/${token}`;

export function curatedMessage(token, { leadName = "", count = 0, brokerName = "" } = {}) {
  const first = String(leadName || "").trim().split(/\s+/)[0];
  return `Hi${first ? ` ${first}` : ""}, I've picked ${count || "a few"} home${count === 1 ? "" : "s"} for you. `
    + `Swipe through them and tap ♥ on the ones you like — I'll set up the visits.\n${curatedUrl(token)}`
    + `${brokerName ? `\n— ${brokerName}` : ""}`;
}

/* Broker */
export const createCuratedList = (leadId, propertyIds) =>
  rpc("partner_curated_create", { p_lead: leadId || null, p_properties: propertyIds });
export const fetchMyCuratedLists = () => rpc("partner_curated_mine").then((r) => r ?? []);
export const fetchNotifications = () => rpc("partner_notifications_list");
export const markNotificationsRead = () => rpc("partner_notifications_read").catch(() => {});
export const markSoldOut = (propertyId, note = "") => rpc("partner_mark_sold_out", { p_property: propertyId, p_note: note });
export const decideSoldOut = (propertyId, approve) => rpc("partner_decide_sold_out", { p_property: propertyId, p_approve: approve });

/* Tenant (signed out) */
export const openCuratedList = (token) => rpc("partner_curated_open", { p_token: token });
export const giveCuratedContact = (token, phone, name = "") => rpc("partner_curated_contact", { p_token: token, p_phone: phone, p_name: name });
export const actOnCurated = (token, propertyId, action) => rpc("partner_curated_act", { p_token: token, p_property: propertyId, p_action: action });

/* CRM */
export const fetchBrokerLeads = () => rpc("crm_broker_leads");
export const fetchSoldOutRequests = () => rpc("crm_soldout_requests").then((r) => r ?? []);
