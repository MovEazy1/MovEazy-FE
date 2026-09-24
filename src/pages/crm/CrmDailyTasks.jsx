/**
 * What clients did, and who owes them a reply.
 *
 * The CRM has always recorded this — crm_activities is written by triggers the
 * moment somebody books, reacts or opens a shortlist — but nothing put it in
 * front of anyone. An agent learned a client had asked for a visit by opening
 * that client's record, which means learning it only about clients they
 * already had a reason to open.
 *
 * One row per person, newest first, with the two things that actually close a
 * follow-up: message them, or park it for a few hours.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCrm } from "./CrmShell";
import { Btn, C, Empty } from "./crmUi";
import { whatsappUrl } from "../../lib/crmSettings";
import {
  SNOOZE_PRESETS, buildDailyTasks, clearSnooze, describeAction, fetchClientActions,
  fetchSnoozes, followUpMessage, snoozeTask, timeAgo,
} from "../../lib/crmDailyTasks";

/** The hours box plus the gaps people actually use, so the common case is one tap. */
function SnoozeControl({ onSnooze, busy }) {
  const [hours, setHours] = useState("");

  const commit = (h) => {
    const n = Number(h);
    if (!Number.isFinite(n) || n <= 0) return;
    onSnooze(n);
    setHours("");
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {SNOOZE_PRESETS.map((h) => (
        <Btn key={h} sm disabled={busy} onClick={() => commit(h)} title={`Remind in ${h} hours`}>
          {h}h
        </Btn>
      ))}
      <input
        className="crm-input"
        style={{ width: 52, fontSize: 11, padding: "3px 6px" }}
        placeholder="hrs"
        inputMode="numeric"
        value={hours}
        onChange={(e) => setHours(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onKeyDown={(e) => { if (e.key === "Enter") commit(hours); }}
        disabled={busy}
        aria-label="Remind in how many hours"
      />
      {hours && <Btn sm variant="primary" disabled={busy} onClick={() => commit(hours)}>Set</Btn>}
    </span>
  );
}

function TaskRow({ task, onSnooze, onUnsnooze, onOpen, busy }) {
  const message = followUpMessage({ name: task.name, action: task.latest });
  const href = whatsappUrl(task.phone, message);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 12px", borderBottom: `1px solid ${C.lineSoft}`,
    }}>
      <button
        type="button"
        onClick={() => onOpen(task.clientId)}
        title={`Open ${task.name}`}
        // The row tells you somebody did something; their record tells you
        // what they have done all along, which is the next question every
        // time. Deliberately not the whole row: the buttons alongside would
        // then navigate as well as act.
        style={{
          minWidth: 0, flex: 1, textAlign: "left", padding: 0,
          background: "none", border: "none", cursor: "pointer", font: "inherit",
        }}
      >
        <span style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
          <span className="crm-task-name" style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {task.name}
          </span>
          <span className="crm-mute crm-num" style={{ fontSize: 11 }}>
            {task.phone || task.email || "no contact"}
          </span>
          {task.count > 1 && (
            <span className="crm-mute" style={{ fontSize: 11 }}>· {task.count} actions</span>
          )}
          {task.returned && (
            // Says why they are back on the list rather than leaving an agent
            // to wonder whether the snooze worked.
            <span className="crm-chip" style={{ pointerEvents: "none", borderColor: C.gold, color: C.gold, fontSize: 10 }}>
              back
            </span>
          )}
        </span>
        <span style={{ display: "block", fontSize: 12.5, color: C.textDim, marginTop: 3 }}>
          {describeAction(task.latest)}
        </span>
        <span className="crm-mute" style={{ fontSize: 11 }}>{timeAgo(task.latest.created_at)}</span>
      </button>

      <span style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {href ? (
          <a
            className="crm-btn crm-btn--sm crm-btn--wa"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            WhatsApp
          </a>
        ) : (
          <span className="crm-mute" style={{ fontSize: 11 }}>no number</span>
        )}
        <SnoozeControl busy={busy} onSnooze={(h) => onSnooze(task.clientId, h)} />
        {task.returned && <Btn sm onClick={() => onUnsnooze(task.clientId)} disabled={busy}>Clear</Btn>}
      </span>
    </div>
  );
}

export default function CrmDailyTasks() {
  const { clients, user } = useCrm();
  const navigate = useNavigate();
  const actorEmail = user?.email || "";

  // The same address the pipeline and payments screens use to open somebody,
  // so a client opened from here lands exactly where it would from there.
  const openClient = useCallback(
    (clientId) => navigate(`/crm/clients?client=${clientId}`),
    [navigate],
  );
  const [actions, setActions] = useState([]);
  const [snoozes, setSnoozes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  /**
   * Re-rendered on a timer as well as on new data, because a snooze expiring
   * is a change nobody wrote: the row has to reappear when its hour passes,
   * not when somebody happens to reload.
   */
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, s] = await Promise.all([fetchClientActions(), fetchSnoozes()]);
    if (!alive.current) return;
    setActions(a);
    setSnoozes(s);
    setLastLoadedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  /**
   * Fetched once, then only when asked.
   *
   * This polled every thirty seconds, which is four requests a minute for
   * every tab left open on this screen — near three thousand a day per agent,
   * almost all of them returning the rows that were already on screen. A
   * follow-up queue does not change faster than the person working it, and
   * they are sitting in front of a Refresh button.
   *
   * The minute timer stays, and costs nothing: it only re-renders what has
   * already been fetched, which is what lets a snooze that has run out come
   * back on its own without asking the database anything.
   */
  useEffect(() => {
    alive.current = true;
    load();
    const clock = setInterval(() => setTick((t) => t + 1), 60000);
    return () => {
      alive.current = false;
      clearInterval(clock);
    };
  }, [load]);

  const tasks = useMemo(
    () => buildDailyTasks(actions, clients, snoozes, Date.now()),
    // tick is a deliberate dependency: it is what makes an expiring snooze
    // reappear on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions, clients, snoozes, tick],
  );

  const onSnooze = async (clientId, hours) => {
    setBusy(clientId);
    await snoozeTask(clientId, hours, actorEmail);
    await load();
    setBusy("");
  };

  const onUnsnooze = async (clientId) => {
    setBusy(clientId);
    await clearSnooze(clientId);
    await load();
    setBusy("");
  };

  return (
    <>
      <div className="crm-colhead">
        <span className="crm-label">
          Daily tasks · {tasks.length}
          {lastLoadedAt && (
            <span className="crm-mute" style={{ fontWeight: 600 }}>
              {" "}· updated {timeAgo(lastLoadedAt)}
            </span>
          )}
        </span>
        {/* The list is only as current as the last press, so it says when
            that was rather than letting an empty queue pass for a quiet one. */}
        <Btn sm onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Btn>
      </div>

      <div className="crm-scroll" style={{ flex: 1 }}>
        {loading && tasks.length === 0 ? (
          <Empty>Loading…</Empty>
        ) : tasks.length === 0 ? (
          <Empty>Nothing from a client in the last two days.</Empty>
        ) : (
          tasks.map((t) => (
            <TaskRow
              key={t.clientId}
              task={t}
              busy={busy === t.clientId}
              onSnooze={onSnooze}
              onUnsnooze={onUnsnooze}
              onOpen={openClient}
            />
          ))
        )}
      </div>
    </>
  );
}
