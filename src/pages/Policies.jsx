/**
 * Refunds & cancellation, and how the service is delivered — the two policies
 * a payment gateway's review reads, alongside Terms and Privacy. Same frame as
 * the Terms page; the business details come from lib/business.js.
 */
import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import { useLandingSettings } from "../lib/landingSettings";
import { BUSINESS } from "../lib/business";

const H2 = "text-xl font-bold text-gray-900 mt-8 mb-3";
const A = "text-red-500 hover:underline";

function PolicyPage({ title, children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden antialiased bg-gradient-to-b from-stone-50 via-white to-rose-50/30">
      <PremiumPageBackdrop variant="marketing" overlayOnly />
      <Navbar variant="marketing" />
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-stone-200/70 bg-white/92 p-8 shadow-xl backdrop-blur-md ring-1 ring-stone-900/[0.04] md:p-10">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-stone-900 via-rose-900 to-orange-800 bg-clip-text text-transparent">{title}</span>
          </h1>
          <p className="text-slate-500 text-sm mb-10 font-medium">Last updated: October 2026</p>
          <div className="prose prose-gray max-w-none space-y-6 text-[15px] leading-relaxed text-gray-600">
            {children}
            <ContactSection />
          </div>
        </div>
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}

function ContactSection() {
  return (
    <section>
      <h2 className={H2}>Contact us</h2>
      <p>
        {BUSINESS.name}, {BUSINESS.address}.<br />
        Call or WhatsApp <a href={BUSINESS.phoneTel} className={A}>{BUSINESS.phoneDisplay}</a> · email{" "}
        <a href={`mailto:${BUSINESS.email}`} className={A}>{BUSINESS.email}</a> · {BUSINESS.hours}.<br />
        Or write to us on the <Link to="/contact" className={A}>contact page</Link>.
      </p>
    </section>
  );
}

export function RefundPolicy() {
  const program = useLandingSettings();
  const premium = `₹${Number(program.premiumPrice).toLocaleString("en-IN")}`;
  return (
    <PolicyPage title="Refunds & Cancellation">
      <section>
        <p>
          This policy covers every payment made to {BUSINESS.name} on moveazy.co.in and the MovEazy Partners app
          (partners.moveazy.co.in), whether by UPI, card, netbanking or a Razorpay payment link.
        </p>
      </section>

      <section>
        <h2 className={H2}>1. MovEazy leads for broker partners</h2>
        <p>
          A pack of 30 MovEazy leads costs ₹2,000 (or the price shown in the partner app when you buy). Leads are a
          digital service: the names and numbers of people looking for a flat, delivered in the app.
        </p>
        <p className="mt-3">
          <strong className="text-gray-900">No refunds once paid.</strong> Lead packs are not refundable after payment.
          The only exceptions are a payment that failed but was still debited, and a payment made twice for the same
          pack — the failed or extra amount is refunded in full.
        </p>
        <p className="mt-3">
          <strong className="text-gray-900">Cancelling.</strong> You can drop a lead request any time before you pay,
          at no cost. Once a payment is made, the request can't be cancelled.
        </p>
        <p className="mt-3">
          The 10 free leads a partner can ask for once, and leads given to Premium partners, cost nothing upfront, so
          there is nothing to refund.
        </p>
      </section>

      <section>
        <h2 className={H2}>2. MovEazy Partners Premium</h2>
        <p>
          Premium is billed monthly (currently {premium} a month) and is <strong className="text-gray-900">100% refundable</strong>:
          if you find it isn't useful, tell us on WhatsApp or by email during that month and we'll end your Premium
          access and refund that month's fee in full — no questions asked. You can stop Premium at any time the same way.
        </p>
        <p className="mt-3">
          Premium partners pay MovEazy a share only when a deal with a MovEazy lead closes (30% of one month's rent when
          you dealt directly with the owner, 20% when other brokers were involved). It is due on closure, not before.
        </p>
      </section>

      <section>
        <h2 className={H2}>3. Tenant services</h2>
        <p>
          Refunds on the MovEazy Guarantee and Flat Search are set out in <Link to="/terms" className={A}>our Terms</Link>:
          they are issued when a deal falls through because of verified broker negligence.
        </p>
      </section>

      <section>
        <h2 className={H2}>4. How refunds are paid</h2>
        <p>
          Approved refunds go back to the original payment method within 7–14 business days. To ask for one, message
          us with your registered mobile number and the payment ID or UPI reference (UTR).
        </p>
      </section>
    </PolicyPage>
  );
}

export function DeliveryPolicy() {
  return (
    <PolicyPage title="Service Delivery">
      <section>
        <p>
          {BUSINESS.name} sells digital services only. Nothing is shipped — everything you pay for is delivered online,
          in the MovEazy website or the MovEazy Partners app, and confirmed on WhatsApp.
        </p>
      </section>

      <section>
        <h2 className={H2}>1. MovEazy leads for broker partners</h2>
        <p>
          Leads appear in the partner app under <strong className="text-gray-900">Leads → MovEazy leads</strong>, with
          each person's name, number and what they're looking for, and you get a notification.
        </p>
        <ul className="list-disc pl-5 mt-3 space-y-1.5">
          <li>Your first request is filled instantly.</li>
          <li>Later requests are filled within 24 hours of the payment being confirmed.</li>
          <li>
            Online payments are confirmed the moment they go through. A UPI payment made by scanning our QR is confirmed
            once our team matches the UPI reference (UTR) you enter.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={H2}>2. MovEazy Partners Premium</h2>
        <p>Premium starts as soon as the payment is confirmed, and lasts for the month you paid for.</p>
      </section>

      <section>
        <h2 className={H2}>3. Tenant services</h2>
        <p>
          The MovEazy Guarantee and Flat Search begin once the payment is confirmed; our team reaches out on WhatsApp
          to get started.
        </p>
      </section>

      <section>
        <h2 className={H2}>4. If something hasn't arrived</h2>
        <p>
          If leads or Premium haven't shown up within 24 hours of a confirmed payment, message us with your registered
          mobile number and the payment ID or UTR, and we'll sort it out the same day.
        </p>
      </section>
    </PolicyPage>
  );
}
