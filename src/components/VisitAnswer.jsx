/**
 * "How did it go?" after a visit — the same answers as the BR Homes tracker
 * and Tenant views: Liked (negotiating, exploring, will pay token, paid token)
 * or Did not like (the reasons, plus any the team has typed before).
 * Plain markup with its own small styles, so it sits in the tenant site and
 * the partner app alike.
 */
import { useState } from "react";
import { DISLIKE_REASONS, LIKED_STATUSES } from "../lib/buildings";

export default function VisitAnswer({ answer, extraReasons = [], onSave }) {
  const [liked, setLiked] = useState(answer?.liked || "");
  const [status, setStatus] = useState(answer?.liked_status || "");
  const [reasons, setReasons] = useState(answer?.reasons || []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(Boolean(answer?.liked));
  const allReasons = [...DISLIKE_REASONS, ...extraReasons.filter((r) => !DISLIKE_REASONS.some((d) => d.label.toLowerCase() === String(r.label).toLowerCase()))
    .map((r) => ({ id: r.label, label: r.label }))];
  const toggle = (id) => setReasons((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const save = async () => {
    setBusy(true);
    try {
      await onSave({ liked, liked_status: liked === "liked" ? status : "", reasons: liked === "disliked" ? reasons : [] });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };
  const chip = (on) => ({
    border: `1.5px solid ${on ? "#04211D" : "#DDD8CC"}`, background: on ? "#04211D" : "#fff", color: on ? "#fff" : "#13201B",
    borderRadius: 999, padding: "8px 14px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer",
  });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={chip(liked === "liked")} onClick={() => { setLiked("liked"); setSaved(false); }}>👍 Liked it</button>
        <button type="button" style={chip(liked === "disliked")} onClick={() => { setLiked("disliked"); setSaved(false); }}>👎 Didn&apos;t like it</button>
      </div>
      {liked === "liked" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {LIKED_STATUSES.map((s) => (
            <button key={s.id} type="button" style={chip(status === s.id)} onClick={() => { setStatus(status === s.id ? "" : s.id); setSaved(false); }}>{s.label}</button>
          ))}
        </div>
      )}
      {liked === "disliked" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {allReasons.map((r) => (
            <button key={r.id} type="button" style={chip(reasons.includes(r.id))} onClick={() => { toggle(r.id); setSaved(false); }}>{r.label}</button>
          ))}
        </div>
      )}
      {liked && (
        <button type="button" disabled={busy || saved} onClick={save}
          style={{ ...chip(true), justifySelf: "start", background: saved ? "#15803D" : "#04211D", borderColor: saved ? "#15803D" : "#04211D", padding: "10px 18px" }}>
          {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      )}
    </div>
  );
}
