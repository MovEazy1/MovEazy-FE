/**
 * Add a partner to a group by mobile number (partner_group_add.sql). Any
 * member may. An approved MovEazy partner on that number is in straight away
 * (and told so in their app); any other number is held as "Invited" for 30
 * days and joins on its own once it signs up and is approved. Either way the
 * last step offers a ready WhatsApp to tell them.
 */
import { useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { Sheet, WhatsAppIcon, formatPhone } from "./partnerUi";
import { normalizeIndianMobile } from "../../lib/mobile";
import { addMemberByPhone, addedMessage, friendlyError, waLink } from "../../lib/partners";

export default function AddMemberSheet({ group, onClose, onAdded }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const valid = Boolean(normalizeIndianMobile(phone));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!valid) { setErr("Enter a 10-digit mobile number."); return; }
    setBusy(true);
    try {
      const r = await addMemberByPhone(group.id, phone.trim());
      setDone(r);
      if (r?.status !== "already") onAdded?.(r);
    } catch (e2) {
      setErr(friendlyError(e2, "Couldn't add that number."));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const invited = done.status === "invited";
    const name = done.name || formatPhone(done.phone);
    const msg = addedMessage({ groupName: group.name, groupId: group.id, invited, phone: formatPhone(done.phone), name: done.name });
    return (
      <Sheet title="Add a partner" onClose={onClose}>
        <div className="pz-pad" style={{ textAlign: "center" }}>
          {invited ? <Clock size={40} color="#8A6419" /> : <CheckCircle2 size={40} color="#16A34A" />}
          <h3 style={{ margin: "10px 0 6px" }}>
            {done.status === "added" ? `${name} is in ${group.name}` : done.status === "already" ? `${name} is already in ${group.name}` : `${formatPhone(done.phone)} is invited`}
          </h3>
          <p className="pz-hint" style={{ margin: "0 0 16px" }}>
            {done.status === "added" && "They've been told in their partner app, and now see the flats the group shares."}
            {done.status === "already" && "Nothing to do — they're a member."}
            {invited && (done.signed_up
              ? "They've signed up but aren't approved yet. They join the group the moment they're approved."
              : "Not a MovEazy partner yet. They join the group automatically when they sign up with this number — within 30 days.")}
          </p>
          {done.status !== "already" && (
            <a className="pz-btn pz-wa pz-btn--block" href={waLink(done.phone, msg)} target="_blank" rel="noreferrer">
              <WhatsAppIcon /> Tell them on WhatsApp
            </a>
          )}
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--block" style={{ marginTop: 6 }}
            onClick={() => { setDone(null); setPhone(""); }}>Add another number</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Add a partner" onClose={onClose}>
      <form className="pz-pad" onSubmit={submit}>
        <p className="pz-hint" style={{ marginTop: 0 }}>
          Type their mobile number. A MovEazy partner is added to <b style={{ color: "var(--ink)" }}>{group.name}</b> straight away;
          anyone else joins automatically when they sign up with that number.
        </p>
        <div className="pz-field">
          <label className="pz-label" htmlFor="am-phone">Mobile number</label>
          <input id="am-phone" className="pz-input" inputMode="tel" autoComplete="off" placeholder="10-digit mobile" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} autoFocus />
        </div>
        {err && <div className="pz-err">{err}</div>}
        <button type="submit" className="pz-btn pz-btn--gold pz-btn--block" disabled={busy || !valid}>{busy ? "Adding…" : "Add to group"}</button>
      </form>
    </Sheet>
  );
}
