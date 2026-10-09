/**
 * Single-page property upload. No wizard, no "next".
 *
 * The public List My Flat flow is a guided story for an owner listing once. This
 * is the opposite: three columns, every field on screen, tab straight through,
 * ⌘↵ to publish. Same `inventory` table, same MZ- code.
 *
 * The same form edits an existing listing (/crm/properties/:propertyId/edit).
 * Editing is not a second screen because it is not a different job — the fields
 * are the fields. What changes in edit mode: the row is loaded in, the MZ- code
 * and the poster it belongs to are left alone, photos already on the listing can
 * be removed or added to, and the listing's status becomes editable.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCrm } from "./CrmShell";
import PropertyVisitSlots from "../../components/PropertyVisitSlots";
import { InternalDetails, VisitWindow } from "./CrmPropertyInternalFields";
import CrmPartnerFields from "./CrmPartnerFields";
import CrmOwnerFields from "./CrmOwnerFields";
import CrmFlatQr from "./CrmFlatQr";
import { fetchPartnerListingMap } from "../../lib/partners";
import {
  ALL_LOCALITIES, DEFAULT_POSTING_AMENITIES, FLAT_TYPES, FURNISHINGS, LIFESTYLE, MUST_HAVES, OCCUPANT_OPTIONS,
  parentAreaOf, withParentArea,
} from "../../data/preferenceOptions";
import { cleanSourceUrl, detectSource, parseListingText } from "../../lib/listingImport";
import { geocodePlace } from "../../lib/geocode";
import {
  generatePropertyId, isMissingColumn, mediaRejectionReason,
  PUBLIC_INVENTORY_COLS, withoutOptionalColumns,
} from "../../lib/inventory";
import {
  coverPhoto, describeMedia, isListingMediaFile, isVideoUrl, orderListingMedia,
} from "../../lib/listingMedia";
import { matchListingToRequirements } from "../../lib/inventoryMatch";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { SCOPES } from "../../lib/adminScopes";
import {
  BLANK_INTERNAL, fetchBuildingOptions, fetchInternal, fetchPropertyLinks, hasInternalDetail, probeInternalTables,
  saveCrmBuilding, saveInternal, setCrmFlatBuilding,
} from "../../lib/crmPropertyInternal";
import { DEFAULT_VISIT_RULE, applyVisitRule, rememberVisitRule } from "../../lib/visitSchedule";
import { isVideoItem, newItem, orderMediaItems, releaseItems, savedItems, uploadMediaItemsKeyed } from "../../lib/mediaItems";
import PhotoReview from "../../components/PhotoReview";
import { initialCoverFor, keptCover, photosChanged, savedCoverUrl } from "../../lib/photoReview";
import { autoDepositHint } from "../../lib/deposit";
import { moveByKey, useDragReorder } from "../../hooks/useDragReorder";
import { Btn, C, Chip, Empty, Toast, inr } from "./crmUi";

const BLANK = {
  area: "", nearby_areas: [], full_address: "", landmark: "",
  latitude: "", longitude: "",
  rent: "", deposit: "", maintenance: "", available_from: "",
  flat_type: "", bedrooms: "", bathrooms: "", floor_number: "", total_floors: "", furnishing: "",
  max_flatmates: "", gender_pref: "any",
  occupants_allowed: [], amenities: [...DEFAULT_POSTING_AMENITIES], lifestyle: [], house_rules: [],
  poster_name: "", phone: "", posted_by: "owner",
  title: "", description: "", source_url: "", status: "published",
  partner_visible: true, partner_share_pct: 50,
};

const DRAFT_KEY = "moveazy_crm_property_draft";

const STATUSES = ["published", "paused", "rented"];
const GENDER_PREFS = [["any", "Co-ed / Any"], ["female", "Girls only"], ["male", "Boys only"]];
// Same wording the owner sees in the public List My Flat flow, so a listing
// corrected here reads identically to one posted there.
const HOUSE_RULES = [
  "No Smoking", "No Pets", "No Alcohol", "Vegetarians Only",
  "Working Professionals Only", "No Brokerage", "Fully Furnished",
];

/** A DB row → the form's shape. Nulls become "", arrays stay arrays, and the
 *  date arrives as a timestamp that <input type="date"> won't accept. */
