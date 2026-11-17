/**
 * Standard rents behind the deals' "% lower" line (deal_standards.sql): one row
 * per area ('' = everywhere — seeded with HSR's), 1/2/3 BHK and premium society
 * 2/3 BHK. Set in CRM → Deals → Deal of the Day.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

export const STANDARD_FIELDS = [
  { id: "r1", label: "1 BHK" }, { id: "r2", label: "2 BHK" }, { id: "r3", label: "3 BHK" },
  { id: "s2", label: "Society 2 BHK" }, { id: "s3", label: "Society 3 BHK" },
];

export const fetchDealStandards = () => rpc("crm_deal_standards").then((r) => r ?? []);
export const saveDealStandard = (row) => rpc("crm_deal_standard_save", { p: row }).then((r) => r ?? []);
export const removeDealStandard = (area) => rpc("crm_deal_standard_remove", { p_area: area }).then((r) => r ?? []);
