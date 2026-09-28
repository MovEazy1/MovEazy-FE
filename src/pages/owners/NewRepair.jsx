/**
 * PRD 10 — a new repair, Urban Company-style: pick what broke, say a word
 * about it, add a photo or two, send. Photos are compressed on the phone and
 * stored privately; the ops team sees them, nobody else.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useOwner } from "./OwnerApp";
import { ServiceIcon } from "./serviceIcons";
import { WhenPicker } from "./ServicesHome";
import { Empty, TopBar, toast } from "./ownerUi";
import { REPAIR_CATEGORIES, createRequest, friendlyError, op, propertyName, uploadRequestPhotos } from "../../lib/owners";

export default function NewRepair() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { properties, reloadRequests } = useOwner();
  const [f, setF] = useState(() => ({
    category: "", property_id: params.get("property") || properties?.[0]?.property_id || "", description: "",
    date: "", slot: "any",
  }));
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState("");
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  if ((properties ?? []).length === 0) {
    return <><TopBar title="New Repair Request" back /><Empty action={<Link to={op("/properties/new")} className="oz-btn oz-btn--primary">Add a property</Link>}>Add a property first.</Empty></>;
  }

  const submit = async () => {
    if (!f.category) return toast("Pick what needs fixing", "error");
    if (!f.property_id) return toast("Pick the property", "error");
    if (f.category === "other" && !f.description.trim()) return toast("Tell us what needs doing", "error");
    try {
      let photos = [];
      if (files.length) {
        setBusy("Uploading photos…");
        photos = await uploadRequestPhotos(user.uid, files);
      }
      setBusy("Sending…");
      const label = REPAIR_CATEGORIES.find((c) => c.key === f.category)?.label || "Repair";
      const id = await createRequest({
        kind: "repair", category: f.category, property_id: f.property_id, description: f.description, photos,
        title: f.category === "other" ? (f.description.trim().split(/[.\n]/)[0].slice(0, 60) || "Repair") : label,
        preferred_date: f.date || null, preferred_slot: f.slot,
      });
      await reloadRequests();
      toast("Request sent — MovEazy will call you to schedule it");
      navigate(op(`/repairs/${id}`), { replace: true });
    } catch (e) {
      toast(friendlyError(e, "Could not send the request."), "error");
      setBusy("");
    }
  };

  return (
    <>
      <TopBar title="New Repair Request" back />
      <div className="oz-pad">
        <span className="oz-label">Select Service</span>
        <div className="oz-grid3" style={{ marginBottom: 16 }}>
          {REPAIR_CATEGORIES.map((c) => (
            <button key={c.key} type="button" className={`oz-cat${f.category === c.key ? " oz-cat--on" : ""}`} onClick={() => set({ category: c.key })}>
              <ServiceIcon category={c.key} size={24} />{c.label}
            </button>
          ))}
        </div>

        {(properties ?? []).length > 1 && (
          <div className="oz-field">
            <label className="oz-label" htmlFor="nr-prop">Property</label>
            <select id="nr-prop" className="oz-select" value={f.property_id} onChange={(e) => set({ property_id: e.target.value })}>
              {properties.map((p) => <option key={p.property_id} value={p.property_id}>{propertyName(p)}</option>)}
            </select>
          </div>
        )}

        <div className="oz-field">
          <label className="oz-label" htmlFor="nr-desc">Describe the issue {f.category !== "other" && <span className="oz-hint">(optional)</span>}</label>
          <textarea id="nr-desc" className="oz-textarea" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })}
            placeholder="AC is not cooling properly. Need a service." />
        </div>

        <div className="oz-field">
          <span className="oz-label">Add Photos <span className="oz-hint">(optional)</span></span>
          <div className="oz-row" style={{ flexWrap: "wrap", gap: 8 }}>
            {previews.map((p) => (
              <div key={p.url} className="oz-thumb" style={{ width: 84, height: 84, position: "relative" }}>
                <img src={p.url} alt="" />
                <button type="button" aria-label="Remove photo" onClick={() => setFiles((cur) => cur.filter((x) => x !== p.file))}
                  style={{ position: "absolute", top: 4, right: 4, border: 0, borderRadius: 999, background: "rgba(0,0,0,.55)", color: "#fff", width: 22, height: 22, display: "grid", placeItems: "center" }}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {files.length < 6 && (
              <label className="oz-thumb" style={{ width: 84, height: 84, border: "1.5px dashed var(--line)", background: "#fff", cursor: "pointer", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <ImagePlus size={20} /> Add
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => { setFiles((cur) => [...cur, ...[...e.target.files].filter((x) => x.type.startsWith("image/"))].slice(0, 6)); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>

        <WhenPicker date={f.date} slot={f.slot} onDate={(d) => set({ date: f.date === d ? "" : d })} onSlot={(s) => set({ slot: s })} />

        <button type="button" className="oz-btn oz-btn--primary oz-btn--block" onClick={submit} disabled={!!busy}>{busy || "Submit Request"}</button>
        <p className="oz-hint" style={{ textAlign: "center" }}>You'll see the quote before any work starts.</p>
      </div>
    </>
  );
}