function rowToForm(row) {
  const list = (v) => (Array.isArray(v) ? v : []);
  return {
    area: row.area ?? "",
    nearby_areas: list(row.nearby_areas),
    full_address: row.full_address ?? "",
    landmark: row.landmark ?? "",
    latitude: row.latitude ?? "",
    longitude: row.longitude ?? "",
    rent: row.rent ?? "",
    // An automatic deposit (3.5 × rent) shows as blank, with the figure as
    // its placeholder: left blank it keeps following the rent.
    deposit: row.deposit_auto ? "" : (row.deposit ?? ""),
    maintenance: row.maintenance ?? "",
    available_from: String(row.available_from ?? "").slice(0, 10),
    flat_type: row.flat_type ?? "",
    bedrooms: row.bedrooms ?? "",
    bathrooms: row.bathrooms ?? "",
    floor_number: row.floor_number ?? "",
    total_floors: row.total_floors ?? "",
    furnishing: row.furnishing ?? "",
    max_flatmates: row.max_flatmates ?? "",
    gender_pref: row.gender_pref || "any",
    occupants_allowed: list(row.occupants_allowed),
    amenities: list(row.amenities),
    lifestyle: list(row.lifestyle),
    house_rules: list(row.house_rules),
    poster_name: row.poster_name ?? "",
    phone: row.phone ?? "",
    posted_by: row.posted_by || "owner",
    title: row.title ?? "",
    description: row.description ?? "",
    source_url: row.source_url ?? "",
    status: row.status || "published",
    partner_visible: row.partner_visible !== false,
    partner_share_pct: row.partner_share_pct ?? 50,
  };
}

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
  const { access, user, requirements, reload, inventory } = crm;
  const navigate = useNavigate();
  const { propertyId: editId } = useParams();
  const isEdit = Boolean(editId);

  const [f, setF] = useState(() => {
    // A saved draft belongs to the *new listing* form. Restoring it over a
    // listing being edited would quietly overwrite real data with someone
    // else's half-typed flat.
    if (editId) return BLANK;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...BLANK, ...JSON.parse(saved) } : BLANK;
    } catch {
      return BLANK;
    }
  });
  const [pasteText, setPasteText] = useState("");
  const [importInfo, setImportInfo] = useState(null);
  // Every photo and video, in the order renters will see them: those already
  // on the listing ({ url }) and those picked just now ({ url: preview, file }),
  // in one list so either can be dragged anywhere (lib/mediaItems.js).
  const [media, setMedia] = useState([]);
  // The photos and cover as saved, to tell whether the poster changed them
  // (the review screen opens only then) and to keep a framed cover.
  const saved = useRef({ images: [], cover: "" });
  const [reviewing, setReviewing] = useState(false);
  const keptImages = useMemo(() => media.filter((m) => !m.file).map((m) => m.url), [media]);
  const newCount = media.filter((m) => m.file).length;
  const mediaRef = useRef(media);
  mediaRef.current = media;
  useEffect(() => () => releaseItems(mediaRef.current), []);
  const replaceMedia = (next) => setMedia((cur) => { releaseItems(cur); return next; });
  const [loaded, setLoaded] = useState(!editId);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [published, setPublished] = useState(null);
  /**
   * Internal details, kept apart from `f` on purpose.
   *
   * They are a different row in a different table with a different audience,
   * and the draft autosave writes `f` to localStorage — a POC's number has no
   * business sitting in browser storage after the upload is done.
   */
  const [internal, setInternal] = useState({ ...BLANK_INTERNAL });
  /** The building this flat is one unit of: { id } an existing one, or { id: "", newName } a new one (crm_onboarding.sql). */
  const [building, setBuilding] = useState({ id: "" });
  const [buildingOptions, setBuildingOptions] = useState([]);
  /** On an edit: who has this flat now — the owner account, the partner, the building. */
  const [links, setLinks] = useState(null);
  const reloadBuildingOptions = useCallback(() => fetchBuildingOptions().then(setBuildingOptions, () => {}), []);
  useEffect(() => { reloadBuildingOptions(); }, [reloadBuildingOptions]);
  useEffect(() => {
    if (!isEdit) return;
    fetchPropertyLinks(editId).then((l) => {
      setLinks(l);
      if (l?.building?.id) setBuilding({ id: l.building.id, unitNo: (inventory ?? []).find((x) => x.property_id === editId)?.unit_no || "" });
    }, () => setLinks(null));
    // Again after a save reloads the inventory: the house number shown is the saved one.
  }, [isEdit, editId, inventory]);
  /** Set when the flat came from the partner app: who added it, how they shared it. */
  const [partnerInfo, setPartnerInfo] = useState(null);
  useEffect(() => {
    if (!isEdit) return;
    fetchPartnerListingMap([editId]).then((m) => setPartnerInfo(m[editId] ?? null), () => setPartnerInfo(null));
  }, [isEdit, editId]);
  /**
   * What a new listing is published with. Every day, 8am to 8pm, unless the
   * agent narrows it: a flat with no bookable time offers a tenant only "next
   * available slot", which is a message for somebody to answer by hand.
   */
  const [visitRule, setVisitRule] = useState({ ...DEFAULT_VISIT_RULE });
  /** "checking" | "ok" | "missing" | "denied" — whether the panel can save at all. */
  const [internalAvailability, setInternalAvailability] = useState("checking");
  const dropRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await probeInternalTables();
      if (!cancelled) setInternalAvailability(status);
    })();
    return () => { cancelled = true; };
  }, []);

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
  // Only for a new listing: an edit is already saved, in the database.
  useEffect(() => {
    if (isEdit) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    } catch { /* private mode */ }
  }, [f, isEdit]);

  /**
   * The internal row, when editing.
   *
   * A separate fetch rather than part of the listing load: it is a separate
   * table, and a listing uploaded before this existed simply has no row — which
   * is the blank form, not an error.
   */
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      const row = await fetchInternal(editId);
      if (cancelled || !row) return;
      setInternal({
        source: row.source || "owner",
        broker_id: row.broker_id || "",
        poc_name: row.poc_name || "",
        poc_phone: row.poc_phone || "",
        poc_email: row.poc_email || "",
        poc_note: row.poc_note || "",
        // An older listing was never asked: "no" is the honest answer for it.
        owner_onboarded: row.owner_onboarded === true,
        multi_unit: row.multi_unit === true,
        owner_email: row.owner_email || "",
        owner_phone: row.owner_phone || "",
      });
    })();
    return () => { cancelled = true; };
  }, [editId]);

  /* ── Load the listing being edited ─────────────────────────────────────── */

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      // The shell has already loaded every listing; go to the network only if
      // this one isn't among them (a direct link, or a listing added since).
      const cached = (inventory ?? []).find((l) => l.property_id === editId);
      if (cached) {
        setF(rowToForm(cached));
        setMedia(savedItems(cached.images));
        saved.current = { images: cached.images ?? [], cover: cached.cover_image_url || "" };
        setLoaded(true);
        return;
      }
      if (!isSupabaseConfigured || !supabase) {
        setLoadError("Supabase is not configured.");
        setLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .rpc("inventory_full").select("*").eq("property_id", editId).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadError(error?.message || `No listing with the id ${editId}.`);
      } else {
        setF(rowToForm(data));
        setMedia(savedItems(data.images));
        saved.current = { images: data.images ?? [], cover: data.cover_image_url || "" };
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
    // inventory is a dependency in name only — refetching on every shell reload
    // would throw away edits in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

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
      const files = [...(e.clipboardData?.files ?? [])].filter(isListingMediaFile);
      if (files.length) {
        e.preventDefault();
        setMedia((cur) => [...cur, ...files.slice(0, Math.max(0, 20 - cur.filter((m) => m.file).length)).map(newItem)]);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer?.files);
  };

  /** One way in for every source — drop, paste, picker — so the size limits and
   *  the "photos and video" rule can't differ between them. */
  const addFiles = (fileList) => {
    const picked = [...(fileList ?? [])].filter(isListingMediaFile);
    const rejected = picked.map(mediaRejectionReason).filter(Boolean);
    if (rejected.length) showToast(rejected[0], "error");
    const ok = picked.filter((x) => !mediaRejectionReason(x));
    if (ok.length) setMedia((cur) => [...cur, ...ok.slice(0, Math.max(0, 20 - cur.filter((m) => m.file).length)).map(newItem)]);
  };

  /* ── Ordering: drag a photo (old or new) anywhere ───────────────────────── */

  // Every change is normalised straight away, so the grid an admin is looking
  // at is the order a renter gets — no save-and-see-what-happens.
  const moveMedia = (fromKey, toKey) =>
    setMedia((cur) => orderMediaItems(moveByKey(cur, fromKey, toKey, (m) => m.key)));
  const moveMediaBy = (i, d) => {
    const to = media[i + d];
    if (to) moveMedia(media[i].key, to.key);
  };
  const removeMedia = (key) => setMedia((cur) => {
    const hit = cur.find((m) => m.key === key);
    if (hit) releaseItems([hit]);
    return cur.filter((m) => m.key !== key);
  });
  const sort = useDragReorder(moveMedia);

  /* ── Publish ───────────────────────────────────────────────────────────── */

  const missingRequired = useMemo(() => {
    const need = [];
    if (!f.area) need.push("Locality");
    if (!f.rent) need.push("Rent");
    if (!f.flat_type) need.push("Flat type");
    if (!f.furnishing) need.push("Furnishing");
    // Asked on every new upload; an edit of an older listing is never blocked on them.
    if (!isEdit && internal.owner_onboarded == null) need.push("Owner onboarded?");
    if (!isEdit && internal.multi_unit == null) need.push("Multiple units?");
    if (internal.multi_unit === true && !building.id && !String(building.newName || "").trim()) need.push("Building");
    return need;
  }, [f, internal, building, isEdit]);

  /**
   * Write the internal row for a listing that now exists.
   *
   * Never fails the upload. A listing that saved and whose POC did not is a
   * listing to correct; throwing here would lose the whole upload over a
   * second table.
   */
  const writeInternal = useCallback(async (propertyId, { toast = true } = {}) => {
    const res = await saveInternal(propertyId, internal, user?.email || "");
    if (!res.ok && toast) {
      showToast(res.missingTable
        ? "Listing saved, but NOT the internal details — run crm_property_internal.sql"
        : `Listing saved, but NOT the internal details: ${res.error?.message || "unknown error"}`, "error");
    }
    if (res.missingTable) setInternalAvailability("missing");
    return res;
  }, [internal, user]);

  // `rev`: what the review screen settled — the order and the framed cover.
  const publish = useCallback(async (rev) => {
    if (!canWrite) return;
    if (missingRequired.length) return showToast(`Still needed: ${missingRequired.join(", ")}`, "error");
    if (!isSupabaseConfigured || !supabase) return showToast("Supabase is not configured", "error");

    setSaving(true);
    try {
      const propertyId = isEdit ? editId : generatePropertyId();
      const skipped = [];
      // In the order on screen (or as arranged on the review screen): old and new photos together.
      const list = rev ? rev.order.map((k) => media.find((m) => m.key === k)).filter(Boolean) : media;
      const keyed = await uploadMediaItemsKeyed(list, propertyId, undefined,
        (file, why) => skipped.push(`${file.name || "A file"}: ${why}`));
      if (skipped.length) showToast(`${skipped.length} file not uploaded — ${skipped[0]}`, "error");
      const images = orderListingMedia(keyed.map((x) => x.url));
      const chosen = rev?.cover ? list.find((m) => m.key === rev.cover.key) : null;
      const coverUrl = chosen
        ? (await savedCoverUrl({
          cover: rev.cover, source: chosen.file || chosen.url, folder: propertyId,
          finalUrl: keyed.find((x) => x.key === chosen.key)?.url, existingCoverUrl: saved.current.cover,
        })) || coverPhoto(images)
        : keptCover(saved.current.cover, images);
      const sourceUrl = cleanSourceUrl(f.source_url);

      // Resolve a pin from whatever address detail there is, most specific
      // first. A locality centre is a worse pin than a street address, and a
      // far better one than none.
      let coords = { lat: Number(f.latitude) || null, lng: Number(f.longitude) || null };
      if (coords.lat == null || coords.lng == null) {
        for (const q of [
          [f.full_address, f.area, "Bengaluru"].filter(Boolean).join(", "),
          [f.landmark, f.area, "Bengaluru"].filter(Boolean).join(", "),
          [f.area, "Bengaluru"].filter(Boolean).join(", "),
        ]) {
          if (!q) continue;
          try {
            const hit = await geocodePlace(q);
            if (hit?.ok && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
              coords = { lat: hit.lat, lng: hit.lng };
              break;
            }
          } catch { /* try the next, less specific, query */ }
        }
      }

      const row = {
        property_id: propertyId,
        posted_by: f.posted_by || "owner",
        poster_id: user?.uid ?? null,
        poster_name: f.poster_name || "",
        poster_email: user?.email || "",
        phone: f.phone || "",
        city: "Bengaluru",
        area: f.area,
        // A flat in Kudlu Gate is also in HSR Extension, so a client asking
        // for the wider area finds it. The area keeps the precise name.
        nearby_areas: withParentArea(f.area, f.nearby_areas ?? []),
        full_address: f.full_address || "",
        landmark: f.landmark || "",
        // Without these the listing is published but invisible: the map's feed
        // drops anything it can't plot, so a flat added here never appeared and
        // the links this CRM sent opened an empty map.
        latitude: coords.lat,
        longitude: coords.lng,
        rent: Number(f.rent) || 0,
        deposit: Number(f.deposit) || 0,
        // Blank stays null: "not stated" is not "zero".
        maintenance: String(f.maintenance).trim() === "" ? null : Number(f.maintenance) || 0,
        available_from: f.available_from || null,
        flat_type: f.flat_type,
        bedrooms: Number(f.bedrooms) || 1,
        bathrooms: Number(f.bathrooms) || 1,
        // Null, not 0 — the ground floor is a real answer.
        floor_number: String(f.floor_number).trim() === "" ? null : Number(f.floor_number),
        total_floors: String(f.total_floors).trim() === "" ? null : Number(f.total_floors),
        furnishing: f.furnishing,
        max_flatmates: Number(f.max_flatmates) || 0,
        gender_pref: f.gender_pref || "any",
        occupants_allowed: f.occupants_allowed ?? [],
        amenities: f.amenities ?? [],
        lifestyle: f.lifestyle ?? [],
        house_rules: f.house_rules ?? [],
        title: f.title || `${f.flat_type} in ${f.area}`,
        description: f.description || "",
        images,
        cover_image_url: coverUrl,
        status: isEdit ? (f.status || "published") : "published",
        source: sourceUrl ? detectSource(sourceUrl) : "crm",
        source_url: sourceUrl,
      };
      // Sent only once changed from the column defaults, so publishing still
      // works on a database that hasn't run partner_schema.sql yet.
      if (f.partner_visible === false || Number(f.partner_share_pct ?? 50) !== 50 || isEdit) {
        row.partner_visible = f.partner_visible !== false;
        row.partner_share_pct = Number(f.partner_share_pct ?? 50);
      }

      if (coords.lat == null || coords.lng == null) {
        showToast("Couldn't place this address on the map — add coordinates or it won't show", "error");
      }

      // One unit of a building: put it there (making the building first if it's new).
      // Never fails the upload — a flat that saved and whose building didn't is one to fix.
      const applyBuilding = async (pid) => {
        try {
          const contact = {
            owner_email: String(internal.owner_email || "").trim().toLowerCase(),
            owner_phone: String(internal.owner_phone || "").trim(),
          };
          const hasContact = Boolean(contact.owner_email || contact.owner_phone);
          if (internal.multi_unit === true) {
            let id = building.id;
            if (!id && String(building.newName || "").trim()) {
              const made = await saveCrmBuilding({
                name: building.newName.trim(), area: f.area, landmark: f.landmark || "", full_address: f.full_address || "",
                latitude: coords.lat ?? "", longitude: coords.lng ?? "", total_floors: String(f.total_floors ?? ""),
                ...(hasContact ? contact : {}),
              });
              id = made?.id;
              if (id) setBuilding({ id });
            } else if (id && hasContact) {
              const opt = buildingOptions.find((b) => b.id === id);
              if (opt && !opt.owner_joined && !opt.owner_email && !opt.owner_phone) await saveCrmBuilding({ id, ...contact });
            }
            if (id) await setCrmFlatBuilding(pid, id, null, String(building.unitNo || "").trim());
          } else if (internal.multi_unit === false && links?.building) {
            await setCrmFlatBuilding(pid, null, null);
          }
          reloadBuildingOptions();
          fetchPropertyLinks(pid).then(setLinks, () => {});
        } catch (e) {
          showToast(`Listing saved, but not its building: ${e?.message || "unknown error"}`, "error");
        }
      };

      if (isEdit) {
        // The MZ- code identifies the listing and the poster owns it — an edit
        // changes neither, whoever is doing the editing. Everything else in the
        // row is the poster's to change and ours to correct.
        const changes = { ...row, updated_at: new Date().toISOString() };
        delete changes.property_id;
        delete changes.poster_id;
        delete changes.poster_email;
        // Only what the form needs back: `returning *` would ask for the
        // poster's contact columns, which the table no longer hands out.
        let { data, error } = await supabase
          .from("inventory").update(changes).eq("property_id", editId).select("property_id,images").single();
        // A column a pending migration hasn't added must not block an edit to
        // the fifteen fields that do exist.
        if (error && isMissingColumn(error)) {
          console.warn(`[crm] update: ${error.message} — saving without it. Run the pending migration.`);
          ({ data, error } = await supabase
            .from("inventory").update(withoutOptionalColumns(changes)).eq("property_id", editId)
            .select("property_id,images").single());
        }
        if (error) throw error;
        replaceMedia(savedItems(data.images));
        saved.current = { images: data.images ?? [], cover: coverUrl };
        await writeInternal(editId);
        await applyBuilding(editId);
        reload();
        showToast(`${editId} saved`);
        return;
      }

      const { data, error } = await supabase.from("inventory").insert(row).select(PUBLIC_INVENTORY_COLS).single();
      if (error) throw error;

      // Both of these key on a property_id that did not exist a moment ago,
      // which is why they run here and not with the rest of the form.
      // Skipped when nothing was entered, so a listing with no POC doesn't get
      // an empty row — and doesn't report a failure nobody cares about.
      const internalResult = hasInternalDetail(internal) || internal.source !== "owner"
        ? await writeInternal(propertyId, { toast: false })
        : null;
      await applyBuilding(propertyId);
      if (visitRule.mode !== "none") {
        const { added, failed } = await applyVisitRule(propertyId, visitRule);
        // Remembered so the rolling window keeps topping itself up, exactly as
        // it would if an agent had set it from the property's own panel.
        rememberVisitRule(propertyId, visitRule);
        if (failed && !added) {
          showToast("Listing published, but the visit times didn't save — add them from the listing", "error");
        }
      }

      // Who was waiting for exactly this? The same engine, run the other way.
      const matches = matchListingToRequirements(data, requirements, { min: 60 });
      setPublished({ listing: data, matches, internalResult });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      replaceMedia([]);
      reload();
    } catch (e) {
      showToast(e?.message || (isEdit ? "Could not save" : "Could not publish"), "error");
    } finally {
      setSaving(false);
    }
  }, [canWrite, missingRequired, f, media, user, requirements, reload, isEdit, editId,
      writeInternal, visitRule, internal, building, buildingOptions, links, reloadBuildingOptions]);

  const reviewItems = useMemo(
    () => media.map((m) => ({ key: m.key, src: m.url, isVideo: isVideoItem(m), file: m.file })),
    [media],
  );
  const coverKey = useMemo(
    () => initialCoverFor(reviewItems, saved.current.cover)?.key ?? reviewItems.find((m) => !m.isVideo)?.key,
    [reviewItems],
  );
  /**
   * Publish, by way of the review screen when there are photos the poster
   * hasn't arranged yet: a new listing's, or an edit that added, removed or
   * reordered any. A text-only edit saves straight away.
   */
  const requestPublish = useCallback(() => {
    if (!canWrite) return;
    if (missingRequired.length) return showToast(`Still needed: ${missingRequired.join(", ")}`, "error");
    const hasPhotos = reviewItems.some((m) => !m.isVideo);
    if (hasPhotos && photosChanged(reviewItems, saved.current.images)) setReviewing(true);
    else publish();
  }, [canWrite, missingRequired, reviewItems, publish]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !reviewing) { e.preventDefault(); requestPublish(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestPublish, reviewing]);

  if (!canWrite) {
    return <Empty>You don't have permission to add or change listings.</Empty>;
  }

  if (isEdit && !loaded) return <Empty>Loading {editId}…</Empty>;
  if (loadError) {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <p style={{ fontSize: 13.5, color: C.text, margin: 0 }}>{loadError}</p>
        <Btn onClick={() => navigate("/crm/properties")}>Back to properties</Btn>
      </div>
    );
  }

  if (published) {
    return (
      <div style={{ padding: 24, maxWidth: 620, display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          {published.listing.property_id} is live
        </h1>
        {/* Stays on screen until it is dealt with. This screen replaces the
            form, so a toast here was never seen — a failed POC save looked
            identical to a good one. The typed details are still in state, so
            Retry writes exactly what was entered. */}
        {published.internalResult && !published.internalResult.ok && (
          <div role="alert" style={{
            padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.coral}`,
            background: "#FDF1EE", display: "flex", flexDirection: "column", gap: 8,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.coral }}>
              The internal details (property via / POC) were not saved.
            </span>
            <span style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
              {published.internalResult.missingTable
                ? "The table for them doesn't exist yet — run crm_property_internal.sql in Supabase, then press Retry. Don't leave this screen first or what you typed is gone."
                : published.internalResult.error?.message || "The save was refused."}
            </span>
            <div>
              <Btn sm variant="primary" onClick={async () => {
                const res = await writeInternal(published.listing.property_id, { toast: false });
                setPublished((cur) => (cur ? { ...cur, internalResult: res } : cur));
              }}>
                Retry saving POC
              </Btn>
            </div>
          </div>
        )}
        {published.internalResult?.ok && (
          <span className="crm-mute" style={{ fontSize: 12 }}>Internal details saved.</span>
        )}
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
          <Btn variant="primary" onClick={() => {
            setPublished(null); setF(BLANK); setImportInfo(null); setPasteText("");
            // Otherwise the last flat's POC is saved against the next one.
            setInternal({ ...BLANK_INTERNAL });
            setBuilding({ id: "" }); setLinks(null);
            setVisitRule({ ...DEFAULT_VISIT_RULE });
          }}>
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
        <span className="crm-label">{isEdit ? `Editing ${editId}` : "New property"}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {missingRequired.length > 0 && (
            <span className="crm-mute" style={{ fontSize: 11 }}>Needs: {missingRequired.join(", ")}</span>
          )}
          {isEdit && <Btn onClick={() => navigate("/crm/properties")}>Back to properties</Btn>}
          <Btn variant="primary" onClick={requestPublish} disabled={saving}>
            {saving ? (isEdit ? "Saving…" : "Publishing…") : (isEdit ? "Save changes" : "Publish")}
          </Btn>
        </div>
      </div>

      <div className="crm-scroll" style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) minmax(260px,1fr) minmax(240px,300px)" }}>
          {/* ── where ── */}
          <Column title="Where it is">
            {isEdit ? (
              <Field label="Status" hint="Paused and rented listings stop appearing on the public map.">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUSES.map((x) => (
                    <Chip key={x} on={f.status === x} onClick={() => set({ status: x })}>{x}</Chip>
                  ))}
                </div>
              </Field>
            ) : (
              <>
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
              </>
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

            {parentAreaOf(f.area) && (
              <span className="crm-mute" style={{ fontSize: 10.5, lineHeight: 1.45 }}>
                Also counted as <strong>{parentAreaOf(f.area)}</strong>, so a client
                asking for the wider area sees this flat.
              </span>
            )}

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

            <Field
              label="Map pin"
              hint="Found from the address when you save. A listing without one is published but never appears on the map."
            >
              <div style={{ display: "flex", gap: 6 }}>
                <input className="crm-input crm-num" value={f.latitude} inputMode="decimal"
                  onChange={(e) => set({ latitude: e.target.value })} placeholder="Latitude" />
                <input className="crm-input crm-num" value={f.longitude} inputMode="decimal"
                  onChange={(e) => set({ longitude: e.target.value })} placeholder="Longitude" />
              </div>
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
                  onChange={(e) => set({ deposit: e.target.value })} placeholder={autoDepositHint(f.rent)} />
              </Field>
              <Field label="Maintenance" hint="Blank if the owner didn't quote one.">
                <input className="crm-input crm-num" type="number" inputMode="numeric" value={f.maintenance}
                  onChange={(e) => set({ maintenance: e.target.value })} placeholder="Optional" />
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
              <Field label="Floor" hint="0 is the ground floor. Blank if the owner didn't say.">
                <input className="crm-input crm-num" type="number" min="0" value={f.floor_number}
                  onChange={(e) => set({ floor_number: e.target.value })} placeholder="Optional" />
              </Field>
              <Field label="Floors in building">
                <input className="crm-input crm-num" type="number" min="0" value={f.total_floors}
                  onChange={(e) => set({ total_floors: e.target.value })} placeholder="Optional" />
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Field label="Flatmates" hint="0 for a whole unit">
                <input className="crm-input crm-num" type="number" min="0" value={f.max_flatmates}
                  onChange={(e) => set({ max_flatmates: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Preferred gender">
                <select className="crm-input" value={f.gender_pref}
                  onChange={(e) => set({ gender_pref: e.target.value })}>
                  {GENDER_PREFS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Occupants allowed">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {OCCUPANT_OPTIONS.map((o) => (
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

            <Field label="Neighbourhood">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LIFESTYLE.map((x) => (
                  <Chip key={x} on={(f.lifestyle ?? []).includes(x)} onClick={() => toggle("lifestyle", x)}>
                    {x}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="House rules">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {HOUSE_RULES.map((x) => (
                  <Chip key={x} on={(f.house_rules ?? []).includes(x)} onClick={() => toggle("house_rules", x)}>
                    {x}
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
              Drag photos or a video here
              <br />
              <span style={{ color: C.textMute }}>or press ⌘V to paste from the owner's chat</span>
              <input type="file" multiple hidden
                accept="image/*,video/*"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {media.length > 0 && (
              <>
                <span className="crm-mute" style={{ fontSize: 10.5, lineHeight: 1.45 }}>
                  {describeMedia(media.map((m) => (isVideoItem(m) ? "x.mp4" : "x.jpg")))}
                  {newCount > 0 && ` · ${newCount} new, uploaded when you ${isEdit ? "save" : "publish"}`} · drag to reorder, × to remove.
                  Photos always come first and a video sits after the fourth photo, so a video
                  dragged higher settles back there.
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {media.map((m, i) => {
                    const video = isVideoItem(m);
                    return (
                      <div
                        key={m.key}
                        {...sort.bind(m.key)}
                        style={{
                          position: "relative", aspectRatio: "1", borderRadius: 6, overflow: "hidden",
                          border: `1px solid ${m.file ? C.accent : C.line}`, background: C.surface,
                          ...sort.dragStyle(m.key),
                        }}
                      >
                        {video ? (
                          <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                                 muted playsInline preload="metadata" />
                        ) : (
                          <img src={m.url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                        )}

                        <span style={{
                          position: "absolute", top: 2, left: 2, padding: "0 4px", borderRadius: 4,
                          background: "rgba(0,0,0,.62)", color: "#fff", fontSize: 9, fontWeight: 700,
                        }}>
                          {video ? "VIDEO" : m.key === coverKey ? "COVER" : i + 1}
                          {m.file ? " · NEW" : ""}
                        </span>

                        <button type="button" title="Remove" aria-label={`Remove item ${i + 1}`}
                          onClick={() => removeMedia(m.key)}
                          style={{
                            position: "absolute", top: 2, right: 2, width: 15, height: 15, borderRadius: "50%",
                            border: "none", background: "rgba(0,0,0,.62)", color: "#fff", fontSize: 11,
                            lineHeight: 1, padding: 0, cursor: "pointer",
                          }}>×</button>

                        {/* Keyboard reaches the same ordering the drag does. */}
                        <span style={{ position: "absolute", bottom: 2, left: 2, right: 2, display: "flex", gap: 2 }}>
                          <button type="button" aria-label={`Move item ${i + 1} earlier`} disabled={i === 0}
                            onClick={() => moveMediaBy(i, -1)}
                            style={{ flex: 1, background: "rgba(0,0,0,.62)", color: "#fff", border: "none", borderRadius: 3, fontSize: 10, cursor: "pointer", opacity: i === 0 ? 0.35 : 1 }}>←</button>
                          <button type="button" aria-label={`Move item ${i + 1} later`} disabled={i === media.length - 1}
                            onClick={() => moveMediaBy(i, 1)}
                            style={{ flex: 1, background: "rgba(0,0,0,.62)", color: "#fff", border: "none", borderRadius: 3, fontSize: 10, cursor: "pointer", opacity: i === media.length - 1 ? 0.35 : 1 }}>→</button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
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

            {/* Only on a new listing. Editing gets the full slots panel
                below, which shows what is already bookable — offering a
                "publish with" window there would be a second, contradictory
                answer to the same question. */}
            {!isEdit && (
              <Field title="Visit times">
                <VisitWindow value={visitRule} onChange={setVisitRule} />
              </Field>
            )}

            <CrmOwnerFields value={internal} onChange={setInternal} building={building} onBuilding={setBuilding}
              options={buildingOptions} links={links} floor={f.floor_number} />

            <CrmPartnerFields value={f} onChange={set} partnerInfo={partnerInfo} />

            <div style={{ marginTop: 4 }}>
              <InternalDetails
                value={internal}
                onChange={setInternal}
                actorEmail={user?.email || ""}
                availability={internalAvailability}
              />
            </div>

            <div style={{ display: "flex", gap: 7 }}>
              <Btn variant="primary" onClick={requestPublish} disabled={saving}>
                {saving ? (isEdit ? "Saving…" : "Publishing…") : (isEdit ? "Save changes" : "Publish")}
              </Btn>
              {isEdit ? (
                <Btn onClick={() => navigate("/crm/properties")}>Cancel</Btn>
              ) : (
                <Btn onClick={() => {
                  setF(BLANK); replaceMedia([]); setPasteText(""); setImportInfo(null);
                  setInternal({ ...BLANK_INTERNAL }); setVisitRule({ ...DEFAULT_VISIT_RULE }); setBuilding({ id: "" });
                }}>
                  Clear
                </Btn>
              )}
            </div>
            <span className="crm-mute" style={{ fontSize: 10.5 }}>
              {isEdit
                ? `⌘↵ saves · nothing changes until you do · ${f.rent ? inr(f.rent) : "no rent set"}`
                : `Autosaves as you type · ⌘↵ publishes · ${f.rent ? inr(f.rent) : "no rent yet"}`}
            </span>
          </div>
        </div>

        {/* Visit times. Only in edit mode: property_visit_slots keys on a
            property_id, so there has to be a listing before there can be a
            slot. A CRM manager needs crm_visit_slots.sql to write these — the
            component says so if the policy is missing. */}
        {isEdit && (
          <div style={{ padding: "0 16px 20px", maxWidth: 720 }}>
            <span className="crm-label">Open visit times</span>
            <p className="crm-mute" style={{ fontSize: 11.5, margin: "4px 0 10px", lineHeight: 1.5 }}>
              What a renter can book. Nothing here means the only way in is
              "next available slot", which lands on you to arrange by hand.
            </p>
            <PropertyVisitSlots propertyId={editId} hideMarkSold />
          </div>
        )}

        {/* The QR to paste on the door (or the building), its leads and renters' feedback. */}
        {isEdit && (
          <div style={{ padding: "0 16px 24px", maxWidth: 980 }}>
            <span className="crm-label">QR, leads &amp; feedback</span>
            <p className="crm-mute" style={{ fontSize: 11.5, margin: "4px 0 10px", lineHeight: 1.5 }}>
              Print the poster for the door or the building. Feedback saved here shows in the owner's app.
            </p>
            <CrmFlatQr
              flat={{
                property_id: editId, flat_type: f.flat_type, furnishing: f.furnishing, area: f.area, landmark: f.landmark,
                rent: f.rent, images: keptImages, cover_image_url: keptImages.find((u) => !isVideoUrl(u)) || "",
              }}
              building={links?.building || null}
              onToast={showToast}
            />
          </div>
        )}
      </div>

      {reviewing && (
        <PhotoReview
          items={reviewItems}
          initialCover={initialCoverFor(reviewItems, saved.current.cover)}
          confirmLabel={isEdit ? "Save" : "Publish"}
          busy={saving}
          onCancel={() => setReviewing(false)}
          onConfirm={async (rev) => {
            setMedia((cur) => rev.order.map((k) => cur.find((m) => m.key === k)).filter(Boolean));
            await publish(rev);
            setReviewing(false);
          }}
        />
      )}
      <Toast {...(toast ?? {})} />
    </div>
  );
}
