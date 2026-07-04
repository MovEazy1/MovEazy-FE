import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { motion } from "framer-motion";
import {
  AGENT_TABS,
  SPECIALTY_OPTIONS,
  LANGUAGE_OPTIONS,
  BUDGET_OPTIONS,
} from "../data/agentsDirectory";
import { fetchDirectoryAgents } from "../lib/directoryAgentsSettings";
import { FLAT_SEARCH_CTA } from "../config/navLinks";
import { useAuth } from "../context/AuthContext";
import { fetchCustomerSearchProfile, isSearchProfileComplete } from "../lib/customerSearchProfile";
import { requestAgentWhatsAppConnect } from "../lib/agentWhatsAppConnect";

const EASE = [0.22, 1, 0.36, 1];

/** Area experts UI hidden until product is ready — partner brokers only. */
const SHOW_AREA_EXPERTS = false;

function matchesBudget(tier, budgetLabel) {
  if (budgetLabel === "All") return true;
  if (budgetLabel === "Under ₹15k/mo") return tier === 1;
  if (budgetLabel === "₹15k – ₹30k/mo") return tier === 2;
  if (budgetLabel === "₹30k – ₹50k/mo") return tier === 3;
  if (budgetLabel === "₹50k+/mo") return tier === 4;
  return true;
}

