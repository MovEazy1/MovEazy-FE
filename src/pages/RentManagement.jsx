/**
 * "Rent Management" — a simple manual rent tracker for an owner's rented
 * properties. No payment processing: the owner marks each month paid/due
 * themselves. One row per rented property for the current month, with a
 * history of past months underneath.
 *
 * Needs MovEazy-BE/supabase/rent_payments_schema.sql run once in the
 * Supabase SQL editor — until then, saving a status shows a clear "not set
 * up yet" message instead of failing silently.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginModal } from "../context/LoginModalContext";
import MovEazyNav from "../components/layout/MovEazyNav";
import { fetchMyInventory } from "../lib/inventory";
import { fetchRentPayments, upsertRentPayment } from "../lib/rentManagement";

const inr = (n) => Number.isFinite(Number(n)) && Number(n) > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "—";
const isClosed = (status) => status === "rented" || status === "sold";

/** First-of-month ISO date, e.g. "2026-09-01". */
function periodOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtPeriod(period) {
  return new Date(`${period}T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function RentManagement() {
  const { user, loading: authLoading } = useAuth();
  const { openLogin } = useLoginModal();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [openHistory, setOpenHistory] = useState({}); // { property_id: bool }

  const currentPeriod = useMemo(() => periodOf(new Date()), []);

  const load = async (uid) => {
    setLoading(true);
    try {
      const all = await fetchMyInventory(uid);
      const rented = all.filter((p) => isClosed(p.status));
      setProperties(rented);
      const ids = rented.map((p) => p.property_id);
      setPayments(ids.length ? await fetchRentPayments(ids) : []);
    } catch (e) {
      setErr(e?.message || "Could not load your rented properties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    load(user.uid);
  }, [authLoading, user]);

  const paymentsByProperty = useMemo(() => {
    const map = {};
    for (const p of payments) (map[p.property_id] ||= []).push(p);
    return map;
  }, [payments]);

  const setStatus = async (property, period, status, amount) => {
    const key = property.property_id + period;
    setBusy(key);
    setErr("");
    try {
      await upsertRentPayment(user.uid, property.property_id, period, {
        status,
        amount: amount ?? property.rent ?? null,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      });
      await load(user.uid);
    } catch (e) {
      const rls = String(e?.message || "").toLowerCase().includes("row-level") || String(e?.message || "").toLowerCase().includes("does not exist");
      setErr(rls
        ? "Couldn't save — the rent-tracking database table isn't set up yet (run rent_payments_schema.sql)."
        : (e?.message || "Could not save this."));
    } finally {
      setBusy("");
    }
  };

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100dvh", fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <MovEazyNav active="" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-[24px] sm:text-[30px] font-extrabold text-gray-900">Rent Management</h1>
        <p className="text-[13px] text-gray-500 mt-1 mb-6">
          Track this month's rent for each of your rented properties — mark it paid as it comes in.
        </p>

        {!authLoading && !user ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">Sign in to see your rent tracker</p>
            <p className="text-[13px] text-gray-500 mb-4">This is tied to the properties on your MovEazy account.</p>
            <button type="button" onClick={() => openLogin()}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              Sign in
            </button>
          </div>
        ) : loading ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : properties.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center">
            <p className="text-[14px] font-bold text-gray-900 mb-1">No rented properties yet</p>
            <p className="text-[13px] text-gray-500 mb-4">Once you mark a listing as rented in My Properties, it'll show up here for rent tracking.</p>
            <button type="button" onClick={() => navigate("/my-properties")}
              className="h-11 px-6 rounded-xl text-[13px] font-bold text-white"
              style={{ background: "linear-gradient(135deg,#ff3131,#ef4444)" }}>
              Go to My Properties
            </button>
          </div>
        ) : (
          <>
            {err && <p className="text-[12px] font-semibold text-red-500 mb-3">{err}</p>}
            <div className="space-y-4">
              {properties.map((p) => {
                const history = (paymentsByProperty[p.property_id] || []);
                const current = history.find((r) => r.period === currentPeriod);
                const isPaid = current?.status === "paid";
                const past = history.filter((r) => r.period !== currentPeriod);
                const busyKey = p.property_id + currentPeriod;

                return (
                  <div key={p.property_id} className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-extrabold text-gray-900 truncate">{p.title || p.area || "Property"}</p>
                          <p className="text-[12px] text-gray-500 truncate">{p.area || "—"} · {fmtPeriod(currentPeriod)}</p>
                        </div>
                        <span
                          className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                          style={isPaid
                            ? { background: "#ecfdf5", color: "#15803d", border: "1px solid #a7f3d0" }
                            : { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
                        >
                          {isPaid ? "Paid" : "Due"}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-3 mt-2">
                        <span className="text-[17px] font-extrabold text-gray-900">{inr(current?.amount ?? p.rent)}</span>
                        {isPaid && current?.paid_at && (
                          <span className="text-[12px] text-gray-500">
                            Paid {new Date(current.paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {isPaid ? (
                          <button type="button" disabled={busy === busyKey} onClick={() => setStatus(p, currentPeriod, "due")}
                            className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                            Mark as due
                          </button>
                        ) : (
                          <button type="button" disabled={busy === busyKey} onClick={() => setStatus(p, currentPeriod, "paid")}
                            className="h-9 px-4 rounded-lg text-[12px] font-bold text-white disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}>
                            Mark as paid
                          </button>
                        )}
                        {past.length > 0 && (
                          <button type="button" onClick={() => setOpenHistory((o) => ({ ...o, [p.property_id]: !o[p.property_id] }))}
                            className="h-9 px-4 rounded-lg text-[12px] font-bold border border-gray-200 text-gray-700 hover:bg-gray-50">
                            {openHistory[p.property_id] ? "Hide history" : `History (${past.length})`}
                          </button>
                        )}
                      </div>
                    </div>

                    {openHistory[p.property_id] && past.length > 0 && (
                      <div className="px-4 pb-4">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-200/70">
                          {past.map((r) => (
                            <div key={r.period} className="flex items-center justify-between gap-3 p-3">
                              <span className="text-[12.5px] font-semibold text-gray-800">{fmtPeriod(r.period)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] text-gray-500">{inr(r.amount)}</span>
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                                  style={r.status === "paid"
                                    ? { background: "#ecfdf5", color: "#15803d" }
                                    : { background: "#fef2f2", color: "#b91c1c" }}
                                >
                                  {r.status === "paid" ? "Paid" : "Due"}
                                </span>
                                <button type="button" disabled={busy === p.property_id + r.period}
                                  onClick={() => setStatus(p, r.period, r.status === "paid" ? "due" : "paid", r.amount)}
                                  className="text-[11px] font-bold text-gray-500 hover:text-gray-800">
                                  {r.status === "paid" ? "Undo" : "Mark paid"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
