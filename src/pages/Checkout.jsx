import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Tilt3D from "../components/ui/Tilt3D";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BRAND_PAYEE_NAME, getPaymentProduct } from "../config/paymentProducts";
import { getRazorpayHostedPaymentUrl } from "../config/razorpayHosted";
import { getBusinessUpiCheckoutEnv } from "../config/upiCheckout";

const EASE = [0.22, 1, 0.36, 1];

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [confirmed, setConfirmed] = useState(false);

  const product = useMemo(() => getPaymentProduct(searchParams), [searchParams]);
  const razorpayHostedUrl = useMemo(() => getRazorpayHostedPaymentUrl(product.key), [product.key]);
  const { businessUpiVpa, checkoutQrImageUrl, whatsappOrderE164, hasDirectUpiFallback } = useMemo(
    () => getBusinessUpiCheckoutEnv(),
    [],
  );

  const upiPayUri = useMemo(() => {
    if (!businessUpiVpa) return "";
    return `upi://pay?pa=${encodeURIComponent(businessUpiVpa)}&pn=${encodeURIComponent(BRAND_PAYEE_NAME)}&am=${product.amountPaise}&cu=INR`;
  }, [businessUpiVpa, product.amountPaise]);

  const qrSrc = useMemo(() => {
    if (checkoutQrImageUrl) return checkoutQrImageUrl;
    if (upiPayUri) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&data=${encodeURIComponent(upiPayUri)}`;
    }
    return "";
  }, [checkoutQrImageUrl, upiPayUri]);

  const whatsAppReceiptHref = `https://wa.me/${whatsappOrderE164}?text=${product.whatsappPath}`;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden antialiased">
      <div className="pointer-events-none fixed inset-0 z-0">
        <PremiumPageBackdrop variant="checkout" />
      </div>

      <Navbar />

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-rose-700 shadow-sm backdrop-blur-sm">
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.35, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />
            Live checkout
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-stone-900 via-rose-900 to-orange-700 bg-clip-text text-transparent">Checkout</span>
          </h1>
          <p className="mt-2 text-slate-600 font-medium">
            {product.key === "personalized-match"
              ? "Unlock your personalized property pack — pay once, get curated picks and priority."
              : hasDirectUpiFallback
                ? "Pay on Razorpay (UPI, cards & more) or use the business UPI QR below."
                : "Pay on Razorpay — UPI and cards go through MovEazy’s business Razorpay account (no personal UPI on this page)."}
          </p>

          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <a
              href={razorpayHostedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0d3c61] to-[#0f5a8c] px-5 py-2.5 text-sm font-bold text-white shadow-md ring-1 ring-black/10 hover:opacity-[0.96]"
            >
              Pay on Razorpay — UPI · Card · more
            </a>
            <span className="text-slate-400">or</span>
            <Link
              to={`/pay${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
              className="font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-800"
            >
              Full pay page
            </Link>
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-8 md:gap-10">
            <Tilt3D intensity={6} scale={1.01} className="rounded-2xl [transform-style:preserve-3d]">
              <div className="rounded-2xl border border-white/80 bg-white/95 p-8 shadow-card-lg backdrop-blur-md ring-1 ring-stone-900/[0.04]">
                <h2 className="text-xl font-bold text-stone-900 mb-6">Order summary</h2>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center gap-4 pb-4 border-b border-stone-100">
                    <div className="min-w-0">
                      <div className="font-semibold text-stone-900">{product.title}</div>
                      <div className="text-sm text-slate-500 mt-1">{product.subtitle}</div>
                    </div>
                    <div className="font-bold text-lg text-stone-900 shrink-0">₹{product.amountRupee.toLocaleString("en-IN")}</div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    {product.bullets.map((line) => (
                      <div key={line} className="flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">✓</span>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t-2 border-stone-900">
                  <div className="font-bold text-lg text-stone-900">Total</div>
                  <motion.div
                    className="font-extrabold text-2xl text-stone-900 tabular-nums"
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    ₹{product.amountRupee.toLocaleString("en-IN")}
                  </motion.div>
                </div>
              </div>
            </Tilt3D>

            <Tilt3D intensity={7} scale={1.015} className="rounded-2xl [transform-style:preserve-3d]">
              <div className="rounded-2xl border border-white/80 bg-white/95 p-8 shadow-card-lg backdrop-blur-md ring-1 ring-stone-900/[0.04]">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold text-stone-900">
                    {hasDirectUpiFallback ? "Pay on Razorpay or UPI" : "Pay on Razorpay"}
                  </h2>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
                    Encrypted
                  </span>
                </div>

                <a
                  href={razorpayHostedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-5 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#0d3c61] to-[#0f5a8c] py-3.5 text-sm font-bold text-white shadow-md ring-1 ring-black/10 hover:opacity-[0.96]"
                >
                  Razorpay — UPI · debit / credit · more
                </a>

                {!hasDirectUpiFallback ? (
                  <div className="mb-6 rounded-xl border border-stone-200 bg-stone-50/90 p-4 text-sm text-stone-700 ring-1 ring-stone-900/[0.04]">
                    <p className="font-semibold text-stone-900">Business checkout</p>
                    <p className="mt-2 text-slate-600 leading-relaxed">
                      UPI (Google Pay, PhonePe, BHIM, etc.) and cards are collected on Razorpay’s secure page for MovEazy — open{" "}
                      <a href={razorpayHostedUrl} className="font-semibold text-rose-700 underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                        Pay on Razorpay
                      </a>{" "}
                      to complete payment. An optional on-page UPI QR can be enabled later using your Razorpay business UPI or a hosted QR image.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-5 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">or scan QR</div>

                    <div className="mb-6 rounded-2xl bg-gradient-to-r from-rose-400 via-orange-300 to-violet-400 p-[2px] shadow-lg bg-[length:240%_240%] animate-gradient-shift">
                      <div className="rounded-[14px] bg-gradient-to-b from-stone-50/95 to-white p-6 text-center">
                        <Tilt3D intensity={5} scale={1.02} className="mx-auto inline-block rounded-xl">
                          <div className="w-52 h-52 mx-auto bg-white rounded-xl shadow-inner flex items-center justify-center border border-stone-200/80 p-2 ring-2 ring-white">
                            {qrSrc ? (
                              <img src={qrSrc} alt={product.qrAlt} width={220} height={220} className="max-w-full h-auto rounded-md" decoding="async" />
                            ) : null}
                          </div>
                        </Tilt3D>
                        <p className="mt-4 text-sm font-semibold text-stone-800">Scan with any UPI app</p>
                        <p className="text-xs text-slate-500 mt-1">Google Pay • PhonePe • Paytm • BHIM</p>
                      </div>
                    </div>

                    {businessUpiVpa ? (
                      <div className="bg-sky-50/90 rounded-xl p-4 mb-6 text-sm border border-sky-100 ring-1 ring-sky-200/40">
                        <div className="font-semibold text-sky-950 mb-2">Business UPI ID</div>
                        <div className="text-sky-900 space-y-1">
                          <div>
                            UPI: <span className="font-mono font-bold">{businessUpiVpa}</span>
                          </div>
                          <div>After payment, share screenshot on WhatsApp:</div>
                          <a
                            href={whatsAppReceiptHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
                          >
                            💬 Share on WhatsApp
                          </a>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {hasDirectUpiFallback && !businessUpiVpa ? (
                  <div className="bg-sky-50/90 rounded-xl p-4 mb-6 text-sm border border-sky-100 ring-1 ring-sky-200/40">
                    <div className="font-semibold text-sky-950 mb-2">Receipt</div>
                    <div className="text-sky-900 space-y-1">
                      <div>After payment, share screenshot on WhatsApp:</div>
                      <a
                        href={whatsAppReceiptHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
                      >
                        💬 Share on WhatsApp
                      </a>
                    </div>
                  </div>
                ) : null}

                {!hasDirectUpiFallback ? (
                  <div className="bg-sky-50/90 rounded-xl p-4 mb-6 text-sm border border-sky-100 ring-1 ring-sky-200/40">
                    <div className="font-semibold text-sky-950 mb-2">After paying on Razorpay</div>
                    <div className="text-sky-900 space-y-1">
                      <div>Share your Razorpay receipt or payment screenshot on WhatsApp so we can confirm:</div>
                      <a
                        href={whatsAppReceiptHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
                      >
                        💬 Share on WhatsApp
                      </a>
                    </div>
                  </div>
                ) : null}

                {!confirmed ? (
                  <motion.button
                    type="button"
                    onClick={() => setConfirmed(true)}
                    className="relative w-full overflow-hidden rounded-xl py-4 font-bold text-base text-white shadow-red-lg"
                    style={{
                      background: "linear-gradient(135deg, #e11d48 0%, #ea580c 45%, #c026d3 100%)",
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{ boxShadow: ["0 8px 28px rgba(225,29,72,0.45)", "0 12px 40px rgba(225,29,72,0.65)", "0 8px 28px rgba(225,29,72,0.45)"] }}
                    transition={{ boxShadow: { duration: 2.2, repeat: Infinity, ease: "easeInOut" } }}
                  >
                    <span className="relative z-[1]">I&apos;ve made the payment — continue</span>
                    <motion.span
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
                    />
                  </motion.button>
                ) : (
                  <div className="text-center">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-4 shadow-sm">
                      <motion.div
                        className="text-4xl mb-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 16 }}
                      >
                        🎉
                      </motion.div>
                      <div className="font-bold text-emerald-900 text-lg">Payment received</div>
                      <div className="text-sm font-semibold text-emerald-900/90 mt-1">{product.confirmTitle}</div>
                      <div className="text-sm text-emerald-700/90 mt-2">{product.confirmBody}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="px-8 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-md transition-colors"
                    >
                      Back to home
                    </button>
                  </div>
                )}

                <p className="mt-5 text-center text-[11px] font-medium text-slate-400">
                  Trusted checkout · UPI protected · No card data stored on {BRAND_PAYEE_NAME}
                </p>
              </div>
            </Tilt3D>
          </div>
        </motion.div>
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
