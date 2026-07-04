import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import { useSitePublicSettings } from "../hooks/useSitePublicSettings";

export default function Privacy() {
  const { sitePublic } = useSitePublicSettings();
  return (
    <div className="relative min-h-screen overflow-x-hidden antialiased bg-gradient-to-b from-stone-50 via-white to-rose-50/30">
      <PremiumPageBackdrop variant="marketing" overlayOnly />
      <Navbar variant="marketing" />
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-stone-200/70 bg-white/92 p-8 shadow-xl backdrop-blur-md ring-1 ring-stone-900/[0.04] md:p-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          <span className="bg-gradient-to-r from-stone-900 via-rose-900 to-orange-800 bg-clip-text text-transparent">
            Privacy Policy
          </span>
        </h1>
        <p className="text-slate-500 text-sm mb-10 font-medium">Last updated: April 2026</p>

        <div className="prose prose-gray max-w-none space-y-6 text-[15px] leading-relaxed text-gray-600">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Information We Collect</h2>
            <p>
              We collect information you provide directly: name, email address, phone number, and property
              preferences. We also collect usage data such as pages visited, search queries, and interaction patterns
              to improve our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. How We Use Your Information</h2>
            <p>Your information is used to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Match you with suitable property listings</li>
              <li>Process Guarantee Plan enrollments and payments</li>
              <li>Send important notifications about your account and listings</li>
              <li>Improve our platform experience through analytics</li>
              <li>Connect you with our verified sales consultants</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Data Sharing</h2>
            <p>
              We do not sell your personal data. Your information may be shared with property owners or
              brokers only when you express interest in a specific listing. Payment information is processed
              securely through UPI and is never stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Data Security</h2>
            <p>
              We use Firebase Authentication with industry-standard encryption to protect your account.
              All communications between your browser and our servers are encrypted via HTTPS/TLS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Cookies & Local Storage</h2>
            <p>
              We use browser local storage to save your session and preferences. No third-party tracking
              cookies are used. You can clear this data at any time through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data at any time
              by contacting us. Account deletion requests are processed within 48 hours.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. Contact</h2>
            <p>
              For privacy-related inquiries, contact our Data Protection Officer at{" "}
              <a href={`mailto:${sitePublic.privacyEmail}`} className="text-red-500 hover:underline">
                {sitePublic.privacyEmail}
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
