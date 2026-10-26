/**
 * CRM → Society prospects (MovEazy-BE/supabase/society_prospects.sql): the
 * gated societies around HSR the team means to bring on — never on the public
 * site until one is made live.
 *
 *   /crm/society-prospects       the map and the list, by road and by where
 *                                the team is with each (prospect → contacted
 *                                → interested → onboarded). The super admin
 *                                imports from Google here; anyone downloads
 *                                the brochures of what's on screen as a ZIP.
 *   /crm/society-prospects/:id   one society: status, last contacted, notes,
 *                                the people to call (office, manager, guards,
 *                                brokers, tenants), its amenities, facts,
 *                                rents and what's nearby ("to verify" until
 *                                ticked), photos, the brochure, and "Make
 *                                live" (a society building, linked).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Download, ExternalLink, MapPin, Phone, Trash2 } from "lucide-react";
import { useCrm } from "./CrmShell";
import { Btn, C, Chip, Empty, Loading, Toast, relTime, shortDate } from "./crmUi";
import { isSuperAdminEmail, SCOPES } from "../../lib/adminScopes";
import {
  CONTACT_KINDS, ROADS, STATUSES, fetchProspect, fetchProspects, importProspects, importRows, prospectError,
  removeProspectContact, rentRange, roadLabel, saveProspect, saveProspectContact, statusOf, sweepGoogle, sweepCells,
} from "../../lib/societyProspects";
import { brochureAssets, brochureFileName, brochurePdf, drawBrochurePage } from "../../lib/societyBrochure";
import { zipStore } from "../../lib/zipStore";
import { fetchGooglePlace, googlePhotoUri } from "../../lib/society";
import { uploadInventoryPhotos } from "../../lib/inventory";
import { saveCrmBuilding } from "../../lib/crmPropertyInternal";
import logoOnLight from "../../assets/logo/moveazy-logo-mint-light.png";

const ProspectsMap = lazy(() => import("./ProspectsMap"));

const BASE = "/crm/society-prospects";
// The areas list's name for each road, for the building "Make live" creates.
const ROAD_AREA = { hsr: "HSR", sarjapur: "Sarjapur", haralur: "Harlur Road", silver: "Silver County Road", hosa: "Hosa Road", kudlu: "Kudlu Road" };
const NEARBY = [["schools", "Schools"], ["hospitals", "Hospitals"], ["supermarkets", "Groceries & malls"], ["transit", "Metro & bus"]];
const FACT_FIELDS = [
  ["builder", "Builder", "text"], ["year_built", "Year built", "number"], ["towers", "Towers", "number"],
  ["total_flats", "Total flats", "number"], ["floors", "Floors", "number"], ["maintenance", "Maintenance", "text"],
];
const RULES = [["families", "Families"], ["bachelors", "Bachelors"], ["pets", "Pets"]];

const label = { fontSize: 11.5, fontWeight: 700, color: C.textMute, display: "block", marginBottom: 4 };
const card = { border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, background: C.bg };

function StatusDot({ status, size = 9 }) {
  return <span style={{ width: size, height: size, borderRadius: 99, background: statusOf(status).color, display: "inline-block", flexShrink: 0 }} />;
}

function useToast() {
  const [toast, setToast] = useState(null);
  const say = useCallback((message, tone = "ok") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3600); }, []);
  return [toast, say];
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** A society's brochure pictures: its own photo, else Google's first (with its credit). */
async function assetsFor(s) {
  let googlePhoto = null;
  if (!(s.photos || []).length && s.place_id) {
    const g = await fetchGooglePlace(s.place_id);
    const first = g?.photos?.[0];
    if (first) googlePhoto = { uri: await googlePhotoUri(first.name, 1600), attribution: first.attribution };
  }
  return brochureAssets(s, { googlePhoto, logoSrc: logoOnLight });
}

/* ── The list and the map ─────────────────────────────────────────────────── */

