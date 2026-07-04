import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import { BRAND_PAYEE_NAME, getPaymentProduct } from "../config/paymentProducts";
import { getRazorpayHostedPaymentUrl } from "../config/razorpayHosted";
import { getBusinessUpiCheckoutEnv } from "../config/upiCheckout";

const ORDER_FN = import.meta.env.VITE_RAZORPAY_ORDER_URL?.trim();
const BILLING_EMAIL = import.meta.env.VITE_BILLING_CONTACT_EMAIL?.trim();

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const existing = document.querySelector('script[data-razorpay-checkout="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.dataset.razorpayCheckout = "1";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error("Razorpay script failed to load"));
    document.body.appendChild(s);
  });
}

export default function Pay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const product = useMemo(() => getPaymentProduct(searchParams), [searchParams]);
  const apiSku = useMemo(() => {
    const q = String(searchParams.get("sku") || "").trim().toLowerCase();
    if (q === "deposit-saver" || q === "flat-search" || q === "personalized-match" || q === "guarantee") return q;
    return "guarantee";
  }, [searchParams]);

  const hostedUrl = useMemo(() => getRazorpayHostedPaymentUrl(product.key), [product.key]);
  const { hasDirectUpiFallback } = useMemo(() => getBusinessUpiCheckoutEnv(), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const checkoutSkuQuery = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const payWithRazorpayModal = useCallback(async () => {
    setErr("");
    if (!ORDER_FN) {
      setErr("Server checkout is not configured. Use the Razorpay page button or UPI checkout.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErr("Enter a valid email for your receipt.");
      return;
    }
    setBusy(true);
    try {
      const Razorpay = await loadRazorpayScript();
      const res = await fetch(ORDER_FN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: apiSku,
          receipt: `web_${apiSku}_${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.orderId || !data.keyId) {
        setErr(data.error || "Could not start payment. Try the Razorpay page or UPI checkout.");
        setBusy(false);
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || "INR",
        order_id: data.orderId,
        name: BRAND_PAYEE_NAME,
        description: product.title,
        prefill: {
          name: name.trim() || undefined,
          email: email.trim(),
          contact: phone.replace(/\D/g, "").slice(0, 15) || undefined,
        },
        theme: { color: "#e11d48" },
        handler() {
          setDone(true);
          setBusy(false);
        },
        modal: {
          ondismiss() {
            setBusy(false);
          },
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Payment could not start.");
      setBusy(false);
    }
  }, [ORDER_FN, email, name, phone, product.title, apiSku]);

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden antialiased">
      <div className="pointer-events-none fixed inset-0 z-0">
        <PremiumPageBackdrop variant="checkout" />
      </div>
      <Navbar />

      <main className="relative z-10 max-w-lg mx-auto px-6 py-12 sm:py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">MovEazy · Razorpay</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-900">Pay securely</h1>
          <p className="mt-2 text-slate-600 text-sm">{product.title}</p>
          <p className="mt-1 text-2xl font-extrabold text-stone-900 tabular-nums">₹{product.amountRupee.toLocaleString("en-IN")}</p>

          {BILLING_EMAIL && (
            <p className="mt-3 text-xs text-slate-500">
              Billing contact: <span className="font-semibold text-slate-700">{BILLING_EMAIL}</span>
            </p>
          )}

          <p className="mt-4 text-xs text-slate-500 leading-relaxed">
            Opens Razorpay&apos;s secure page — <strong className="text-slate-700">UPI</strong> (Google Pay, PhonePe, Paytm, BHIM),{" "}
            <strong className="text-slate-700">debit / credit cards</strong>, netbanking and wallets, depending on what is enabled on your Razorpay link.
          </p>

          {done ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <div className="text-3xl mb-2">✓</div>
              <p className="font-bold text-emerald-900">Payment submitted</p>
              <p className="text-sm text-emerald-800 mt-2">{product.confirmBody}</p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-6 w-full rounded-xl bg-rose-600 py-3 font-bold text-white hover:bg-rose-700"
              >
                Back to home
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-4 rounded-2xl border border-white/80 bg-white/95 p-6 shadow-lg backdrop-blur-md">
              <a
                href={hostedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0d3c61] to-[#0f5a8c] py-4 text-base font-bold text-white shadow-lg ring-1 ring-black/10 hover:opacity-[0.96] active:scale-[0.99] transition-transform"
              >
                Pay on Razorpay — UPI · Card · more
              </a>
              <p className="text-center text-[11px] text-slate-500">Opens Razorpay in a new tab</p>

              <div className="border-t border-stone-200 pt-4 mt-2">
                <p className="text-xs font-semibold text-slate-600 mb-3">Optional — for in-site modal checkout (requires server setup)</p>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Full name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900"
                    placeholder="As on ID / bank"
                    autoComplete="name"
                  />
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Email (receipt)</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900"
                    placeholder="you@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Phone (optional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900"
                    placeholder="+91 …"
                    autoComplete="tel"
                  />
                </div>

                {err && <p className="text-sm text-red-600 font-medium mt-2">{err}</p>}

                {ORDER_FN ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={payWithRazorpayModal}
                    className="mt-4 w-full rounded-xl border-2 border-rose-200 bg-white py-3 text-sm font-bold text-rose-700 shadow-sm hover:bg-rose-50 disabled:opacity-60"
                  >
                    {busy ? "Opening…" : "Pay in-page (server order)"}
                  </button>
                ) : null}
              </div>

              {hasDirectUpiFallback ? (
                <p className="text-center text-xs text-slate-500 pt-2">
                  Optional UPI QR on checkout?{" "}
                  <Link to={`/checkout${checkoutSkuQuery}`} className="font-semibold text-rose-700 underline">
                    Open checkout with QR
                  </Link>
                </p>
              ) : (
                <p className="text-center text-xs text-slate-500 pt-2">
                  <Link to={`/checkout${checkoutSkuQuery}`} className="font-semibold text-rose-700 underline">
                    Order summary & receipt WhatsApp
                  </Link>
                </p>
              )}
            </div>
          )}
        </motion.div>
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
