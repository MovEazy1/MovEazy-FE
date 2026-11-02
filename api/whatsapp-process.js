/**
 * GET|POST /api/whatsapp-process — read the WhatsApp batches that are ready
 * (whatsapp_intake.sql wa_claim_ready) into draft listings for the CRM inbox.
 *
 * Called every 2 minutes by the database (pg_cron → pg_net) while something
 * is waiting, and by the CRM inbox when it opens. Safe for anyone to call:
 * it only reads what is already queued, each batch once.
 *
 * Needs, in Vercel → Settings → Environment Variables:
 *   ANTHROPIC_API_KEY            Claude reads the messages (without it, each
 *                                batch becomes one draft holding the text and
 *                                photos, to fill in by hand)
 *   WA_AI_MODEL (optional)       defaults to claude-opus-5-5
 *   SUPABASE_SERVICE_ROLE_KEY    already set for payments
 */
import Anthropic from "@anthropic-ai/sdk";
import { env, json, service } from "./_razorpay.js";
import { SCHEMA, batchToPrompt, fallbackItems, hasText, normalizeParse, systemPrompt } from "./_waParse.js";

const MODEL = (process.env.WA_AI_MODEL || "claude-opus-5-5").trim();
const rpc = (fn, args) => service(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

async function areaNames() {
  try {
    const rows = await service("areas?select=name&active=eq.true&order=sort,name");
    return (rows ?? []).map((r) => r.name).filter(Boolean);
  } catch {
    return [];
  }
}

async function read(client, batch, names) {
  const { text, media } = batchToPrompt(batch);
  if (!hasText(batch)) return { items: [] }; // photos alone: the database joins them to the sender's open draft
  if (!client) return { items: fallbackItems(batch, media) };
  try {
    // Haiku has no server-side fallback; the larger models do.
    const fallback = /haiku/.test(MODEL) ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      ...fallback,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: systemPrompt(names, new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })),
      messages: [{ role: "user", content: text }],
    });
    if (res.stop_reason === "refusal") throw new Error("Claude declined to read this message");
    if (res.stop_reason === "max_tokens") throw new Error("The message was too long to read in one go");
    const block = res.content.find((b) => b.type === "text");
    return { items: normalizeParse(JSON.parse(block?.text || "{}"), media, names) };
  } catch (e) {
    // The last try still leaves the team a draft to fill by hand.
    if ((batch.attempts ?? 1) >= 3) return { items: fallbackItems(batch, media) };
    return { error: String(e?.message || e).slice(0, 400) };
  }
}

async function handle() {
  if (!env.serviceKey || !env.supabaseUrl) return json({ error: "Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy." }, 503);
  const batches = await rpc("wa_claim_ready", { p_limit: 4 });
  if (!batches?.length) return json({ ok: true, read: 0 });
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  const names = await areaNames();
  const results = await Promise.all(batches.map(async (b) => {
    const parsed = await read(client, b, names);
    try {
      return { batch: b.id, ...(await rpc("wa_save_parse", { p_batch: b.id, p: parsed })) };
    } catch (e) {
      return { batch: b.id, error: String(e?.message || e).slice(0, 200) };
    }
  }));
  return json({ ok: true, read: results.length, ai: Boolean(client), results });
}

export const GET = handle;
export const POST = handle;
