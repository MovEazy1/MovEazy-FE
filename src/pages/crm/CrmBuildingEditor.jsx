/**
 * CRM → a building or society, and the flats in it (crm_onboarding.sql).
 *
 * /crm/buildings/new?flats=MZ-1,MZ-2 — "Group into building" from Properties
 * /crm/buildings/:id                — edit one
 *
 * The cover video and photos are what a tenant sees first when they scan the
 * building's QR, so the editor asks for them. Then the flats, in the order
 * MovEazy wants them shown, each with its house number and floor. A building
 * has one owner (who sees it all in the owner app); a society's flats each
 * have their own owner, who sees only theirs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Camera, Film, Loader2, Star, Trash2, X } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Empty, Toast, inr } from "./crmUi";
import QrPosterBlock from "../../components/QrPosterBlock";
import { ALL_LOCALITIES } from "../../data/preferenceOptions";
import { mediaRejectionReason, uploadInventoryPhotos } from "../../lib/inventory";
import { isVideoFile } from "../../lib/listingMedia";
import { fetchCrmBuilding, saveCrmBuilding, setBuildingUnits, setCrmFlatBuilding } from "../../lib/crmPropertyInternal";
import { buildingUrl, floorLabel } from "../../lib/buildings";
import { SCOPES } from "../../lib/adminScopes";
import { BUILDING_AMENITIES } from "../owners/BuildingForm";

const MAX_PHOTOS = 30;

const BLANK = {
  name: "", kind: "building", area: "", landmark: "", full_address: "", total_floors: "",
  owner_email: "", owner_phone: "", description: "", amenities: [], photos: [], cover_video: "",
};

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span className="crm-label">{label}</span>
      {children}
      {hint && <span className="crm-mute" style={{ fontSize: 11 }}>{hint}</span>}
    </label>
  );
}

export default function CrmBuildingEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { inventory, access, reload } = useCrm();
  const canEdit = access.has(SCOPES.PROPERTIES_WRITE);
  const isNew = !id;

  const [b, setB] = useState(isNew ? { ...BLANK } : null);
  const [code, setCode] = useState("");
  const [stats, setStats] = useState(null);
  const [owner, setOwner] = useState(null);
  const [flats, setFlats] = useState([]); // [{ property_id, unit_no, floor_number, ...listing }]
  const [initialIds, setInitialIds] = useState([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [videoBusy, setVideoBusy] = useState("");
  // Photos on their way up, shown as tiles until they land: [{ key, preview }]
  const [pending, setPending] = useState([]);
  const uploading = videoBusy || (pending.length ? `Uploading ${pending.length} photo${pending.length > 1 ? "s" : ""}…` : "");
  const [toast, setToast] = useState(null);
  const [folder] = useState(() => `BLD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`);

  const say = (message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3200); };
  const byId = useMemo(() => new Map((inventory ?? []).map((l) => [l.property_id, l])), [inventory]);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const d = await fetchCrmBuilding(id);
      if (!d) { setB(false); return; }
      setB({
        name: d.name || "", kind: d.kind || "building", area: d.area || "", landmark: d.landmark || "", full_address: d.full_address || "",
        total_floors: d.total_floors ?? "", owner_email: d.owner_email || "", owner_phone: d.owner_phone || "",
        description: d.description || "", amenities: d.amenities ?? [], photos: d.photos ?? [], cover_video: d.cover_video || "",
      });
      setCode(d.code);
      setStats(d.stats);
      setOwner(d.owner);
      const list = (d.flats ?? []).map((f) => ({ ...f, unit_no: f.unit_no || "", floor_number: f.floor_number ?? "" }));
      setFlats(list);
      setInitialIds(list.map((f) => f.property_id));
    } catch (e) {
      say(e?.message || "Could not load the building", "error");
      setB(false);
    }
  }, [id, isNew]);
  useEffect(() => { load(); }, [load]);

  // "Group into building" / "Add to a building": the ticked flats arrive in the URL,
  // added once the building (if any) has loaded. Nothing is saved until Save.
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (added || !inventory?.length || (!isNew && !b)) return;
    const ids = String(params.get("flats") || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (!ids.length) return;
    setAdded(true);
    setFlats((cur) => [...cur, ...ids.filter((pid) => !cur.some((f) => f.property_id === pid)).map((pid) => byId.get(pid)).filter(Boolean)
      .map((l) => ({ ...l, unit_no: l.unit_no || "", floor_number: l.floor_number ?? "" }))]);
    const first = byId.get(ids[0]);
    if (isNew && first) setB((cur) => ({ ...cur, area: cur.area || first.area || "", landmark: cur.landmark || first.landmark || "", full_address: cur.full_address || first.full_address || "" }));
  }, [added, isNew, b, params, inventory, byId]);

  const set = (patch) => setB((cur) => ({ ...cur, ...patch }));
  const move = (i, d) => setFlats((cur) => {
    const next = [...cur];
    const j = i + d;
    if (j < 0 || j >= next.length) return cur;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const setFlat = (i, patch) => setFlats((cur) => cur.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const inList = new Set(flats.map((f) => f.property_id));
    return (inventory ?? []).filter((l) => !inList.has(l.property_id)
      && [l.property_id, l.title, l.area, l.flat_type, l.poster_name, l.full_address].join(" ").toLowerCase().includes(needle)).slice(0, 12);
  }, [q, inventory, flats]);

  // Every landed photo is added to the building as it is *now*, not as it was
  // when the upload started — so picking more while some are still going up
  // (one at a time from a phone, say) never drops the earlier ones.
  const uploadPhotos = async (files) => {
    const jobs = files.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file) }));
    setPending((cur) => [...cur, ...jobs]);
    let full = false;
    for (const job of jobs) {
      const [url] = await uploadInventoryPhotos([job.file], folder, null, (file, msg) => say(`${file.name}: ${msg}`, "error"));
      setPending((cur) => cur.filter((j) => j.key !== job.key));
      URL.revokeObjectURL(job.preview);
      if (url) setB((cur) => {
        const photos = cur.photos ?? [];
        if (photos.length >= MAX_PHOTOS) { full = true; return cur; }
        return { ...cur, photos: [...photos, url] };
      });
    }
    if (full) say(`Up to ${MAX_PHOTOS} photos per building`, "error");
  };

  const uploadVideo = async (file) => {
    setVideoBusy("Uploading the video…");
    const [url] = await uploadInventoryPhotos([file], folder, null, (f, msg) => say(`${f.name}: ${msg}`, "error"), {
      // Over 50 MB: shrunk to 720p in the browser first, as long as the video runs.
      onShrink: (_f, p) => setVideoBusy(p >= 100 ? "Uploading the video…" : `Shrinking the video to fit — ${p}% (keep this tab open)`),
    });
    setVideoBusy("");
    if (url) { setB((cur) => ({ ...cur, cover_video: url })); say("Video added — press Save to keep it"); }
  };

  // One way in for the picker, a drop and a paste: photos join the photos,
  // a video becomes the cover video.
  const addMedia = (list) => {
    const photos = [];
    let video = null;
    for (const f of list ?? []) {
      const why = mediaRejectionReason(f);
      if (why) { say(why, "error"); continue; }
      if (isVideoFile(f)) { video = video || f; continue; }
      if (!String(f.type || "").startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name || "")) continue;
      photos.push(f);
    }
    if (video) {
      if (b?.cover_video || videoBusy) say("One cover video per building — remove the current one first", "error");
      else uploadVideo(video);
    }
    const room = MAX_PHOTOS - (b?.photos?.length ?? 0) - pending.length;
    if (photos.length > room) say(`Up to ${MAX_PHOTOS} photos per building`, "error");
    if (room > 0 && photos.length) uploadPhotos(photos.slice(0, room));
  };
  const addMediaRef = useRef(addMedia);
  addMediaRef.current = addMedia;
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (!files.length) return;
      e.preventDefault();
      addMediaRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const save = async () => {
    if (!b.name.trim()) { say("Give the building a name", "error"); return; }
    if (!b.area.trim()) { say("Which locality is it in?", "error"); return; }
    if (!(b.photos ?? []).length && !b.cover_video
      && !window.confirm("No cover photos or video yet — they're the first thing a tenant sees when they scan the QR. Save anyway?")) return;
    setSaving(true);
    try {
      const r = await saveCrmBuilding({
        ...(isNew ? {} : { id }),
        name: b.name.trim(), kind: b.kind, area: b.area.trim(), landmark: b.landmark, full_address: b.full_address,
        total_floors: String(b.total_floors ?? ""), description: b.description, amenities: b.amenities, photos: b.photos,
        cover_video: b.cover_video,
        ...(b.kind === "building" ? { owner_email: b.owner_email.trim().toLowerCase(), owner_phone: b.owner_phone.trim() } : {}),
      });
      const bid = r.id;
      await setBuildingUnits(bid, flats.map((f, i) => ({
        property_id: f.property_id, unit_no: String(f.unit_no || "").trim(),
        floor_number: String(f.floor_number ?? "").trim() === "" ? "" : Number(f.floor_number), unit_order: i + 1,
      })));
      const gone = initialIds.filter((pid) => !flats.some((f) => f.property_id === pid));
      for (const pid of gone) await setCrmFlatBuilding(pid, null);
      reload?.();
      say(`Saved · ${flats.length} flat${flats.length === 1 ? "" : "s"}`);
      if (isNew) navigate(`/crm/buildings/${bid}`, { replace: true }); else await load();
    } catch (e) {
      say(e?.message || "Could not save the building", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) return <Empty>You don't have permission to change buildings.</Empty>;
  if (b === null) return <Empty>Loading…</Empty>;
  if (b === false) return <Empty>That building doesn't exist. <Link to="/crm/owner-qr">Back</Link></Empty>;

  const coverMissing = !(b.photos ?? []).length && !b.cover_video;
  const card = { border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, display: "grid", gap: 10, background: "#fff" };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">{isNew ? "Group flats into a building" : `${b.kind === "society" ? "Society" : "Building"} · ${b.name}`}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn onClick={() => navigate(-1)}>Back</Btn>
          <Btn variant="primary" onClick={save} disabled={saving || Boolean(uploading)}>{saving ? "Saving…" : uploading || "Save"}</Btn>
        </div>
      </div>
      <div className="crm-scroll" style={{ flex: 1, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(360px, 1.3fr)", gap: 16, alignItems: "start", maxWidth: 1240 }}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <Field label="Name"><input className="crm-input" value={b.name} onChange={(e) => set({ name: e.target.value })} placeholder="Sunrise Residency" /></Field>
              <div style={{ display: "grid", gap: 4 }}>
                <span className="crm-label">Type</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["building", "Building", "One owner — sees it all in the owner app"], ["society", "Society", "Each flat has its own owner"]].map(([k, label, sub]) => (
                    <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={b.kind === k}
                      style={{ flex: 1, textAlign: "left", padding: "8px 10px", borderRadius: 8, cursor: "pointer", font: "inherit",
                        border: `1px solid ${b.kind === k ? C.accent : C.line}`, background: b.kind === k ? C.accentSoft : "#fff" }}>
                      <strong style={{ fontSize: 12.5, color: b.kind === k ? C.accent : C.text }}>{label}</strong>
                      <span className="crm-mute" style={{ display: "block", fontSize: 11 }}>{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Locality">
                  <input className="crm-input" list="cbe-loc" value={b.area} onChange={(e) => set({ area: e.target.value })} placeholder="HSR Layout" />
                  <datalist id="cbe-loc">{ALL_LOCALITIES.map((a) => <option key={a} value={a} />)}</datalist>
                </Field>
                <Field label="Floors above ground"><input className="crm-input" inputMode="numeric" value={b.total_floors}
                  onChange={(e) => set({ total_floors: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></Field>
              </div>
              <Field label="Landmark" hint="Shown to tenants."><input className="crm-input" value={b.landmark} onChange={(e) => set({ landmark: e.target.value })} /></Field>
              <Field label="Full address" hint="Never on the QR page — shared once a visit is confirmed."><input className="crm-input" value={b.full_address} onChange={(e) => set({ full_address: e.target.value })} /></Field>
              {b.kind === "building" && (
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="crm-label">Owner</span>
                  {owner ? (
                    <span style={{ fontSize: 12.5, color: C.accent, fontWeight: 600 }}>✓ {owner.name || owner.email} has it in the owner app ({owner.email})</span>
                  ) : (
                    <>
                      <input className="crm-input" type="email" placeholder="Owner's Google email" value={b.owner_email} onChange={(e) => set({ owner_email: e.target.value })} />
                      <input className="crm-input" placeholder="Owner's mobile" value={b.owner_phone} onChange={(e) => set({ owner_phone: e.target.value })} />
                      <span className="crm-mute" style={{ fontSize: 11 }}>The building and every flat in it show up in their owner app when they sign in with this email.</span>
                    </>
                  )}
                </div>
              )}
              {b.kind === "society" && (
                <span className="crm-mute" style={{ fontSize: 11.5 }}>Each flat's owner is set on the flat itself (Edit → Owner &amp; building). They see only their own flat.</span>
              )}
              <Field label="About the property"><textarea className="crm-input" rows={3} value={b.description} onChange={(e) => set({ description: e.target.value })} /></Field>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {BUILDING_AMENITIES.map((a) => {
                  const on = b.amenities.includes(a);
                  return (
                    <button key={a} type="button" onClick={() => set({ amenities: on ? b.amenities.filter((x) => x !== a) : [...b.amenities, a] })}
                      style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", font: "inherit",
                        border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff", color: on ? C.accent : C.textDim }}>{a}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card, borderColor: coverMissing ? C.gold : C.line }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addMedia([...(e.dataTransfer?.files ?? [])]); }}>
              <span className="crm-label">Cover video &amp; photos</span>
              {coverMissing && <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>Add a walk-through video and cover photos — the first thing a tenant sees after scanning the QR.</span>}
              {b.cover_video ? (
                <div style={{ position: "relative" }}>
                  <video src={b.cover_video} controls playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000" }} />
                  <button type="button" onClick={() => set({ cover_video: "" })} className="crm-btn crm-btn--sm" style={{ position: "absolute", top: 6, right: 6 }}><X size={13} /> Remove</button>
                </div>
              ) : videoBusy ? (
                <div className="crm-btn" style={{ justifyContent: "center", cursor: "default" }} role="status">
                  <Film size={15} /> {videoBusy}
                </div>
              ) : (
                <label className="crm-btn" style={{ justifyContent: "center", cursor: "pointer" }}>
                  <Film size={15} /> Add the cover video
                  <input type="file" accept="video/*" hidden onChange={(e) => { addMedia([...e.target.files]); e.target.value = ""; }} />
                </label>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {(b.photos ?? []).map((src, i) => (
                  <div key={src} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: C.surface }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {i === 0 ? <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 10, background: C.accent, color: "#fff", borderRadius: 99, padding: "1px 6px" }}>Cover</span>
                      : <button type="button" title="Make cover" onClick={() => set({ photos: [src, ...b.photos.filter((x) => x !== src)] })}
                        style={{ position: "absolute", left: 4, bottom: 4, border: 0, borderRadius: 99, background: "rgba(0,0,0,.55)", color: "#fff", cursor: "pointer", padding: "2px 5px" }}><Star size={11} /></button>}
                    <button type="button" aria-label="Remove photo" onClick={() => set({ photos: b.photos.filter((x) => x !== src) })}
                      style={{ position: "absolute", right: 4, top: 4, border: 0, borderRadius: 99, background: "rgba(0,0,0,.55)", color: "#fff", width: 20, height: 20, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={12} /></button>
                  </div>
                ))}
                {pending.map((p) => (
                  <div key={p.key} role="status" aria-label="Uploading photo" style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: C.surface }}>
                    <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.5 }} />
                    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><Loader2 size={18} className="crm-spin" /></span>
                  </div>
                ))}
                {(b.photos ?? []).length + pending.length < MAX_PHOTOS && (
                  <label style={{ aspectRatio: "1", borderRadius: 8, border: `1.5px dashed ${C.line}`, display: "grid", placeItems: "center", cursor: "pointer", color: C.textMute, fontSize: 11, textAlign: "center" }}>
                    <span><Camera size={18} /><br />Add photos</span>
                    <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addMedia([...e.target.files]); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              <span className="crm-mute" style={{ fontSize: 11 }}>
                Select several at once (on a phone, long-press a photo to pick more), keep adding more, drag them in or paste — the first is the cover. {(b.photos ?? []).length}/{MAX_PHOTOS}
              </span>
              <style>{".crm-spin{animation:crm-spin 1s linear infinite}@keyframes crm-spin{to{transform:rotate(360deg)}}"}</style>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="crm-label">Flats · {flats.length}</span>
                <span className="crm-mute" style={{ fontSize: 11 }}>Shown to tenants in this order</span>
              </div>
              {flats.length === 0 && <span className="crm-mute" style={{ fontSize: 12 }}>No flats yet — search below to add them.</span>}
              {flats.map((f, i) => {
                const l = byId.get(f.property_id) || f;
                return (
                  <div key={f.property_id} style={{ display: "grid", gridTemplateColumns: "auto 48px 1fr 92px 92px auto", gap: 8, alignItems: "center",
                    padding: "6px 0", borderTop: i ? `1px solid ${C.lineSoft}` : 0 }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <button type="button" className="crm-btn crm-btn--sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" style={{ padding: "2px 5px" }}><ArrowUp size={12} /></button>
                      <button type="button" className="crm-btn crm-btn--sm" disabled={i === flats.length - 1} onClick={() => move(i, 1)} aria-label="Move down" style={{ padding: "2px 5px" }}><ArrowDown size={12} /></button>
                    </div>
                    <div style={{ width: 48, height: 40, borderRadius: 6, overflow: "hidden", background: C.surface }}>
                      {l.cover_image_url && <img src={l.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                    </div>
                    <div style={{ minWidth: 0, fontSize: 12 }}>
                      <strong>{i + 1}. {l.flat_type || "Flat"}</strong> · {inr(l.rent)}
                      <div className="crm-mute" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        <Link to={`/crm/properties/${f.property_id}/edit`} style={{ color: C.accent }}>{f.property_id}</Link> · {l.status}
                        {f.owner ? ` · ${f.owner}` : f.owner_contact ? ` · owner ${f.owner_contact}` : ""}
                      </div>
                    </div>
                    <input className="crm-input" placeholder="House no" value={f.unit_no} onChange={(e) => setFlat(i, { unit_no: e.target.value.slice(0, 20) })} aria-label="House number" />
                    <select className="crm-input" value={f.floor_number ?? ""} onChange={(e) => setFlat(i, { floor_number: e.target.value })} aria-label="Floor">
                      <option value="">Floor</option>
                      {[-1, ...Array.from({ length: 31 }, (_, k) => k)].map((n) => <option key={n} value={n}>{floorLabel(n)}</option>)}
                    </select>
                    <button type="button" className="crm-btn crm-btn--sm" aria-label="Remove from building" onClick={() => setFlats((cur) => cur.filter((x) => x.property_id !== f.property_id))}><Trash2 size={13} /></button>
                  </div>
                );
              })}
              <input className="crm-input" placeholder="Add a flat: search id, area, title, owner…" value={q} onChange={(e) => setQ(e.target.value)} />
              {results.map((l) => (
                <button key={l.property_id} type="button" onClick={() => { setFlats((cur) => [...cur, { ...l, unit_no: l.unit_no || "", floor_number: l.floor_number ?? "" }]); setQ(""); }}
                  style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 9px", background: "#fff", cursor: "pointer", font: "inherit", fontSize: 12 }}>
                  + <strong>{l.property_id}</strong> · {l.flat_type} · {l.area} · {inr(l.rent)} <span className="crm-mute">· {l.status}{l.building_id && l.building_id !== id ? " · in another building" : ""}</span>
                </button>
              ))}
            </div>

            {code ? (
              <div style={card}>
                <span className="crm-label">Building QR — every flat</span>
                {stats && <span style={{ fontSize: 12 }}>{stats.scans} scans · {stats.numbers} mobiles · {stats.scheduled} visits asked · {stats.booked} booked</span>}
                <div style={{ maxWidth: 300 }}>
                  <QrPosterBlock key={`${code}-${b.photos?.[0] || ""}`} flat={flats[0] || { property_id: "" }}
                    building={{ code, name: b.name, area: b.area, landmark: b.landmark, photo: b.photos?.[0] || flats[0]?.cover_image_url || "",
                      available: flats.filter((f) => f.status === "published").length,
                      rentFrom: (() => { const r = flats.map((f) => Number(f.rent) || 0).filter(Boolean); return r.length ? inr(Math.min(...r)) : ""; })() }}
                    btnClass="crm-btn crm-btn--primary" softClass="crm-btn" onToast={say} previewWidth={240} />
                </div>
                <a href={buildingUrl(code)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.accent }}>/building/{code}</a>
              </div>
            ) : (
              <div style={{ ...card, color: C.textMute, fontSize: 12 }}>Save to get the building's QR poster.</div>
            )}
          </div>
        </div>
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
