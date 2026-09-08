/**
 * The messages everyone sends, edited in one place.
 *
 * One shared row, so changing the wording here changes the next send by anyone
 * on the team. Preview renders against a real client from the list rather than
 * dummy text — a template reads differently when the variables are filled.
 */
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "./CrmShell";
import {
  DEFAULT_CLOSED_OUTSIDE_REASONS, TEMPLATE_VARIABLES, buildTemplateVars,
  renderTemplate, saveCrmSettings,
} from "../../lib/crmSettings";
import { SCOPES } from "../../lib/adminScopes";
import { Btn, C, Chip, Empty, Toast } from "./crmUi";

export default function CrmSettingsPage() {
  const crm = useCrm();
  const { settings, clients, requirements, inventory, access } = crm;

  const [draft, setDraft] = useState(settings);
  const [activeId, setActiveId] = useState(settings.templates[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => setDraft(settings), [settings]);

  const canEdit = access.has(SCOPES.TEMPLATES_WRITE);
  const showToast = (message, tone = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2600);
  };

  const active = useMemo(
    () => draft.templates.find((t) => t.id === activeId) ?? draft.templates[0],
    [draft.templates, activeId],
  );

  // Preview against a real client and a real listing, so what you see is what
  // someone actually receives.
  const sample = useMemo(() => {
    const client = clients.find((c) => c.phone) ?? clients[0];
    const requirement = client ? requirements.find((r) => r.client_id === client.id) : null;
    const property = inventory.find((l) => l.status === "published") ?? inventory[0];
    const matches = inventory.slice(0, 3).map((l) => ({ listing: l }));
    return { client, requirement, property, matches };
  }, [clients, requirements, inventory]);

  const preview = useMemo(() => {
    if (!active) return "";
    const vars = buildTemplateVars({
      client: sample.client,
      requirement: sample.requirement,
      agentName: access.name || access.email?.split("@")[0] || "MovEazy",
      property: sample.property,
      matches: sample.matches,
      visitTime: "Saturday 11:00",
    });
    return renderTemplate(active.body, vars);
  }, [active, sample, access]);

  const patchActive = (patch) =>
    setDraft((d) => ({
      ...d,
      templates: d.templates.map((t) => (t.id === active.id ? { ...t, ...patch } : t)),
    }));

  const addTemplate = () => {
    const id = `t_${Math.random().toString(36).slice(2, 8)}`;
    setDraft((d) => ({ ...d, templates: [...d.templates, { id, name: "New template", body: "Hi {{client_name}}, " }] }));
    setActiveId(id);
  };

  const removeTemplate = () => {
    if (draft.templates.length <= 1) return showToast("Keep at least one template", "error");
    setDraft((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== active.id) }));
    setActiveId(draft.templates.find((t) => t.id !== active.id)?.id ?? "");
  };

  const insertVar = (name) => {
    patchActive({ body: `${active.body}{{${name}}}` });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveCrmSettings(draft, access.email);
      crm.setData((d) => ({ ...d, settings: saved }));
      showToast("Saved — the whole team sends this now");
    } catch (e) {
      showToast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!active) return <Empty>No templates configured.</Empty>;

  return (
    <div className="crm-scroll" style={{ flex: 1 }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 6px" }}>Message templates</h1>
          <p style={{ color: C.creamDim, fontSize: 13.5, margin: 0, maxWidth: "64ch", lineHeight: 1.6 }}>
            These are shared. Edit one and the next WhatsApp anyone on the team sends uses the new wording.
            {!canEdit && " You can send with these, but not change them."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {draft.templates.map((t) => (
            <Chip key={t.id} on={t.id === active.id} onClick={() => setActiveId(t.id)}>{t.name}</Chip>
          ))}
          {canEdit && <Chip onClick={addTemplate}>+ New</Chip>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,1fr) minmax(260px,320px)", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Name</span>
              <input className="crm-input" value={active.name} disabled={!canEdit}
                onChange={(e) => patchActive({ name: e.target.value })} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="crm-label">Message</span>
              <textarea className="crm-input" rows={9} value={active.body} disabled={!canEdit}
                onChange={(e) => patchActive({ body: e.target.value })} />
            </label>

            {canEdit && (
              <div>
                <span className="crm-label">Drop in</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {TEMPLATE_VARIABLES.map((v) => (
                    <Chip key={v} onClick={() => insertVar(v)} style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
                      {`{{${v}}}`}
                    </Chip>
                  ))}
                </div>
                <p className="crm-mute" style={{ fontSize: 11, margin: "8px 0 0", lineHeight: 1.5 }}>
                  A variable with nothing to fill it renders as empty rather than showing the placeholder —
                  a half-filled template is worse than a shorter one.
                </p>
              </div>
            )}

            {canEdit && (
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                <Btn variant="primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save for everyone"}
                </Btn>
                <Btn variant="danger" onClick={removeTemplate}>Delete</Btn>
                <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  <input type="checkbox" checked={draft.defaultTemplateId === active.id}
                    onChange={(e) => setDraft((d) => ({ ...d, defaultTemplateId: e.target.checked ? active.id : d.defaultTemplateId }))} />
                  <span className="crm-mute" style={{ fontSize: 11.5 }}>Use for the client header button</span>
                </label>
              </div>
            )}
          </div>

          <div style={{ background: "#071E1A", border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 9, alignSelf: "start" }}>
            <span className="crm-label">
              Preview{sample.client ? ` · ${sample.client.name || sample.client.email}` : ""}
            </span>
            <div style={{
              background: "#0F3A2E", border: "1px solid rgba(37,211,102,.28)",
              borderRadius: "10px 10px 10px 3px", padding: "10px 12px",
              fontSize: 12.5, lineHeight: 1.62, color: C.cream, whiteSpace: "pre-wrap",
            }}>
              {preview || "—"}
            </div>
            <span className="crm-mute" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
              Opens in WhatsApp with this pre-typed — the agent taps send. Sending automatically needs the
              WhatsApp Business API, which is a separate piece of work.
            </span>
          </div>
        </div>

        <div className="crm-card" style={{ maxWidth: 620 }}>
          <span className="crm-label">“Closed outside” reasons</span>
          <p className="crm-mute" style={{ fontSize: 11.5, margin: "6px 0 10px", lineHeight: 1.55 }}>
            Asked whenever a client is closed as found-elsewhere. Grouped by locality, this is your
            inventory-gap report — where you're losing people for lack of stock.
          </p>
          <textarea
            className="crm-input"
            rows={6}
            disabled={!canEdit}
            value={(draft.closedOutsideReasons ?? DEFAULT_CLOSED_OUTSIDE_REASONS).join("\n")}
            onChange={(e) =>
              setDraft((d) => ({ ...d, closedOutsideReasons: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }))}
          />
          <span className="crm-mute" style={{ fontSize: 10.5 }}>One per line.</span>
        </div>
      </div>
      <Toast {...(toast ?? {})} />
    </div>
  );
}
