import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import PremiumPageBackdrop from "../components/ui/PremiumPageBackdrop";
import ServicesHero from "../components/sections/ServicesHero";
import StorySection from "../components/sections/StorySection";
import CoreValues from "../components/sections/CoreValues";
import ServicesTimeline from "../components/sections/ServicesTimeline";
import BuiltMoveazy from "../components/sections/BuiltMoveazy";
import ServiceRecap from "../components/sections/ServiceRecap";
import ServicesCTA from "../components/sections/ServicesCTA";

export default function Services() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#f3f5f7] via-white to-[#eef2f5] antialiased">
      <PremiumPageBackdrop variant="marketing" overlayOnly />

      <Navbar variant="marketing" />

      <main className="relative z-10 space-y-2 pb-4">
        <ServicesHero />
        <StorySection />
        <CoreValues />
        <ServicesTimeline />
        <BuiltMoveazy />
        <ServiceRecap />
        <ServicesCTA />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
