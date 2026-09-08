/**
 * Single-page property upload. No wizard, no "next".
 *
 * The public List My Flat flow is a guided story for an owner listing once. This
 * is the opposite: three columns, every field on screen, tab straight through,
 * ⌘↵ to publish. Same `inventory` table, same MZ- code.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import {
  ALL_LOCALITIES, FLAT_TYPES, FURNISHINGS, MUST_HAVES, OCCUPANTS,
} from "../../data/preferenceOptions";
import { cleanSourceUrl, detectSource, parseListingText } from "../../lib/listingImport";
import { generatePropertyId, uploadInventoryPhotos } from "../../lib/inventory";
import { matchListingToRequirements } from "../../lib/inventoryMatch";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, Toast, inr } from "./crmUi";

const BLANK = {
  area: "", nearby_areas: [], full_address: "", landmark: "",
  rent: "", deposit: "", available_from: "",
  flat_type: "", bedrooms: "", bathrooms: "", furnishing: "",
  occupants_allowed: [], amenities: [],
  poster_name: "", phone: "", posted_by: "owner",
  title: "", description: "", source_url: "",
};

const DRAFT_KEY = "moveazy_crm_property_draft";

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="crm-label">{label}</span>
      {children}
      {hint && <span className="crm-mute" style={{ fontSize: 10.5 }}>{hint}</span>}
    </label>
  );
}

function Column({ title, children }) {
  return (
    <div style={{
      padding: "14px 16px", borderRight: `1px solid ${C.line}`,
      display: "flex", flexDirection: "column", gap: 11, minWidth: 0,
    }}>
      <span className="crm-label">{title}</span>
      {children}
    </div>
  );
}

export default function CrmPropertyForm() {
  const crm = useCrm();
  const { access, user, requirements, reload } = crm;
  const navigate = useNavigate();

  const [f, setF] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...BLANK, ...JSON.parse(saved) } : BLANK;
    } catch {
      return BLANK;
    }
  });
  const [pasteText, setPasteText] = useState("");
  const [importInfo, setImportInfo] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [published, setPublished] = useState(null);
  const dropRef = useRef(null);

  const canWrite = access.has(SCOPES.PROPERTIES_WRITE);
  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const set = useCallback((patch) => setF((cur) => ({ ...cur, ...patch })), []);
  const toggle = (key, value) =>
    setF((cur) => {
      const list = cur[key] ?? [];
      return { ...cur, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  // Autosave from the first keystroke — a half-typed listing survives a reload.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    } catch { /* private mode */ }
  }, [f]);

  /* ── Import ────────────────────────────────────────────────────────────── */

  const runImport = () => {
    const { fields, found, missing } = parseListingText(pasteText);
    if (!found.length) {
      setImportInfo({ found: [], missing });
      return showToast("Nothing recognisable in that text — fill it in by hand", "error");
    }
    set({
      ...fields,
      rent: fields.rent ?? f.rent,
      deposit: fields.deposit ?? f.deposit,
      bedrooms: fields.bedrooms ?? f.bedrooms,
    });
    setImportInfo({ found, missing });
    showToast(`Read ${found.length} field${found.length === 1 ? "" : "s"}`);
  };

  /* ── Photos: drag, pick, or paste straight from the owner's chat ────────── */

  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((x) => x.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        setPhotos((p) => [...p, ...files].slice(0, 20));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])].filter((x) => x.type.startsWith("image/"));
    setPhotos((p) => [...p, ...files].slice(0, 20));
  };

  const previews = useMemo(() => photos.map((p) => ({ file: p, url: URL.createObjectURL(p) })), [photos]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  /* ── Publish ───────────────────────────────────────────────────────────── */

  const missingRequired = useMemo(() => {
    const need = [];
    if (!f.area) need.push("Locality");
    if (!f.rent) need.push("Rent");
    if (!f.flat_type) need.push("Flat type");
    if (!f.furnishing) need.push("Furnishing");
    return need;
  }, [f]);

  const publish = useCallback(async () => {
    if (!canWrite) return;
    if (missingRequired.length) return showToast(`Still needed: ${missingRequired.join(", ")}`, "error");
    if (!isSupabaseConfigured || !supabase) return showToast("Supabase is not configured", "error");

    setSaving(true);
    try {
      const propertyId = generatePropertyId();
      const images = photos.length ? await uploadInventoryPhotos(photos, propertyId) : [];
      const sourceUrl = cleanSourceUrl(f.source_url);

      const row = {
        property_id: propertyId,
        posted_by: f.posted_by || "owner",
        poster_id: user?.uid ?? null,
        poster_name: f.poster_name || "",
        poster_email: user?.email || "",
        phone: f.phone || "",
        city: "Bengaluru",
        area: f.area,
        nearby_areas: f.nearby_areas ?? [],
        full_address: f.full_address || "",
        landmark: f.landmark || "",
        rent: Number(f.rent) || 0,
        deposit: Number(f.deposit) || 0,
        available_from: f.available_from || null,
        flat_type: f.flat_type,
        bedrooms: Number(f.bedrooms) || 1,
        bathrooms: Number(f.bathrooms) || 1,
        furnishing: f.furnishing,
        occupants_allowed: f.occupants_allowed ?? [],
        amenities: f.amenities ?? [],
        title: f.title || `${f.flat_type} in ${f.area}`,
        description: f.description || "",
        images,
        cover_image_url: images[0] ?? "",
        status: "published",
        source: sourceUrl ? detectSource(sourceUrl) : "crm",
        source_url: sourceUrl,
      };

      const { data, error } = await supabase.from("inventory").insert(row).select().single();
      if (error) throw error;

      // Who was waiting for exactly this? The same engine, run the other way.
      const matches = matchListingToRequirements(data, requirements, { min: 60 });
      setPublished({ listing: data, matches });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setPhotos([]);
      reload();
    } catch (e) {
      showToast(e?.message || "Could not publish", "error");
    } finally {
      setSaving(false);
    }
  }, [canWrite, missingRequired, f, photos, user, requirements, reload]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); publish(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [publish]);

  if (!canWrite) {
    return <Empty>You don't have permission to add listings.</Empty>;
  }

  if (published) {
    return (
      <div style={{ padding: 24, maxWidth: 620, display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          {published.listing.property_id} is live
        </h1>
        <p style={{ color: C.textDim, fontSize: 14, margin: 0 }}>
          {published.matches.length === 0
            ? "No clients clear 60% on it yet — it'll surface as requirements change."
            : `${published.matches.length} client${published.matches.length === 1 ? "" : "s"} match it at 60% or better.`}
        </p>
        {published.matches.length > 0 && (
          <div className="crm-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {published.matches.slice(0, 8).map((m) => (
              <button key={m.requirement.client_id} type="button"
                onClick={() => navigate(`/crm/clients?client=${m.requirement.client_id}`)}
                style={{ display: "flex", justifyContent: "space-between", gap: 10, textAlign: "left" }}>
                <span style={{ fontSize: 12.5, color: C.text }}>
                  {(m.requirement.localities ?? []).slice(0, 2).join(", ") || "—"}
                </span>
                <span className="crm-num" style={{ fontSize: 12.5, color: C.accent }}>{m.score}%</span>
              </button>
            ))}
            <p className="crm-mute" style={{ fontSize: 11, margin: 0, lineHeight: 1.5 }}>
              Open a client to send it — the message goes out from their record so it's logged against them.
            </p>
          </div>
        )}
        <div style={{ display: "flex", gap: 7 }}>
          <Btn variant="primary" onClick={() => { setPublished(null); setF(BLANK); setImportInfo(null); setPasteText(""); }}>
            Add another
          </Btn>
          <Btn onClick={() => navigate("/crm/properties")}>Back to properties</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="crm-colhead">
        <span className="crm-label">New property</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {missingRequired.length > 0 && (
            <span className="crm-mute" style={{ fontSize: 11 }}>Needs: {missingRequired.join(", ")}</span>
          )}
          <Btn variant="primary" onClick={publish} disabled={saving}>
            {saving ? "Publishing…" : "Publish"}
          </Btn>
        </div>
      </div>

      <div className="crm-scroll" style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) minmax(260px,1fr) minmax(240px,300px)" }}>
          {/* ── where ── */}
          <Column title="Where it is">
            <Field
              label="Paste the post"
              hint="Facebook post text or the owner's WhatsApp message. Facebook links can't be read — paste the words."
            >
              <textarea className="crm-input" rows={4} value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="2BHK semi furnished in HSR, rent 44k, deposit 2L, near metro, family only. Call 98450 12233" />
            </Field>
            <Btn onClick={runImport} disabled={!pasteText.trim()}>Read it</Btn>
            {importInfo && (
              <span className="crm-mute" style={{ fontSize: 10.5, lineHeight: 1.45 }}>
                {importInfo.found.length ? `Read ${importInfo.found.join(", ")}. ` : ""}
                {importInfo.missing.length ? `Couldn't find ${importInfo.missing.join(", ")} — fill those in.` : ""}
              </span>
            )}

            <Field label="Source link (optional)" hint="Saved for traceability, not fetched. Session parameters are stripped.">
              <input className="crm-input" value={f.source_url} placeholder="facebook.com/groups/…/posts/…"
                onChange={(e) => set({ source_url: e.target.value })} />
            </Field>

            <Field label="Locality">
              <select className="crm-input" value={f.area} onChange={(e) => set({ area: e.target.value })}>
                <option value="">Select…</option>
                {ALL_LOCALITIES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>

            <Field label="Also maps to">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ALL_LOCALITIES.filter((l) => l !== f.area).map((l) => (
                  <Chip key={l} on={(f.nearby_areas ?? []).includes(l)} onClick={() => toggle("nearby_areas", l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Full address">
              <input className="crm-input" value={f.full_address}
                onChange={(e) => set({ full_address: e.target.value })} placeholder="1204, Sobha Jasmine, Sector 2" />
            </Field>
            <Field label="Landmark">
              <input className="crm-input" value={f.landmark}
                onChange={(e) => set({ landmark: e.target.value })} placeholder="Nearest landmark" />
            </Field>
          </Column>

          {/* ── what ── */}
          <Column title="What it is">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Rent">
                <input className="crm-input crm-num" type="number" inputMode="numeric" value={f.rent}
                  onChange={(e) => set({ rent: e.target.value })} placeholder="44000" />
              </Field>
              <Field label="Deposit">
                <input className="crm-input crm-num" type="number" inputMode="numeric" value={f.deposit}
                  onChange={(e) => set({ deposit: e.target.value })} placeholder="200000" />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Flat type">
                <select className="crm-input" value={f.flat_type} onChange={(e) => set({ flat_type: e.target.value })}>
                  <option value="">Select…</option>
                  {FLAT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Available from">
                <input className="crm-input" type="date" value={f.available_from}
                  onChange={(e) => set({ available_from: e.target.value })} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Bedrooms">
                <input className="crm-input crm-num" type="number" min="0" value={f.bedrooms}
                  onChange={(e) => set({ bedrooms: e.target.value })} placeholder="2" />
              </Field>
              <Field label="Bathrooms">
                <input className="crm-input crm-num" type="number" min="0" value={f.bathrooms}
                  onChange={(e) => set({ bathrooms: e.target.value })} placeholder="2" />
              </Field>
            </div>

            <Field label="Furnishing">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FURNISHINGS.map((x) => (
                  <Chip key={x} on={f.furnishing === x} onClick={() => set({ furnishing: f.furnishing === x ? "" : x })}>
                    {x}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Occupants allowed">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {OCCUPANTS.map((o) => (
                  <Chip key={o} on={(f.occupants_allowed ?? []).includes(o)} onClick={() => toggle("occupants_allowed", o)}>
                    {o}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="Amenities">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {MUST_HAVES.map((a) => (
                  <Chip key={a} on={(f.amenities ?? []).includes(a)} onClick={() => toggle("amenities", a)}>
                    {a}
                  </Chip>
                ))}
              </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Owner / broker">
                <input className="crm-input" value={f.poster_name}
                  onChange={(e) => set({ poster_name: e.target.value })} placeholder="Ramesh K" />
              </Field>
              <Field label="Their phone">
                <input className="crm-input crm-num" value={f.phone} inputMode="tel"
                  onChange={(e) => set({ phone: e.target.value })} placeholder="98801 44556" />
              </Field>
            </div>
          </Column>

          {/* ── how it looks ── */}
          <div style={{ padding: "14px 16px", background: C.surface, display: "flex", flexDirection: "column", gap: 11, minWidth: 0 }}>
            <span className="crm-label">How it looks</span>

            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => dropRef.current?.querySelector("input")?.click()}
              style={{
                border: `1px dashed ${C.line}`, borderRadius: 9, padding: "18px 10px",
                textAlign: "center", fontSize: 11.5, color: C.textMute, cursor: "pointer",
              }}
            >
              Drag photos here
              <br />
              <span style={{ color: C.textMute }}>or press ⌘V to paste from the owner's chat</span>
              <input type="file" accept="image/*" multiple hidden
                onChange={(e) => setPhotos((p) => [...p, ...e.target.files].slice(0, 20))} />
            </div>

            {previews.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {previews.map((p, i) => (
                  <button key={p.url} type="button" title="Remove"
                    onClick={() => setPhotos((cur) => cur.filter((_, idx) => idx !== i))}
                    style={{
                      aspectRatio: "1", borderRadius: 6, overflow: "hidden",
                      border: `1px solid ${C.line}`, padding: 0,
                    }}>
                    <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            )}

            <Field label="Title">
              <input className="crm-input" value={f.title} onChange={(e) => set({ title: e.target.value })}
                placeholder={f.flat_type && f.area ? `${f.flat_type} in ${f.area}` : "Bright 2 BHK with balcony"} />
            </Field>

            <Field label="Description">
              <textarea className="crm-input" rows={6} value={f.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="What the post said, tidied up." />
            </Field>

            <div style={{ display: "flex", gap: 7 }}>
              <Btn variant="primary" onClick={publish} disabled={saving}>
                {saving ? "Publishing…" : "Publish"}
              </Btn>
              <Btn onClick={() => { setF(BLANK); setPhotos([]); setPasteText(""); setImportInfo(null); }}>
                Clear
              </Btn>
            </div>
            <span className="crm-mute" style={{ fontSize: 10.5 }}>
              Autosaves as you type · ⌘↵ publishes · {f.rent ? inr(f.rent) : "no rent yet"}
            </span>
          </div>
        </div>
      </div>

      <Toast {...(toast ?? {})} />
    </div>
  );
}
