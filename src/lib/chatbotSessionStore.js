import { supabase, isSupabaseConfigured } from "./supabase";

/** chatbot_messages.role only accepts these two values (public.chat_role enum). */
function toDbRole(role) {
  return role === "user" ? "user" : "assistant";
}

/** Create a new chatbot_sessions row. Returns the new session id, or null if unavailable. */
export async function createChatSession(userId, preferences) {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from("chatbot_sessions")
      .insert({ user_id: userId || null, preferences: preferences || {} })
      .select("id")
      .single();
    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}

/** Best-effort — chat still works locally if this fails. */
export async function updateChatSessionPreferences(sessionId, preferences) {
  if (!isSupabaseConfigured || !supabase || !sessionId) return;
  try {
    await supabase
      .from("chatbot_sessions")
      .update({ preferences: preferences || {}, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch {
    /* best-effort */
  }
}

/** Best-effort — chat still works locally if this fails. */
export async function saveChatMessage(sessionId, role, content) {
  if (!isSupabaseConfigured || !supabase || !sessionId || !content) return;
  try {
    await supabase.from("chatbot_messages").insert({
      session_id: sessionId,
      role: toDbRole(role),
      content: String(content).slice(0, 4000),
    });
  } catch {
    /* best-effort */
  }
}
