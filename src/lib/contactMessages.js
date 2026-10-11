/**
 * The website's contact form → the CRM (site_contact_messages.sql).
 * Anyone sends; CRM staff read and clear them under Notifications → Messages.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(name, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected — please WhatsApp us instead.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export const CONTACT_TOPICS = [
  ["tenant", "I'm looking for a flat"],
  ["owner", "I own a flat"],
  ["partner", "I'm a broker / partner"],
  ["payment", "A payment or refund"],
  ["other", "Something else"],
];

export const submitContactMessage = ({ name, phone, email = "", topic = "other", message }) =>
  rpc("submit_contact_message", { p_name: name, p_phone: phone, p_email: email, p_topic: topic, p_message: message });

export const crmContactMessages = (status = "new") =>
  rpc("crm_contact_messages", { p_status: status }).then((r) => r ?? []);
export const crmSetContactMessage = (id, done) => rpc("crm_contact_message_set", { p_id: id, p_done: done });

/** A 10-digit Indian mobile, from whatever was typed (+91, spaces, dashes). */
export function cleanMobile(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  const local = d.length > 10 && d.startsWith("91") ? d.slice(-10) : d;
  return /^[6-9]\d{9}$/.test(local) ? local : "";
}
