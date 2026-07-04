import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import { useSitePublicSettings } from "../hooks/useSitePublicSettings";

export default function Terms() {
  const { sitePublic } = useSitePublicSettings();
  return (
    <div className="relative min-h-screen overflow-x-hidden antialiased bg-gradient-to-b from-stone-50 via-white to-rose-50/30">
      <PremiumPageBackdrop variant="marketing" overlayOnly />
      <Navbar variant="marketing" />
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-stone-200/70 bg-white/92 p-8 shadow-xl backdrop-blur-md ring-1 ring-stone-900/[0.04] md:p-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          <span className="bg-gradient-to-r from-stone-900 via-rose-900 to-orange-800 bg-clip-text text-transparent">
            Terms of Service
          </span>
        </h1>
        <p className="text-slate-500 text-sm mb-10 font-medium">Last updated: April 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-[15px] leading-relaxed text-gray-600">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the MovEazy platform ("Service"), you agree to be bound by these Terms of Service.
              If you do not agree, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Description of Service</h2>
            <p>
              MovEazy provides a digital platform connecting tenants with verified property listings in Bangalore.
              Our services include property discovery, broker verification, the Guarantee Plan (legal protection),
              and relocation assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. User Accounts</h2>
            <p>
              You must provide accurate and complete information when creating an account. You are responsible
              for maintaining the confidentiality of your login credentials. MovEazy reserves the right to
              suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Guarantee Plan</h2>
            <p>
              The MovEazy Guarantee (₹1,999) provides legal contract verification and deposit protection.
              Flat Search is billed separately (₹1,499). Refunds are issued only when a deal falls through due to verified broker negligence, as determined
              by our legal team. Processing time for refunds is 7–14 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Limitation of Liability</h2>
            <p>
              MovEazy acts as a technology intermediary and is not a party to any rental agreement between
              tenants and landlords. We do not guarantee the accuracy of all listing details and encourage
              users to independently verify property conditions before signing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. Intellectual Property</h2>
            <p>
              All content, branding, and technology on the MovEazy platform are the property of
              MovEazy Architectural Relocation. Unauthorized reproduction or distribution is prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. Contact</h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a href={`mailto:${sitePublic.supportEmail}`} className="text-red-500 hover:underline">
                {sitePublic.supportEmail}
              </a>
              {" "}
              or call{" "}
              <a href={sitePublic.legalPhoneTel} className="text-red-500 hover:underline">
                {sitePublic.legalPhoneDisplay}
              </a>
              .
            </p>
          </section>
        </div>
        </div>
      </main>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
