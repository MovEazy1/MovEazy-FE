/**
 * Shrink the listing photos uploaded before photos were shrunk on upload
 * (lib/imageShrink.js). Super admin only; runs in this browser, a few at a
 * time, and can be stopped and run again — it carries on where it left off.
 *
 * For every photo in the listings bucket:
 *   1. the original is copied to originals-archive/<same path> — kept, never
 *      deleted here; delete that folder from the Supabase dashboard when you
 *      are happy;
 *   2. the photo is replaced, at the same address, by its 1600 px JPEG — so no
 *      listing has to change;
 *   3. its 480 px thumbnail is written to thumbs/<same path> for cards.
 * A photo already archived is not touched again; one this browser can't open
 * (an old HEIC) is left as it is.
 */
import { useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { MAIN_MAX, THUMB_MAX, THUMBS_PREFIX, shrinkImage, thumbPath } from "../../lib/imageShrink";
import { Btn, C } from "./crmUi";

const BUCKET = "listings";
const ARCHIVE = "originals-archive/";
const IMAGE = /\.(jpe?g|png|webp|heic|heif)$/i;
const AT_ONCE = 3;

async function listAll(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const e of data ?? []) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listAll(path))); // a folder
      else out.push({ path, size: Number(e.metadata?.size) || 0, type: e.metadata?.mimetype || "" });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

const exists = async (path) => {
  const dir = path.split("/").slice(0, -1).join("/");
  const name = path.split("/").pop();
  const { data } = await supabase.storage.from(BUCKET).list(dir, { search: name, limit: 5 });
  return (data ?? []).some((e) => e.name === name);
};

async function processOne(file) {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(file.path);
  if (error || !blob) return { result: "failed", saved: 0 };
  const main = await shrinkImage(blob, MAIN_MAX);
  if (!main) return { result: "unreadable", saved: 0 };
  let saved = 0;
  if (main !== blob && main.size < blob.size) {
    const archived = `${ARCHIVE}${file.path}`;
    if (!(await exists(archived))) {
      const { error: copyErr } = await supabase.storage.from(BUCKET).copy(file.path, archived);
      if (copyErr) return { result: "failed", saved: 0 };
    }
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(file.path, main, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
    if (upErr) return { result: "failed", saved: 0 };
    saved = blob.size - main.size;
  }
  const thumb = await shrinkImage(main, THUMB_MAX);
  if (thumb) {
    await supabase.storage.from(BUCKET)
      .upload(thumbPath(file.path), thumb, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
  }
  return { result: saved ? "shrunk" : "kept", saved };
}

export default function CrmPhotoOptimizer() {
  const [state, setState] = useState({ phase: "idle", total: 0, done: 0, shrunk: 0, kept: 0, failed: 0, unreadable: 0, savedBytes: 0, msg: "" });
  const stop = useRef(false);

  const run = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    stop.current = false;
    setState((s) => ({ ...s, phase: "listing", msg: "Finding photos…" }));
    let files;
    try {
      const all = await listAll("");
      const archived = new Set(all.filter((f) => f.path.startsWith(ARCHIVE)).map((f) => f.path.slice(ARCHIVE.length)));
      const thumbs = new Set(all.filter((f) => f.path.startsWith(THUMBS_PREFIX)).map((f) => f.path.slice(THUMBS_PREFIX.length)));
      files = all.filter((f) => !f.path.startsWith(ARCHIVE) && !f.path.startsWith(THUMBS_PREFIX)
        && (IMAGE.test(f.path) || /^image\//.test(f.type))
        && !(archived.has(f.path) && thumbs.has(f.path)));
    } catch (e) {
      setState((s) => ({ ...s, phase: "idle", msg: e?.message || "Could not list the photos." }));
      return;
    }
    setState({ phase: "running", total: files.length, done: 0, shrunk: 0, kept: 0, failed: 0, unreadable: 0, savedBytes: 0, msg: "" });
    let next = 0;
    const worker = async () => {
      while (!stop.current && next < files.length) {
        const f = files[next++];
        let r;
        try { r = await processOne(f); } catch { r = { result: "failed", saved: 0 }; }
        setState((s) => ({ ...s, done: s.done + 1, [r.result]: s[r.result] + 1, savedBytes: s.savedBytes + r.saved }));
      }
    };
    await Promise.all(Array.from({ length: AT_ONCE }, worker));
    setState((s) => ({ ...s, phase: stop.current ? "stopped" : "finished" }));
  };

  const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
  const s = state;
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>Shrink existing listing photos</h2>
      <p style={{ color: C.textDim, fontSize: 13, margin: "0 0 10px", maxWidth: "70ch", lineHeight: 1.6 }}>
        New photos are shrunk as they are uploaded. This does the same for the ones uploaded before: each becomes a
        1600 px JPEG at the same address, with a small thumbnail for cards. Originals are copied to
        the <code>originals-archive</code> folder first — delete it from the Supabase dashboard once you are happy.
        Keep this tab open while it runs; you can stop and run it again.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {s.phase === "running" || s.phase === "listing"
          ? <Btn sm onClick={() => { stop.current = true; }}>Stop</Btn>
          : <Btn sm variant="primary" onClick={run}>{s.phase === "idle" ? "Shrink photos" : "Run again"}</Btn>}
        {s.total > 0 && (
          <span className="crm-num" style={{ fontSize: 12.5 }}>
            {s.done} / {s.total} · {s.shrunk} shrunk · {s.kept} already small · {s.failed} failed
            {s.unreadable ? ` · ${s.unreadable} unreadable` : ""} · {mb(s.savedBytes)} saved
            {s.phase === "finished" ? " · done" : s.phase === "stopped" ? " · stopped" : ""}
          </span>
        )}
        {s.msg && <span className="crm-mute" style={{ fontSize: 12.5 }}>{s.msg}</span>}
      </div>
    </div>
  );
}
