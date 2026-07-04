import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PageShell from "../components/layout/PageShell";
import GuaranteeHero from "../components/sections/GuaranteeHero";
import DepositTrap from "../components/sections/DepositTrap";
import GuaranteeHowItWorks from "../components/sections/GuaranteeHowItWorks";
import SavingsBanner from "../components/sections/SavingsBanner";
import GuaranteeFAQ from "../components/sections/GuaranteeFAQ";
import GuaranteeEnrollCTA from "../components/sections/GuaranteeEnrollCTA";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { updateUserProfileData } from "../lib/firestoreStore";

const INIT = { name: "", phone: "", email: "" };

function GuaranteeModal({ onClose, user, onPhoneSaved: _onPhoneSaved }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
  });
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { setErr("Name and phone are required."); return; }
    setErr(""); setStatus("saving");
    try {
      if (isFirebaseConfigured) {
        await addDoc(collection(db, "guaranteeSubInterest"), {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          source: "guarantee-page",
          status: "pending",
          createdAt: serverTimestamp(),
        });
        if (user?.email && !user?.phone && form.phone.trim()) {
          await updateUserProfileData(user.email, { phone: form.phone.trim() }).catch(() => {});
        }
      }
      setStatus("done");
    } catch {
      setErr("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const inp = "w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] font-medium text-gray-900 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-100";
  const lbl = "block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md relative"
        style={{ padding: "44px 36px", boxShadow: "0 32px 100px rgba(0,0,0,0.35)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors border-none cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {status === "done" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3 className="text-[22px] font-extrabold text-gray-900 mb-2">We've got you!</h3>
            <p className="text-[14px] text-gray-500 leading-relaxed">Our team will contact you shortly to help protect your security deposit.</p>
            <button onClick={onClose} className="mt-6 px-8 py-3 rounded-xl bg-gray-900 text-white text-[14px] font-bold border-none cursor-pointer">Done</button>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-red-500 mb-2">Get Protected</p>
            <h2 className="text-[26px] font-extrabold text-gray-900 mb-2 leading-tight">Protect Your Security Deposit</h2>
            <p className="text-[13px] text-gray-500 mb-7 leading-relaxed">Share your details and our team will reach out to get you enrolled.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className={lbl}>Full Name *</label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" required className={inp} />
              </div>
              <div>
                <label className={lbl}>Phone Number *</label>
                <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" required className={inp} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@email.com" className={inp} />
              </div>
              {err && <p className="text-[12px] font-semibold text-red-500 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
              <button type="submit" disabled={status === "saving"}
                className="w-full py-4 rounded-2xl text-[15px] font-bold text-white border-none cursor-pointer transition-opacity disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", marginTop: 4 }}>
                {status === "saving" ? "Saving…" : "Submit — Our team will contact you shortly"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function Guarantee() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const handleCTAClick = async () => {
    setShowModal(true);
    try {
      if (isFirebaseConfigured) {
        await addDoc(collection(db, "guaranteePageEvents"), {
          type: "cta_click",
          createdAt: serverTimestamp(),
        });
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showModal]);

  return (
    <PageShell
      variant="marketing"
      overlayOnly
      className="antialiased bg-gradient-to-b from-[#f3f5f7] via-white to-[#f2f4f7]"
    >
      <Navbar variant="marketing" />

      <main className="relative">
        <GuaranteeHero onCTAClick={handleCTAClick} />
        <DepositTrap />
        <GuaranteeHowItWorks />
        <SavingsBanner />
        <GuaranteeFAQ />
        <GuaranteeEnrollCTA onCTAClick={handleCTAClick} />
      </main>

      <Footer />
      {showModal && <GuaranteeModal onClose={() => setShowModal(false)} user={user} />}
    </PageShell>
  );
}
