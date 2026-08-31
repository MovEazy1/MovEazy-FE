import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Admin review queue for "Register as a Broker" / seller verification
 * applications (public.user_profiles.seller_badge_status = 'pending'). Approve
 * grants the MovEazy Assured badge; reject sends the account back to
 * re-applicable state. Basic /broker dashboard access isn't gated by this —
 * it's already unlocked the moment someone registers (see BrokerRegister.jsx).
 */
export default function BrokerVerificationManager() {
  const { getPendingSellerBadgeApplications, loadPendingSellerBadgeApplications, approveSellerBadge, rejectSellerBadge } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });

  const refresh = async () => {
    setLoading(true);
    await loadPendingSellerBadgeApplications();
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applications = getPendingSellerBadgeApplications();

  const approve = async (email) => {
    setBusy(email); setMsg({ type: "", text: "" });
    try {
      await approveSellerBadge(email);
      setMsg({ type: "ok", text: `Approved ${email}.` });
    } finally { setBusy(""); }
  };
  const reject = async (email) => {
    setBusy(email); setMsg({ type: "", text: "" });
    try {
      await rejectSellerBadge(email);
      setMsg({ type: "ok", text: `Rejected ${email}.` });
    } finally { setBusy(""); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-gray-500">
          {loading ? "Loading…" : `${applications.length} pending application${applications.length === 1 ? "" : "s"}.`}
        </p>
        <button type="button" onClick={refresh}
          className="px-4 py-2 rounded-xl text-[13px] font-bold text-gray-700 border border-gray-200 hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {msg.text && (
        <div className="mb-4 p-3 rounded-xl text-[12.5px] font-semibold bg-green-50 text-green-700 border border-green-200">{msg.text}</div>
      )}

      {!loading && applications.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-400 text-[14px]">
          No pending applications right now.
        </div>
      )}

      <div className="space-y-3">
        {applications.map((a) => (
          <div key={a.email} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[14px] font-extrabold text-gray-900">{a.application?.businessName || a.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wide"
                    style={{ background: a.role === "broker" ? "#eef2ff" : "#fff5f2", color: a.role === "broker" ? "#4338ca" : "#b23a28" }}>
                    {a.role === "broker" ? "Broker" : "Seller"}
                  </span>
                </div>
                <p className="text-[12.5px] text-gray-500 font-mono">{a.email}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" disabled={busy === a.email} onClick={() => reject(a.email)}
                  className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">
                  {busy === a.email ? "…" : "Reject"}
                </button>
                <button type="button" disabled={busy === a.email} onClick={() => approve(a.email)}
                  className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "#16a34a" }}>
                  {busy === a.email ? "…" : "Approve"}
                </button>
              </div>
            </div>

            {a.application && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-[12.5px]">
                <div><p className="text-gray-400 font-bold uppercase text-[10.5px] mb-0.5">Phone</p><p className="text-gray-800">{a.application.phone || "—"}</p></div>
                <div><p className="text-gray-400 font-bold uppercase text-[10.5px] mb-0.5">GST</p><p className="text-gray-800">{a.application.gst || "—"}</p></div>
                <div><p className="text-gray-400 font-bold uppercase text-[10.5px] mb-0.5">Experience</p><p className="text-gray-800">{a.application.experienceYears || "—"}</p></div>
                <div><p className="text-gray-400 font-bold uppercase text-[10.5px] mb-0.5">Areas</p><p className="text-gray-800">{a.application.areas || "—"}</p></div>
                <div className="col-span-2 sm:col-span-4"><p className="text-gray-400 font-bold uppercase text-[10.5px] mb-0.5">Submitted</p><p className="text-gray-800">{fmtDate(a.application.submittedAt)}</p></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
