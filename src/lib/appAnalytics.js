/**
 * What partners and owners do in their apps — every button, link and tab they
 * press, and every screen they open, with the time — for the CRM's App
 * analytics (MovEazy-BE/supabase/app_analytics.sql).
 *
 * Only on partners.moveazy.co.in and owners.moveazy.co.in (or /partners and
 * /owners on the main site). Only what a button says, never what anyone types:
 * long digit runs and email addresses in a label are masked. Sent in small
 * batches; every failure is swallowed — analytics must never break the app.
 */
import { supabase, isSupabaseConfigured } from "./supabase";

const FLUSH_MS = 4000;
const MAX_QUEUE = 200;

/** 'owner' | 'partner' when this page is one of the two apps, else ''. */
export function currentApp(loc = typeof window !== "undefined" ? window.location : null) {
  if (!loc) return "";
  if (/^owners?\./i.test(loc.hostname) || /^\/owners(\/|$)/.test(loc.pathname)) return "owner";
  if (/^partners\./i.test(loc.hostname) || /^\/partners(\/|$)/.test(loc.pathname)) return "partner";
  return "";
}

/** A button's words, without anyone's number or email, at most 120 characters. */
export function cleanLabel(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "•••@•••")
    .replace(/(\+?\d[\d\s-]{4,}\d)/g, (m) => (m.replace(/\D/g, "").length >= 6 ? "••••" : m))
    .trim()
    .slice(0, 120);
}

const CLICKABLE = "button, a, [role=button], [role=tab], [role=switch], [role=radio], [role=menuitem], [role=checkbox], summary, label, select, input[type=checkbox], input[type=radio], input[type=submit]";

/** What was pressed: the label to show and the kind of control. Null for a tap on nothing. */
export function describeTarget(node) {
  const el = node?.closest?.(CLICKABLE);
  if (!el) return null;
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role") || "";
  const type = (el.getAttribute("type") || "").toLowerCase();
  const target = role === "tab" ? "tab"
    : role === "switch" || role === "checkbox" || type === "checkbox" || type === "radio" || role === "radio" ? "toggle"
      : tag === "select" ? "select" : tag === "a" ? "link" : "button";
  let text = el.getAttribute("aria-label") || el.getAttribute("title") || "";
  if (!text && tag === "select") text = el.getAttribute("name") || el.id || "a dropdown";
  if (!text && (type === "checkbox" || type === "radio")) text = el.closest("label")?.innerText || el.getAttribute("name") || "";
  if (!text) text = el.innerText || el.textContent || "";
  if (!text) text = el.querySelector?.("img[alt]")?.getAttribute("alt") || "";
  if (!text && tag === "a") text = el.getAttribute("href") || "";
  const label = cleanLabel(text);
  return label ? { label, target } : { label: `(${target} with no label)`, target };
}

let queue = [];
let timer = null;
let started = false;

function push(e) {
  const app = currentApp();
  if (!app) return;
  queue.push({ ...e, app, path: window.location.pathname.slice(0, 200), at: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
}

async function flush() {
  if (!queue.length || !isSupabaseConfigured || !supabase) return;
  const batch = queue.splice(0, 100);
  const app = batch[0].app;
  const mine = batch.filter((e) => e.app === app);
  queue = [...batch.filter((e) => e.app !== app), ...queue];
  try {
    // Loaded here, not at the top: they need a browser, and the helpers above are tested without one.
    const [{ sessionTracker }, { anonId }] = await Promise.all([import("./sessionTracking"), import("./sessionSync")]);
    await supabase.rpc("app_track", {
      p_app: app,
      p_session: sessionTracker.sessionId,
      p_anon: anonId(),
      p_events: mine.map(({ kind, label, target, path, at }) => ({ kind, label, target, path, at })),
    });
  } catch {
    /* analytics must never surface to the user */
  }
}

/** A screen opened in one of the apps. */
export function trackScreen(path) {
  push({ kind: "page", label: cleanLabel(path || window.location.pathname), target: "" });
}

/** Start listening for taps. Safe to call more than once. */
export function startAppAnalytics() {
  if (started || typeof window === "undefined") return () => {};
  started = true;
  const onClick = (ev) => {
    if (!currentApp()) return;
    const d = describeTarget(ev.target);
    if (d) push({ kind: "click", ...d });
  };
  const onHide = () => { if (document.visibilityState === "hidden") flush(); };
  // Capture phase: a button that stops propagation still counts.
  document.addEventListener("click", onClick, true);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  timer = setInterval(flush, FLUSH_MS);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
    clearInterval(timer);
    started = false;
  };
}

/* ── The CRM's side (crm.analytics.read) ─────────────────────────────────── */

async function rpc(fn, args) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Not connected.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

/** Everyone in one app ('owner' | 'partner'): details, last sign-in, time spent, sessions, taps. */
export const fetchAppPeople = (app) => rpc("app_analytics_people", { p_app: app }).then((r) => r ?? []);
/** One person's sessions in one app, newest first, each with every tap and screen in order. */
export const fetchAppSessions = (app, userId, limit = 30) =>
  rpc("app_analytics_user", { p_app: app, p_user: userId, p_limit: limit }).then((r) => r ?? []);
