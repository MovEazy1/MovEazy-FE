/**
 * One link for the whole shortlist.
 *
 * Sending 23 properties as 23 tracked links produced a WhatsApp message nobody
 * reads and a set the recipient can't feel the shape of. A curated share is the
 * set: one row in crm_curated_shares, one opaque token, one link. The person who
 * opens it swipes through the homes the same way they swiped their first five,
 * and every swipe is written back against their CRM record.
 *
 * The recipient is signed out when they tap a WhatsApp link, so the three reads
 * and writes here all go through security-definer functions that take the token
 * and can only touch the one client and property set it names. Nothing on this
 * path needs an account — booking a visit does, and that gate lives where it
 * always has.
 */
import { supabase, isSupabaseConfigured } from "./supabase";
import { generateShareToken } from "./crmSettings";

/** Where a curated link points. Attributed like every other share we send. */
export function curatedLink(token) {
  if (!token) return "";
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://www.moveazy.co.in";
  const q = new URLSearchParams({
    utm_source: "crm",
    utm_medium: "whatsapp",
    utm_campaign: "curated_share",
  });
  return `${origin}/curated/${encodeURIComponent(token)}?${q.toString()}`;
}

/**
 * Record the set an agent just sent, and hand back the link for it.
 *
 * A fresh row per send rather than one row updated in place: "the 23 I sent on
 * Tuesday" and "the 6 I sent this morning" are different things to follow up on,
 * and an old link a client is still working through must keep working.
 */
export async function createCuratedShare({
  clientId,
  propertyIds = [],
  sharedBy = "",
  agentName = "",
}) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  const ids = [...new Set(propertyIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!clientId || ids.length === 0) throw new Error("Nothing to share.");

  const token = generateShareToken();
  const { data, error } = await supabase
    .from("crm_curated_shares")
    .insert({
      client_id: clientId,
      token,
      property_ids: ids,
      shared_by: sharedBy,
      agent_name: agentName,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, link: curatedLink(token) };
}

/** Every curated batch sent to one client, newest first. Never throws. */
export async function fetchCuratedShares(clientId) {
  if (!isSupabaseConfigured || !supabase || !clientId) return [];
  const { data, error } = await supabase
    .from("crm_curated_shares")
    .select("id,client_id,token,property_ids,shared_by,agent_name,created_at,opened_at,last_opened_at,open_count")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.warn(`[crm] crm_curated_shares: ${error.message}`);
    return [];
  }
  return data ?? [];
}

const EMPTY = { ok: false, propertyIds: [], reactions: {}, clientName: "", agentName: "", token: "" };

function shape(row, fallbackToken = "") {
  if (!row || row.ok !== true) return { ...EMPTY };
  return {
    ok: true,
    token: row.token || fallbackToken,
    clientName: String(row.client_name || ""),
    agentName: String(row.agent_name || ""),
    sharedAt: row.shared_at || "",
    propertyIds: Array.isArray(row.property_ids) ? row.property_ids.map(String) : [],
    reactions: row.reactions && typeof row.reactions === "object" ? row.reactions : {},
  };
}

/**
 * Open a curated link. Counts the open, and returns the batch plus whatever the
 * client has already said about each home — so a session they abandoned halfway
 * resumes where it stopped rather than starting from the first card again.
 */
export async function openCuratedShare(token) {
  if (!isSupabaseConfigured || !supabase || !token) return { ...EMPTY };
  try {
    const { data, error } = await supabase.rpc("curated_share_open", { token });
    if (error) {
      console.warn(`[curated] open: ${error.message}`);
      return { ...EMPTY };
    }
    return shape(data, token);
  } catch (e) {
    console.warn(`[curated] open threw: ${e?.message}`);
    return { ...EMPTY };
  }
}

/** A swipe. Best-effort: a failed write must never stall the deck. */
export async function reactToCuratedProperty(token, propertyId, reaction) {
  if (!isSupabaseConfigured || !supabase || !token || !propertyId) return false;
  try {
    const { data, error } = await supabase.rpc("curated_share_react", {
      token,
      p_property_id: String(propertyId),
      p_reaction: reaction,
    });
    if (error) {
      console.warn(`[curated] react: ${error.message}`);
      return false;
    }
    return data?.ok === true;
  } catch (e) {
    console.warn(`[curated] react threw: ${e?.message}`);
    return false;
  }
}

/**
 * The same shortlist for a signed-in client who came back without the link —
 * from the app, from a bookmark, from the relax screen. Their account is the
 * key, so there is no token in play.
 */
export async function fetchMyCuratedProperties() {
  if (!isSupabaseConfigured || !supabase) return { ...EMPTY };
  try {
    const { data, error } = await supabase.rpc("my_curated_properties");
    if (error) {
      console.warn(`[curated] mine: ${error.message}`);
      return { ...EMPTY };
    }
    return shape(data);
  } catch (e) {
    console.warn(`[curated] mine threw: ${e?.message}`);
    return { ...EMPTY };
  }
}

/** How a status reads on the agent's screen. */
export const CURATED_STATUS_LABEL = {
  liked: "Liked it",
  disliked: "Did not like",
  okay: "Okay",
  visit_scheduled: "Visit scheduled",
  visited: "Visited",
  shared: "Sent, no reply yet",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};
