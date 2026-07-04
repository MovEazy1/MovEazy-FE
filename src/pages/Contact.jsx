import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import { motion } from "framer-motion";
import { useSitePublicSettings } from "../hooks/useSitePublicSettings";
import { db, isFirebaseConfigured } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const MAX_MSG = 500;
const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
});

const CONTACT_ITEMS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: "Email us",
    value: "support@moveazy.in",
    href: "mailto:support@moveazy.in",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L0 24l6.335-1.652C8.05 23.404 9.983 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.855 0-3.596-.5-5.093-1.373l-.365-.217-3.762.981.999-3.645-.238-.376A9.959 9.959 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
    ),
    label: "WhatsApp",
    value: "+91 9608986517",
    href: "https://wa.me/919608986517?text=Hi%20MovEazy%2C%20I%20need%20help",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: "Location",
    value: "Bengaluru, India",
    href: null,
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: "Hours",
    value: "Mon–Sun · 9 am – 9 pm IST",
    href: null,
  },
];

function InputField({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-200 focus:border-red-400 focus:ring-2 focus:ring-red-100";

export default function Contact() {
  const { sitePublic } = useSitePublicSettings();
  const supportEmail = sitePublic.supportEmail || "support@moveazy.in";

  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", agreed: false });
  const [status, setStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agreed) { setErrorMsg("Please agree to the Privacy Policy."); return; }
    if (!form.name.trim() || !form.email.trim()) { setErrorMsg("Name and email are required."); return; }
    setErrorMsg("");
    setStatus("sending");
    try {
      if (isFirebaseConfigured) {
        await addDoc(collection(db, "contactQueries"), {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          message: form.message.trim(),
          status: "pending",
          createdAt: serverTimestamp(),
        });
      }
      setStatus("sent");
      setForm({ name: "", email: "", phone: "", message: "", agreed: false });
    } catch (err) {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try WhatsApp directly.");
      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#fafaf9] antialiased">
      <Navbar variant="marketing" />

      <main className="relative">
        {/* Hero strip */}
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-14 sm:py-16">
            <motion.p {...fadeUp(0)} className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-500 mb-3">
              Contact &amp; Support
            </motion.p>
            <motion.h1
              {...fadeUp(0.06)}
              className="text-[34px] sm:text-[46px] lg:text-[54px] font-extrabold text-[#1E2A3A] leading-[1.06] tracking-tight"
            >
              We&apos;re here to help.
            </motion.h1>
            <motion.p {...fadeUp(0.12)} className="mt-4 text-[15px] sm:text-[16px] text-gray-500 leading-relaxed max-w-lg">
              Questions about listings, the plan, or deposit protection? Reach out and our team will get back to you quickly.
            </motion.p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 sm:py-16">
          <div className="grid lg:grid-cols-[1fr_1.45fr] gap-10 lg:gap-16 items-start">

            {/* ── Left: Contact info ──────────────────────────────────── */}
            <motion.div {...fadeUp(0.08)} className="flex flex-col gap-8">
              <div className="flex flex-col gap-5">
                {CONTACT_ITEMS.map(({ icon, label, value, href }) => (
                  <div key={label} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0 mt-0.5">
                      {icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
                      {href ? (
                        <a href={href} className="text-[14px] font-semibold text-[#1E2A3A] hover:text-red-500 transition-colors">
                          {value}
                        </a>
                      ) : (
                        <p className="text-[14px] font-semibold text-[#1E2A3A]">{value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* WhatsApp CTA */}
              <a
                href="https://wa.me/919608986517?text=Hi%20MovEazy%2C%20I%20need%20help"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#25D366] text-white font-semibold text-[14px] hover:bg-[#20bd5a] transition-colors shadow-[0_8px_24px_rgba(37,211,102,0.22)] w-fit"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.845L0 24l6.335-1.652C8.05 23.404 9.983 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.855 0-3.596-.5-5.093-1.373l-.365-.217-3.762.981.999-3.645-.238-.376A9.959 9.959 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Chat on WhatsApp
              </a>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["men/32", "women/44", "men/75"].map((p) => (
                    <img
                      key={p}
                      src={`https://randomuser.me/api/portraits/${p}.jpg`}
                      alt=""
                      className="w-8 h-8 rounded-full border-2 border-white object-cover"
                    />
                  ))}
                </div>
                <p className="text-[13px] text-gray-500">
                  <span className="font-semibold text-gray-700">500+</span> customers helped this month
                </p>
              </div>
            </motion.div>

            {/* ── Right: Form ─────────────────────────────────────────── */}
            <motion.div {...fadeUp(0.14)}>
              <div className="bg-white rounded-3xl border border-stone-100 shadow-[0_4px_32px_rgba(0,0,0,0.06)] p-7 sm:p-9">
                {status === "sent" ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center gap-5">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-[#1E2A3A] mb-2">Message received!</h2>
                      <p className="text-[14px] text-gray-500 max-w-xs mx-auto">
                        We usually respond within a few hours. You can also reach us on WhatsApp for faster replies.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStatus(null)}
                      className="text-[13px] font-semibold text-red-500 hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-7">
                      <h2 className="text-[20px] font-extrabold text-[#1E2A3A]">Send us a message</h2>
                      <p className="mt-1 text-[13px] text-gray-400">
                        Or email directly at{" "}
                        <a href={`mailto:${supportEmail}`} className="font-semibold text-red-500 hover:underline">
                          {supportEmail}
                        </a>
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                      <div className="grid sm:grid-cols-2 gap-5">
                        <InputField label="Full Name" required>
                          <input
                            type="text"
                            required
                            placeholder="Your full name"
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            className={inputCls}
                          />
                        </InputField>

                        <InputField label="Email Address" required>
                          <input
                            type="email"
                            required
                            placeholder="your@email.com"
                            value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            className={inputCls}
                          />
                        </InputField>
                      </div>

                      <InputField label="Phone Number">
                        <div className="flex">
                          <span className="flex items-center px-3.5 text-[13px] font-semibold rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-gray-500 shrink-0">
                            +91
                          </span>
                          <input
                            type="tel"
                            placeholder="98765 43210"
                            value={form.phone}
                            onChange={(e) => set("phone", e.target.value.replace(/[^\d\s\-()]/g, ""))}
                            className={`${inputCls} rounded-l-none border-l-0`}
                          />
                        </div>
                      </InputField>

                      <InputField label="Message">
                        <div className="relative">
                          <textarea
                            placeholder="Tell us how we can help…"
                            rows={4}
                            maxLength={MAX_MSG}
                            value={form.message}
                            onChange={(e) => set("message", e.target.value)}
                            className={`${inputCls} resize-none`}
                          />
                          <span className="absolute bottom-3 right-4 text-[11px] text-gray-300 pointer-events-none">
                            {form.message.length}/{MAX_MSG}
                          </span>
                        </div>
                      </InputField>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.agreed}
                          onChange={(e) => set("agreed", e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded accent-red-500 shrink-0"
                        />
                        <span className="text-[12.5px] text-gray-500 leading-relaxed">
                          I agree to the{" "}
                          <Link to="/privacy" className="font-semibold text-red-500 hover:underline">
                            Privacy Policy
                          </Link>
                          .
                        </span>
                      </label>

                      {errorMsg && (
                        <p className="text-[13px] font-medium text-red-500 bg-red-50 px-4 py-3 rounded-xl">{errorMsg}</p>
                      )}

                      <button
                        type="submit"
                        disabled={status === "sending"}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ff3131] text-white font-bold text-[15px] hover:bg-red-600 active:scale-[0.98] transition-all duration-200 shadow-[0_8px_24px_rgba(255,49,49,0.28)] disabled:opacity-60 disabled:cursor-wait mt-1"
                      >
                        {status === "sending" ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sending…
                          </>
                        ) : (
                          <>Submit Message <span className="text-lg ml-1">→</span></>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