export default function AgentsDirectory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState("");
  const [connectError, setConnectError] = useState("");
  const [tab, setTab] = useState("brokers");
  const [locationQ, setLocationQ] = useState("");
  const [nameQ, setNameQ] = useState("");
  const [rentAdvisory, setRentAdvisory] = useState(true);
  const [buyAdvisory, setBuyAdvisory] = useState(false);
  const [specialty, setSpecialty] = useState("All");
  const [language, setLanguage] = useState("All");
  const [budget, setBudget] = useState("All");

  useEffect(() => {
    let alive = true;
    fetchDirectoryAgents()
      .then((rows) => {
        if (alive) setAgents(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const loc = locationQ.trim().toLowerCase();
    const nm = nameQ.trim().toLowerCase();
    return agents.filter((a) => {
      if (a.tab !== tab) return false;
      if (rentAdvisory || buyAdvisory) {
        if (rentAdvisory && buyAdvisory) {
          if (!a.rentFocus && !a.buyFocus) return false;
        } else if (rentAdvisory) {
          if (!a.rentFocus) return false;
        } else if (buyAdvisory) {
          if (!a.buyFocus) return false;
        }
      }
      if (specialty !== "All" && !a.specialties.includes(specialty)) return false;
      if (language !== "All" && !a.languages.includes(language)) return false;
      if (!matchesBudget(a.budgetTier, budget)) return false;
      if (loc) {
        const hay = `${a.areas.join(" ")} ${a.name} ${a.localExpertise}`.toLowerCase();
        const parts = loc.split(/\s+/).filter(Boolean);
        if (!parts.every((p) => hay.includes(p))) return false;
      }
      if (nm && !a.name.toLowerCase().includes(nm)) return false;
      return true;
    });
  }, [agents, tab, locationQ, nameQ, rentAdvisory, buyAdvisory, specialty, language, budget]);

  const handleConnectWhatsApp = async (agent) => {
    setConnectError("");
    if (!user) {
      navigate(`/login?next=${encodeURIComponent("/agents")}`);
      return;
    }
    const profile = await fetchCustomerSearchProfile(user.uid);
    if (!isSearchProfileComplete(profile)) {
      navigate("/my-search?next=agents");
      return;
    }
    setConnectingId(agent.id);
    try {
      const waUrl = await requestAgentWhatsAppConnect(agent.id);
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      const msg = String(e?.message || e || "Could not connect");
      setConnectError(msg);
    } finally {
      setConnectingId("");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-50 antialiased text-stone-900">
      <Navbar variant="marketing" />

      <main className="relative z-10 pb-16">
        {/* Top bar — partner brokers only (area experts hidden for now) */}
        {SHOW_AREA_EXPERTS ? (
          <div className="border-b border-zinc-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {AGENT_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                      tab === t.id
                        ? "border-blue-600 text-blue-700"
                        : "border-transparent text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900"
          >
            {SHOW_AREA_EXPERTS && tab === "experts" ? "Area experts" : "Partner brokers"} in Bengaluru
          </motion.h1>
          <p className="mt-2 text-sm text-zinc-600 max-w-2xl">
            Search verified MovEazy area guides and partner listing agents — focus areas, languages, and activity.
            Profiles are managed from Admin → Agents directory.
          </p>

          {/* Search row */}
          <div className="mt-8 flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                City, neighbourhood, or landmark
              </label>
              <input
                value={locationQ}
                onChange={(e) => setLocationQ(e.target.value)}
                placeholder="e.g. HSR Layout, Whitefield, Manyata…"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-stone-900 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Agent name</label>
              <input
                value={nameQ}
                onChange={(e) => setNameQ(e.target.value)}
                placeholder="Search by name"
                className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-stone-900 placeholder:text-zinc-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            <button
              type="button"
              className="rounded-lg bg-stone-900 px-8 py-3 text-sm font-bold text-white shadow-md hover:bg-stone-800 transition-colors shrink-0"
            >
              Find {SHOW_AREA_EXPERTS && tab === "experts" ? "experts" : "brokers"}
            </button>
          </div>

          {/* Filters — Zillow-style chips + dropdowns */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRentAdvisory((v) => !v)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                rentAdvisory ? "border-blue-600 bg-blue-50 text-blue-800" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              Rentals &amp; leases
            </button>
            <button
              type="button"
              onClick={() => setBuyAdvisory((v) => !v)}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                buyAdvisory ? "border-blue-600 bg-blue-50 text-blue-800" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              Sale / investment advisory
            </button>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              {SPECIALTY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  Specialty: {o}
                </option>
              ))}
            </select>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  Language: {o}
                </option>
              ))}
            </select>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              {BUDGET_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  Budget: {o}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-6 text-sm font-semibold text-zinc-700">
            {filtered.length.toLocaleString("en-IN")}{" "}
            {SHOW_AREA_EXPERTS && tab === "experts" ? "experts" : "brokers"} found
            {loading ? <span className="font-normal text-zinc-500"> — loading…</span> : null}
          </p>
        </div>

        {/* Card grid — two columns on large screens */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((a, i) => (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease: EASE }}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  <div className="relative shrink-0">
                    {a.team ? (
                      <span className="absolute -top-1 -left-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-950 shadow">
                        Team
                      </span>
                    ) : null}
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-orange-100 text-lg font-extrabold text-rose-700 ring-2 ring-white shadow">
                      {a.initials}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-stone-900 leading-snug">{a.name}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{a.brokerage}</div>
                    <ul className="mt-3 space-y-1.5 text-xs text-zinc-700">
                      <li className="flex gap-2">
                        <span className="text-zinc-400 shrink-0">•</span>
                        <span>{a.priceRangeLabel}</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-zinc-400 shrink-0">•</span>
                        <span>{a.recentActivity}</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-zinc-400 shrink-0">•</span>
                        <span>{a.localExpertise}</span>
                      </li>
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.specialties.slice(0, 3).map((s) => (
                        <span key={s} className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={connectingId === a.id}
                  onClick={() => handleConnectWhatsApp(a)}
                  className="mt-4 w-full rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1fb855] disabled:opacity-60 transition-colors"
                >
                  {connectingId === a.id ? "Opening WhatsApp…" : "Connect on WhatsApp"}
                </button>
              </motion.article>
            ))}
          </div>

          {connectError ? (
            <p className="mt-4 text-center text-sm text-red-600 font-medium">{connectError}</p>
          ) : null}
          <p className="mt-3 text-center text-xs text-zinc-500">
            Sign in and complete your{" "}
            <Link to="/my-search" className="text-rose-700 font-semibold underline">
              search profile
            </Link>{" "}
            before connecting. Broker numbers are never shown on this page.
          </p>

          {filtered.length === 0 ? (
            <p className="mt-10 text-center text-sm text-zinc-500">No profiles match these filters — try widening search or toggling filters.</p>
          ) : null}

          {/* Lead banner — Zillow-style help CTA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ease: EASE }}
            className="mt-10 rounded-xl border border-sky-200 bg-sky-50 px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-200 text-sky-900 text-xl" aria-hidden>
                📞
              </div>
              <div>
                <div className="font-bold text-sky-950 text-sm sm:text-base">Ready to start your flat search?</div>
                <p className="mt-1 text-xs sm:text-sm text-sky-900/80 max-w-xl">
                  MovEazy Flat Search — on-ground shortlisting, neighbourhood fit, and visit scheduling. One-time fee{" "}
                  <strong>₹1,499</strong> with WhatsApp updates through your search.
                </p>
              </div>
            </div>
            <Link
              to={FLAT_SEARCH_CTA.path}
              className="mt-4 sm:mt-0 inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-sky-800 transition-colors"
            >
              {FLAT_SEARCH_CTA.label}
            </Link>
          </motion.div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