function List() {
  const { access } = useCrm();
  const navigate = useNavigate();
  const superAdmin = isSuperAdminEmail(access.email);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [road, setRoad] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("active");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [job, setJob] = useState(null); // { label, done, total }
  const [preview, setPreview] = useState(null); // import rows waiting for a yes
  const [toast, say] = useToast();

  const load = useCallback(() => fetchProspects().then((d) => { setRows(d ?? []); setErr(""); }, (e) => setErr(prospectError(e))), []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (view === "hidden" ? r.hidden : !r.hidden)
      && (view !== "verify" || (r.researched && !r.verified))
      && (view !== "unresearched" || !r.researched)
      && (road === "all" || r.road === road)
      && (status === "all" || r.status === status)
      && (!needle || `${r.name} ${r.area}`.toLowerCase().includes(needle)));
  }, [rows, road, status, view, q]);
  const count = (pred) => (rows ?? []).filter((r) => !r.hidden && pred(r)).length;

  const runImport = async () => {
    const cells = sweepCells().length;
    if (!window.confirm(`Search Google Maps for societies along all six roads?\n\nThat is ${cells} small areas — about ${Math.round(cells * 1.6)} Google searches, normally inside Google's free monthly allowance. Nothing is saved until you check the result.`)) return;
    setJob({ label: "Searching Google Maps", done: 0, total: cells });
    try {
      const { results, failed } = await sweepGoogle((done, total) => setJob({ label: "Searching Google Maps", done, total }));
      const found = importRows(results);
      const known = new Set((rows ?? []).map((r) => r.place_id));
      setPreview({ rows: found, fresh: found.filter((r) => !known.has(r.place_id)).length, failed });
    } catch (e) {
      say(prospectError(e), "error");
    } finally {
      setJob(null);
    }
  };
  const saveImport = async () => {
    const list = preview.rows;
    setPreview(null);
    setJob({ label: "Saving", done: 0, total: list.length });
    try {
      const r = await importProspects(list, (done, total) => setJob({ label: "Saving", done, total }));
      say(`${r.added} new societies added${r.updated ? `, ${r.updated} refreshed` : ""}.`);
      await load();
    } catch (e) {
      say(prospectError(e), "error");
    } finally {
      setJob(null);
    }
  };

  const zipAll = async () => {
    const list = shown.filter((r) => !r.hidden);
    if (!list.length) return;
    if (list.length > 40 && !window.confirm(`Make ${list.length} brochures? It takes a few seconds each.`)) return;
    setJob({ label: "Making brochures", done: 0, total: list.length });
    const files = [];
    const names = new Set();
    try {
      let next = 0;
      const worker = async () => {
        while (next < list.length) {
          const s = await fetchProspect(list[next++].id);
          const pdf = await brochurePdf(s, await assetsFor(s));
          let name = brochureFileName(s.name);
          for (let i = 2; names.has(name); i++) name = brochureFileName(`${s.name} (${i})`);
          names.add(name);
          files.push({ name, data: new Uint8Array(await pdf.arrayBuffer()) });
          setJob({ label: "Making brochures", done: files.length, total: list.length });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const tag = road === "all" ? "All roads" : roadLabel(road);
      download(new Blob([zipStore(files)], { type: "application/zip" }), `MovEazy society brochures - ${tag}.zip`);
    } catch (e) {
      say(prospectError(e), "error");
    } finally {
      setJob(null);
    }
  };

  if (err) return <p style={{ color: "#EF4444" }}>{err}</p>;
  if (!rows) return <Loading />;

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {superAdmin && <Btn variant="primary" disabled={!!job} onClick={runImport}>{rows.length ? "Re-run Google import" : "Import from Google"}</Btn>}
        <Btn disabled={!!job || !shown.length} onClick={zipAll}><Download size={14} style={{ verticalAlign: -2 }} /> Brochures (ZIP) · {shown.filter((r) => !r.hidden).length}</Btn>
        <input className="crm-input" style={{ flex: "1 1 200px", minWidth: 0, maxWidth: 320 }} placeholder="Search a society or area" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search societies" />
      </div>

      {job && (
        <div style={{ ...card, display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{job.label}… {job.done} / {job.total}</div>
          <div style={{ height: 6, borderRadius: 99, background: C.lineSoft, overflow: "hidden" }}>
            <div style={{ width: `${job.total ? (job.done / job.total) * 100 : 0}%`, height: "100%", background: C.accent, transition: "width .2s" }} />
          </div>
        </div>
      )}

      {preview && (
        <div style={{ ...card, borderColor: C.accent, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Google found {preview.rows.length} societies — {preview.fresh} new.</div>
          <div className="crm-mute" style={{ fontSize: 12.5 }}>
            {ROADS.map((r) => `${r.label} ${preview.rows.filter((x) => x.road === r.key).length}`).join(" · ")}
            {preview.failed ? ` · ${preview.failed} areas didn't answer (run again later to fill them)` : ""}
          </div>
          <div style={{ maxHeight: 160, overflow: "auto", fontSize: 12.5, lineHeight: 1.6 }} className="crm-mute">
            {preview.rows.slice(0, 400).map((r) => r.name).join(" · ")}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={saveImport}>Save {preview.rows.length} societies</Btn>
            <Btn onClick={() => setPreview(null)}>Cancel</Btn>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip on={road === "all"} onClick={() => setRoad("all")}>All roads · {count(() => true)}</Chip>
        {ROADS.map((r) => <Chip key={r.key} on={road === r.key} onClick={() => setRoad(r.key)}>{r.label} · {count((x) => x.road === r.key)}</Chip>)}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip on={status === "all"} onClick={() => setStatus("all")}>Any status</Chip>
        {STATUSES.map((s) => (
          <Chip key={s.key} on={status === s.key} onClick={() => setStatus(s.key)}><StatusDot status={s.key} size={8} /> {s.label} · {count((x) => x.status === s.key)}</Chip>
        ))}
        <span style={{ width: 10 }} />
        {[["active", "On the list"], ["verify", `To verify · ${count((x) => x.researched && !x.verified)}`], ["unresearched", `Not researched · ${count((x) => !x.researched)}`], ["hidden", "Not societies"]].map(([k, l]) => (
          <Chip key={k} on={view === k} onClick={() => setView(k)}>{l}</Chip>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty>No societies yet.{superAdmin ? " Import them from Google above." : " The super admin imports them from Google."}</Empty>
      ) : (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 460px", minWidth: 0, height: "min(70vh, 640px)", minHeight: 320, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, isolation: "isolate" }}>
            <Suspense fallback={<Loading label="Loading the map…" />}>
              <ProspectsMap rows={shown} selectedId={picked} onPick={setPicked} />
            </Suspense>
          </div>
          <div className="crm-scroll" style={{ flex: "1 1 360px", minWidth: 0, maxHeight: "min(70vh, 640px)", border: `1px solid ${C.line}`, borderRadius: 12 }}>
            {shown.length === 0 ? <Empty pad={24}>Nothing matches.</Empty> : shown.map((r, k) => (
              <div key={r.id} role="button" tabIndex={0}
                onClick={() => (picked === r.id ? navigate(`${BASE}/${r.id}`) : setPicked(r.id))}
                onKeyDown={(e) => e.key === "Enter" && navigate(`${BASE}/${r.id}`)}
                style={{ padding: "9px 12px", borderTop: k ? `1px solid ${C.lineSoft}` : "none", cursor: "pointer", background: picked === r.id ? C.surfaceAlt : "transparent", display: "flex", gap: 10, alignItems: "center" }}>
                <StatusDot status={r.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div className="crm-mute" style={{ fontSize: 11.5 }}>
                    {[roadLabel(r.road), r.area].filter(Boolean).join(" · ")}
                    {r.last_contacted ? ` · contacted ${shortDate(r.last_contacted)}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, lineHeight: 1.5 }} className="crm-mute">
                  <div>{r.contacts} contact{r.contacts === 1 ? "" : "s"}</div>
                  <div style={{ color: r.verified ? C.accent : r.researched ? C.gold : C.textMute, fontWeight: 700 }}>{r.verified ? "Verified" : r.researched ? "To verify" : "No research"}</div>
                </div>
                {picked === r.id && <Link to={`${BASE}/${r.id}`} onClick={(e) => e.stopPropagation()}><Btn sm variant="primary">Open</Btn></Link>}
              </div>
            ))}
          </div>
        </div>
      )}
      {toast && <Toast {...toast} />}
    </>
  );
}

/* ── One society ──────────────────────────────────────────────────────────── */

const linesOf = (items) => (items ?? []).map((it) => (typeof it === "string" ? it : `${it.name}${it.km != null ? ` — ${it.km} km` : ""}`)).join("\n");
function parseLines(s) {
  return String(s || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)\s*[—–|-]\s*([\d.]+)\s*km\s*$/i);
    return m ? { name: m[1].trim(), km: Number(m[2]) } : { name: l };
  });
}

/** The editable parts of a prospect, as the form holds them. */
function draftOf(s) {
  const f = s.facts || {};
  return {
    name: s.name, area: s.area, road: s.road, status: s.status, notes: s.notes || "", last_contacted: s.last_contacted || "",
    facts: Object.fromEntries([...FACT_FIELDS.map(([k]) => [k, f[k] ?? ""]), ...RULES.map(([k]) => [k, f[k] === true ? "yes" : f[k] === false ? "no" : ""]), ["about", f.about ?? ""]]),
    amenities: (s.amenities || []).join(", "),
    rents: Object.fromEntries(["1", "2", "3", "4"].map((k) => [k, [(s.rents?.[k] || [])[0] ?? "", (s.rents?.[k] || [])[1] ?? ""]])),
    nearby: Object.fromEntries(NEARBY.map(([k]) => [k, linesOf(s.nearby?.[k])])),
  };
}

/** The draft back into what the database keeps. */
function patchOf(d) {
  const facts = {};
  for (const [k, , type] of FACT_FIELDS) {
    const v = String(d.facts[k] ?? "").trim();
    if (v) facts[k] = type === "number" ? Number(v) || v : v;
  }
  for (const [k] of RULES) if (d.facts[k]) facts[k] = d.facts[k] === "yes";
  if (String(d.facts.about || "").trim()) facts.about = d.facts.about.trim();
  const rents = {};
  for (const [k, [a, b]] of Object.entries(d.rents)) {
    const pair = [Number(a), Number(b)].filter((v) => v > 0);
    if (pair.length) rents[k] = pair;
  }
  return {
    name: d.name.trim(), area: d.area.trim(), road: d.road, status: d.status, notes: d.notes, last_contacted: d.last_contacted || "",
    facts, rents,
    amenities: d.amenities.split(/[,\n]/).map((a) => a.trim()).filter(Boolean),
    nearby: Object.fromEntries(NEARBY.map(([k]) => [k, parseLines(d.nearby[k])])),
  };
}

function Contacts({ s, onChange, say }) {
  const blank = { kind: "guard", name: "", phone: "", note: "" };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setBusy(true);
    try { onChange(await fn()); if (ok) say(ok); return true; } catch (e) { say(prospectError(e), "error"); return false; } finally { setBusy(false); }
  };
  const save = async () => {
    const done = await run(() => saveProspectContact({ ...f, id: editing || undefined, prospect_id: s.id }), editing ? "Contact saved" : "Contact added");
    if (done) { setF(blank); setEditing(null); }
  };
  const byKind = CONTACT_KINDS.map((k) => [k, s.contacts.filter((c) => c.kind === k.key)]);
  const brokers = s.contacts.filter((c) => c.kind === "broker").length;
  return (
    <div style={{ ...card, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>People to call</div>
      {byKind.map(([k, list]) => (
        <div key={k.key}>
          <div style={label}>{k.label}{k.key === "broker" ? ` · ${brokers}/5` : ""}{list.length === 0 ? " · none yet" : ""}</div>
          {list.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "4px 0", fontSize: 13 }}>
              <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} style={{ color: C.accent, fontWeight: 700, display: "inline-flex", gap: 4, alignItems: "center" }}><Phone size={13} /> {c.phone}</a>
              <span style={{ fontWeight: 600 }}>{c.name || "—"}</span>
              {c.note && <span className="crm-mute" style={{ fontSize: 12 }}>{c.note}</span>}
              {c.source === "google" && <span className="crm-mute" style={{ fontSize: 11 }}>· Google</span>}
              <span style={{ flex: 1 }} />
              <Btn sm disabled={busy} onClick={() => { setEditing(c.id); setF({ kind: c.kind, name: c.name, phone: c.phone, note: c.note }); }}>Edit</Btn>
              <Btn sm variant="danger" disabled={busy} onClick={() => window.confirm(`Remove ${c.name || c.phone}?`) && run(() => removeProspectContact(c.id), "Removed")}><Trash2 size={13} /></Btn>
            </div>
          ))}
        </div>
      ))}
      <div className="crm-wrap" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${C.lineSoft}` }}>
        <select className="crm-input" style={{ flex: "0 1 150px" }} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Who">
          {CONTACT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <input className="crm-input" style={{ flex: "1 1 130px", minWidth: 0 }} placeholder="Name" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Name" />
        <input className="crm-input" style={{ flex: "1 1 130px", minWidth: 0 }} placeholder="Phone" inputMode="tel" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label="Phone" />
        <input className="crm-input" style={{ flex: "2 1 160px", minWidth: 0 }} placeholder="Note (tower, shift, flat…)" value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="Note" />
        <Btn variant="primary" disabled={busy || f.phone.replace(/\D/g, "").length < 8} onClick={save}>{editing ? "Save" : "+ Add"}</Btn>
        {editing && <Btn onClick={() => { setEditing(null); setF(blank); }}>Cancel</Btn>}
      </div>
    </div>
  );
}

function BrochurePreview({ s, draft, assets }) {
  const one = useRef(null);
  const two = useRef(null);
  const view = useMemo(() => ({ ...s, ...patchOf(draft) }), [s, draft]);
  useEffect(() => {
    if (!assets) return;
    if (one.current) drawBrochurePage(one.current, 1, view, assets, 0.5);
    if (two.current) drawBrochurePage(two.current, 2, view, assets, 0.5);
  }, [view, assets]);
  const style = { width: "100%", maxWidth: 300, height: "auto", borderRadius: 6, boxShadow: "0 4px 18px rgba(16,34,30,.14)", background: "#fff" };
  if (!assets) return <Loading label="Drawing the brochure…" />;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <canvas ref={one} style={style} aria-label="Brochure page 1" />
      <canvas ref={two} style={style} aria-label="Brochure page 2" />
    </div>
  );
}

function Detail({ id }) {
  const { access } = useCrm();
  const navigate = useNavigate();
  const canBuild = access.has(SCOPES.PROPERTIES_WRITE);
  const [s, setS] = useState(null);
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [assets, setAssets] = useState(null);
  const [toast, say] = useToast();

  const take = useCallback((row) => { setS(row); setDraft(draftOf(row)); }, []);
  useEffect(() => {
    fetchProspect(id).then((row) => { if (!row) setErr("No such society."); else take(row); }, (e) => setErr(prospectError(e)));
  }, [id, take]);
  const photoKey = s ? `${s.id}:${(s.photos || []).join("|")}` : "";
  useEffect(() => {
    if (!s) return undefined;
    let alive = true;
    setAssets(null);
    assetsFor(s).then((a) => alive && setAssets(a));
    return () => { alive = false; };
    // Only when the photos change, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  if (err) return <p style={{ color: "#EF4444" }}>{err}</p>;
  if (!s || !draft) return <Loading />;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setFact = (k, v) => setDraft((d) => ({ ...d, facts: { ...d.facts, [k]: v } }));
  const dirty = JSON.stringify(patchOf(draft)) !== JSON.stringify(patchOf(draftOf(s)));
  /** The saved row back; `keys` are the form fields to refresh from it ("all", or a few — the rest keep unsaved edits). */
  const keep = (row, keys) => {
    if (keys === "all") { take(row); return; }
    setS(row);
    const fresh = draftOf(row);
    setDraft((d) => ({ ...d, ...Object.fromEntries(keys.map((k) => [k, fresh[k]])) }));
  };
  const run = async (key, fn, ok, keys = []) => {
    setBusy(key);
    try { const row = await fn(); if (row) keep(row, keys); if (ok) say(ok); return row; } catch (e) { say(prospectError(e), "error"); return null; } finally { setBusy(""); }
  };
  const save = () => run("save", () => saveProspect({ id, ...patchOf(draft) }), "Saved", "all");
  const setVerified = (v) => run("verify", () => saveProspect({ id, ...(dirty ? patchOf(draft) : {}), verified: v }), v ? "Marked verified" : "Back to “to verify”", "all");
  const contactedToday = () => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    run("contacted", () => saveProspect({ id, last_contacted: today, ...(s.status === "prospect" ? { status: "contacted" } : {}) }), "Marked contacted today", ["last_contacted", "status"]);
  };
  const uploadPhotos = async (files) => {
    if (!files.length) return;
    setBusy("photos");
    try {
      const urls = await uploadInventoryPhotos(files, `SOC-${s.id.slice(0, 8)}`, null, (f, msg) => say(`${f.name}: ${msg}`, "error"));
      keep(await saveProspect({ id, photos: [...(s.photos || []), ...urls.filter(Boolean)] }), []);
      say("Photos added");
    } catch (e) {
      say(prospectError(e), "error");
    } finally {
      setBusy("");
    }
  };
  const brochure = async () => {
    setBusy("pdf");
    try {
      const view = { ...s, ...patchOf(draft) };
      download(await brochurePdf(view, assets || await assetsFor(s)), brochureFileName(view.name));
    } catch (e) {
      say(prospectError(e), "error");
    } finally {
      setBusy("");
    }
  };
  const makeLive = async () => {
    if (!window.confirm(`Make ${s.name} a society building? It gets its own page and QR, and you add its flats in the building editor. The prospect stays here, marked onboarded.`)) return;
    const p = patchOf(draft);
    setBusy("live");
    try {
      const b = await saveCrmBuilding({
        name: p.name, kind: "society", area: ROAD_AREA[s.road] || p.area, landmark: p.area, full_address: s.address,
        latitude: s.lat, longitude: s.lng, amenities: p.amenities, photos: s.photos || [], description: p.facts.about || "",
      });
      await saveProspect({ id, building_id: b.id, status: "onboarded" });
      navigate(`/crm/buildings/${b.id}`);
    } catch (e) {
      say(prospectError(e), "error");
      setBusy("");
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0, flex: "1 1 280px" }}>
            <input className="crm-input" style={{ fontSize: 18, fontWeight: 800, width: "100%" }} value={draft.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} aria-label="Society name" />
            <div className="crm-mute" style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span><MapPin size={12} style={{ verticalAlign: -1 }} /> {s.address || "—"}</span>
              {s.maps_url && <a href={s.maps_url} target="_blank" rel="noreferrer" style={{ color: C.accent }}>Google Maps <ExternalLink size={11} style={{ verticalAlign: -1 }} /></a>}
              <span>Updated {relTime(s.updated_at)}{s.updated_by ? ` by ${s.updated_by}` : ""}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn variant="primary" disabled={!!busy || !dirty} onClick={save}>{busy === "save" ? "Saving…" : dirty ? "Save changes" : "Saved"}</Btn>
            <Btn disabled={!!busy} onClick={brochure}><Download size={14} style={{ verticalAlign: -2 }} /> {busy === "pdf" ? "Making…" : "Brochure PDF"}</Btn>
            {s.building_id
              ? <Link to={`/crm/buildings/${s.building_id}`}><Btn>Building {s.building_code}</Btn></Link>
              : canBuild && <Btn disabled={!!busy || dirty} title={dirty ? "Save first" : ""} onClick={makeLive}>{busy === "live" ? "Creating…" : "Make live"}</Btn>}
          </div>
        </div>
        <div className="crm-wrap" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "0 1 170px" }}><span style={label}>Status</span>
            <select className="crm-input" style={{ width: "100%" }} value={draft.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </label>
          <label style={{ flex: "0 1 170px" }}><span style={label}>Road</span>
            <select className="crm-input" style={{ width: "100%" }} value={draft.road} onChange={(e) => set({ road: e.target.value })}>
              {ROADS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <label style={{ flex: "1 1 160px" }}><span style={label}>Area</span>
            <input className="crm-input" style={{ width: "100%" }} value={draft.area} maxLength={80} onChange={(e) => set({ area: e.target.value })} />
          </label>
          <label style={{ flex: "0 1 170px" }}><span style={label}>Last contacted</span>
            <input type="date" className="crm-input" style={{ width: "100%" }} value={draft.last_contacted} onChange={(e) => set({ last_contacted: e.target.value })} />
          </label>
          <Btn disabled={!!busy} onClick={contactedToday}>Contacted today</Btn>
        </div>
        <label><span style={label}>Notes</span>
          <textarea className="crm-input" rows={3} style={{ width: "100%", resize: "vertical" }} value={draft.notes} maxLength={4000} onChange={(e) => set({ notes: e.target.value })}
            placeholder="Who you spoke to, what they said, the next step…" />
        </label>
      </div>

      <Contacts s={s} onChange={(row) => keep(row, [])} say={say} />

      <div style={{ ...card, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, flex: 1 }}>The society</div>
          {s.researched_at ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: s.verified ? C.accent : C.gold }}>
              {s.verified ? `Verified${s.verified_by ? ` by ${s.verified_by}` : ""}${s.verified_at ? ` · ${shortDate(s.verified_at)}` : ""}` : `Researched ${shortDate(s.researched_at)} — to verify`}
            </span>
          ) : <span className="crm-mute" style={{ fontSize: 12 }}>Not researched yet</span>}
          <Btn sm variant={s.verified ? undefined : "primary"} disabled={!!busy} onClick={() => setVerified(!s.verified)}>{s.verified ? "Un-verify" : "Mark verified"}</Btn>
        </div>
        <div className="crm-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {FACT_FIELDS.map(([k, l, type]) => (
            <label key={k}><span style={label}>{l}</span>
              <input className="crm-input" style={{ width: "100%" }} type={type} value={draft.facts[k]} onChange={(e) => setFact(k, e.target.value)} />
            </label>
          ))}
          {RULES.map(([k, l]) => (
            <label key={k}><span style={label}>{l}</span>
              <select className="crm-input" style={{ width: "100%" }} value={draft.facts[k]} onChange={(e) => setFact(k, e.target.value)}>
                <option value="">Not known</option><option value="yes">Allowed</option><option value="no">Not allowed</option>
              </select>
            </label>
          ))}
        </div>
        <div>
          <span style={label}>Typical rent (₹ a month, min – max)</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["1", "2", "3", "4"].map((k) => (
              <div key={k} style={{ display: "flex", gap: 4, alignItems: "center", flex: "1 1 200px" }}>
                <b style={{ fontSize: 12.5, width: 44 }}>{k} BHK</b>
                {[0, 1].map((i) => (
                  <input key={i} className="crm-input" style={{ flex: 1, minWidth: 0 }} inputMode="numeric" placeholder={i ? "max" : "min"} value={draft.rents[k][i]}
                    onChange={(e) => set({ rents: { ...draft.rents, [k]: Object.assign([...draft.rents[k]], { [i]: e.target.value.replace(/\D/g, "") }) } })} aria-label={`${k} BHK ${i ? "max" : "min"} rent`} />
                ))}
                <span className="crm-mute" style={{ fontSize: 11, width: 70 }}>{rentRange(patchOf(draft).rents[k])}</span>
              </div>
            ))}
          </div>
        </div>
        <label><span style={label}>Amenities (comma or one per line)</span>
          <textarea className="crm-input" rows={3} style={{ width: "100%", resize: "vertical" }} value={draft.amenities} onChange={(e) => set({ amenities: e.target.value })}
            placeholder="Swimming pool, Gym, Clubhouse, Kids' play area, Tennis court, 24×7 security, Power backup" />
        </label>
        <div className="crm-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {NEARBY.map(([k, l]) => (
            <label key={k}><span style={label}>{l} (one per line, “Name — 1.2 km”)</span>
              <textarea className="crm-input" rows={4} style={{ width: "100%", resize: "vertical" }} value={draft.nearby[k]} onChange={(e) => set({ nearby: { ...draft.nearby, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
        <label><span style={label}>About (for the building page when it goes live)</span>
          <textarea className="crm-input" rows={2} style={{ width: "100%", resize: "vertical" }} value={draft.facts.about} maxLength={2000} onChange={(e) => setFact("about", e.target.value)} />
        </label>
        {(s.sources || []).length > 0 && (
          <div style={{ fontSize: 12 }}>
            <span style={label}>Where the research came from</span>
            {s.sources.map((u) => <div key={u}><a href={u} target="_blank" rel="noreferrer" style={{ color: C.accent, wordBreak: "break-all" }}>{u}</a></div>)}
          </div>
        )}
      </div>

      <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, flex: 1 }}>Photos</div>
          <label className="crm-btn" style={{ cursor: busy ? "default" : "pointer", display: "inline-flex", gap: 6, alignItems: "center", opacity: busy ? 0.6 : 1 }}>
            <Camera size={14} /> {busy === "photos" ? "Uploading…" : "Add photos"}
            <input type="file" accept="image/*" multiple hidden disabled={!!busy} onChange={(e) => { uploadPhotos([...e.target.files]); e.target.value = ""; }} />
          </label>
        </div>
        <div className="crm-mute" style={{ fontSize: 12 }}>The first photo is the brochure's cover. With none, the brochure uses Google's photo with its photographer's credit.</div>
        {(s.photos || []).length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {s.photos.map((u, i) => (
              <div key={u} style={{ position: "relative", flexShrink: 0 }}>
                <img src={u} alt="" style={{ height: 90, width: 130, objectFit: "cover", borderRadius: 8, border: i === 0 ? `2px solid ${C.accent}` : `1px solid ${C.line}` }} />
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {i > 0 && <Btn sm disabled={!!busy} onClick={() => run("photos", () => saveProspect({ id, photos: [u, ...s.photos.filter((x) => x !== u)] }), "Cover changed")}>Cover</Btn>}
                  <Btn sm variant="danger" disabled={!!busy} onClick={() => run("photos", () => saveProspect({ id, photos: s.photos.filter((x) => x !== u) }), "Photo taken off")}><Trash2 size={12} /></Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Brochure <span className="crm-mute" style={{ fontWeight: 500, fontSize: 12 }}>· A4, 2 pages · the QR opens WhatsApp to +91 91469 69162</span></div>
        <BrochurePreview s={s} draft={draft} assets={assets} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant={s.hidden ? "primary" : "danger"} disabled={!!busy} onClick={() => run("hide", () => saveProspect({ id, hidden: !s.hidden }), s.hidden ? "Back on the list" : "Taken off the list")}>
          {s.hidden ? "Put back on the list" : "Not a society — take off the list"}
        </Btn>
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}

export default function CrmSocietyProspectsPage() {
  const { id } = useParams();
  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 1280 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>
            {id ? <><Link to={BASE} style={{ color: C.textMute }}>Society prospects</Link> / </> : "Society prospects"}
          </h1>
          {!id && (
            <p style={{ color: C.textDim, fontSize: 13.5, margin: 0, maxWidth: "80ch", lineHeight: 1.6 }}>
              Gated societies along HSR, Sarjapur Road, Haralur Road, Silver County Road, Hosa Road and Kudlu Road — only in
              the CRM, never on the site until one is made live. Tap a pin or a row, then open it to work it.
            </p>
          )}
        </div>
        {id ? <Detail id={id} /> : <List />}
      </div>
    </div>
  );
}
