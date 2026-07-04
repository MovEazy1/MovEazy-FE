import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import MarketingHomeSections from "../components/marketing/MarketingHomeSections";

/* Legacy homepage sections — kept in codebase; not shown on marketing home (Figma v2). */
import Hero from "../components/sections/Hero";
import Stats from "../components/sections/Stats";
import Features from "../components/sections/Features";
import HowItWorks from "../components/sections/HowItWorks";
import Comparison from "../components/sections/Comparison";
import SmartMatch from "../components/sections/SmartMatch";
import GuaranteePlan from "../components/sections/GuaranteePlan";
import CityCTA from "../components/sections/CityCTA";

const SHOW_LEGACY_HOME_SECTIONS = false;

export default function Home() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-mesh-light antialiased">
      <Navbar variant="marketing" />

      <main className="relative z-10 pt-5">
        <MarketingHomeSections />

        {SHOW_LEGACY_HOME_SECTIONS ? (
          <>
            <Hero />
            <Stats />
            <Features />
            <SmartMatch />
            <HowItWorks />
            <Comparison />
            <GuaranteePlan />
            <CityCTA />
          </>
        ) : (
          <div className="hidden" aria-hidden>
            <Hero />
            <Stats />
            <Features />
            <SmartMatch />
            <HowItWorks />
            <Comparison />
            <GuaranteePlan />
            <CityCTA />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
