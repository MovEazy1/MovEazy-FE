import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import {
  EMPTY_SEARCH_PROFILE,
  fetchCustomerSearchProfile,
  isSearchProfileComplete,
  saveCustomerSearchProfile,
} from "../lib/customerSearchProfile";

export default function MySearchProfile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ ...EMPTY_SEARCH_PROFILE, preferredAreas: "" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent("/my-search")}`);
      return;
    }
    let alive = true;
    fetchCustomerSearchProfile(user.uid).then((p) => {
      if (!alive) return;
      setForm({
        ...p,
        preferredAreas: (p.preferredAreas || []).join(", "),
        budgetMin: p.budgetMin ?? "",
        budgetMax: p.budgetMax ?? "",
        maxCommuteMins: p.maxCommuteMins ?? "",
      });
    });
    return () => {
      alive = false;
    };
  }, [user, authLoading, navigate]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setStatus("");
    try {
      const saved = await saveCustomerSearchProfile(user.uid, form);
      setStatus(
        isSearchProfileComplete(saved)
          ? "Saved. You can connect with agents on /agents."
          : "Saved. Add areas and budget or BHK to connect with agents.",
      );
      if (searchParams.get("next") === "agents" && isSearchProfileComplete(saved)) {
        navigate("/agents");
      }
    } catch (err) {
      setStatus(String(err?.message || err || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-600">
        Loading…
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-300";

  return (
    <div className="min-h-screen bg-zinc-50 text-stone-900">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">My flat search profile</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Brokers receive this when you tap <strong>Connect on WhatsApp</strong> on{" "}
          <Link to="/agents" className="text-rose-700 font-semibold underline">
            /agents
          </Link>
          . Broker numbers are never shown on agent cards.
        </p>

        <form onSubmit={handleSave} className="mt-8 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold">
            Preferred areas (comma-separated)
            <input
              className={`${field} mt-1`}
              value={form.preferredAreas}
              onChange={(e) => setForm((p) => ({ ...p, preferredAreas: e.target.value }))}
              placeholder="HSR Layout, Koramangala, Bellandur"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Budget min (₹/month)
              <input
                className={`${field} mt-1`}
                inputMode="numeric"
                value={form.budgetMin}
                onChange={(e) => setForm((p) => ({ ...p, budgetMin: e.target.value }))}
              />
            </label>
            <label className="block text-sm font-semibold">
              Budget max (₹/month)
              <input
                className={`${field} mt-1`}
                inputMode="numeric"
                value={form.budgetMax}
                onChange={(e) => setForm((p) => ({ ...p, budgetMax: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            BHK / layout
            <input
              className={`${field} mt-1`}
              value={form.bhk}
              onChange={(e) => setForm((p) => ({ ...p, bhk: e.target.value }))}
              placeholder="2 BHK"
            />
          </label>
          <label className="block text-sm font-semibold">
            Property type
            <input
              className={`${field} mt-1`}
              value={form.propertyType}
              onChange={(e) => setForm((p) => ({ ...p, propertyType: e.target.value }))}
              placeholder="Rent / PG / coliving"
            />
          </label>
          <label className="block text-sm font-semibold">
            Furnishing
            <input
              className={`${field} mt-1`}
              value={form.furnishing}
              onChange={(e) => setForm((p) => ({ ...p, furnishing: e.target.value }))}
              placeholder="Semi-furnished"
            />
          </label>
          <label className="block text-sm font-semibold">
            Move-in date
            <input
              className={`${field} mt-1`}
              value={form.moveInDate}
              onChange={(e) => setForm((p) => ({ ...p, moveInDate: e.target.value }))}
              placeholder="June 2026"
            />
          </label>
          <label className="block text-sm font-semibold">
            Commute to (office / landmark)
            <input
              className={`${field} mt-1`}
              value={form.commuteTo}
              onChange={(e) => setForm((p) => ({ ...p, commuteTo: e.target.value }))}
            />
          </label>
          <label className="block text-sm font-semibold">
            Max commute (minutes)
            <input
              className={`${field} mt-1`}
              inputMode="numeric"
              value={form.maxCommuteMins}
              onChange={(e) => setForm((p) => ({ ...p, maxCommuteMins: e.target.value }))}
            />
          </label>
          <label className="block text-sm font-semibold">
            Must-haves
            <textarea
              className={`${field} mt-1 min-h-[72px]`}
              value={form.mustHaves}
              onChange={(e) => setForm((p) => ({ ...p, mustHaves: e.target.value }))}
            />
          </label>
          <label className="block text-sm font-semibold">
            Deal-breakers
            <textarea
              className={`${field} mt-1 min-h-[72px]`}
              value={form.dealBreakers}
              onChange={(e) => setForm((p) => ({ ...p, dealBreakers: e.target.value }))}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Pets
              <input className={`${field} mt-1`} value={form.pets} onChange={(e) => setForm((p) => ({ ...p, pets: e.target.value }))} />
            </label>
            <label className="block text-sm font-semibold">
              Parking
              <input
                className={`${field} mt-1`}
                value={form.parking}
                onChange={(e) => setForm((p) => ({ ...p, parking: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Anything else
            <textarea
              className={`${field} mt-1 min-h-[88px]`}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {status ? <p className="text-sm text-zinc-700">{status}</p> : null}
        </form>
      </main>
      <Footer />
    </div>
  );
}
