import { useNavigate } from "react-router-dom";
import userMaleIcon from "../../assets/icons/user-male.png";
import realEstateAgentIcon from "../../assets/icons/real-estate-agent.png";
import Tilt3D from "../ui/Tilt3D";
import useGsapStaggerReveal from "../../hooks/useGsapStaggerReveal";

const FEATURES = [
  {
    icon: userMaleIcon,
    title: "Personalized City Guidance",
    desc: "We help you understand the city, best areas, commute realities, and what truly fits your lifestyle before you even start.",
    gradient: "from-[#e85a4f] to-[#f97316]",
    glow: "rgba(232,90,79,0.40)",
  },
  {
    icon: realEstateAgentIcon,
    title: "Broker-Matched, Not Listing-Based",
    desc: "Skip outdated platforms. We connect you directly with trusted brokers who have real-time, high-quality properties.",
    gradient: "from-[#f97316] to-[#ec4899]",
    glow: "rgba(249,115,22,0.40)",
  },
  {
    icon: userMaleIcon,
    title: "Faster Home Finalization",
    desc: "Get curated options, quick site visits, and close deals before the best homes disappear.",
    gradient: "from-[#ec4899] to-[#8b5cf6]",
    glow: "rgba(236,72,153,0.40)",
  },
  {
    icon: userMaleIcon,
    title: "Deposit Protection Guaranteed",
    desc: "Avoid unfair deductions with our MovEazy Guarantee — legal support that ensures you get your money back.",
    gradient: "from-[#8b5cf6] to-[#e85a4f]",
    glow: "rgba(139,92,246,0.40)",
  },
];

function FeatureCard({ icon, title, desc, gradient, glow }) {
  return (
    <div data-gsap-reveal>
      <Tilt3D intensity={6} scale={1.02} className="h-full">
        <div
          className="flex gap-4 sm:gap-5 p-5 rounded-2xl bg-white border border-gray-100 h-full"
          style={{
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            transition: "box-shadow 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 12px 40px ${glow}, 0 4px 16px rgba(0,0,0,0.08)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.06)";
          }}
        >
          {icon ? (
            <div
              className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 mt-0.5 bg-gradient-to-br ${gradient} rounded-2xl p-2.5 sm:p-3 shadow-lg`}
              style={{ boxShadow: `0 6px 20px ${glow}` }}
            >
              <img
                src={icon}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-contain select-none"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-14 h-14 mt-0.5 opacity-0" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <h3 className="text-[17px] sm:text-[19px] lg:text-[20px] font-bold text-ink leading-snug">
              {title}
            </h3>
            <p className="mt-2.5 text-[15px] sm:text-[16px] lg:text-[17px] text-ink-muted leading-relaxed">
              {desc}
            </p>
          </div>
        </div>
      </Tilt3D>
    </div>
  );
}

export default function Features() {
  const navigate = useNavigate();
  const sectionRef = useGsapStaggerReveal({ y: 24, stagger: 0.1, start: "top 78%" });

  return (
    <section ref={sectionRef} className="bg-mesh-light py-20 sm:py-24 lg:py-28" style={{ background: "" }}>
      <div
        className="mx-auto w-full max-w-7xl px-5 sm:px-8 xl:max-w-[90rem] xl:px-12 2xl:px-16 pt-8 sm:pt-12"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 10% 30%, rgba(232,90,79,0.06), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 70%, rgba(249,115,22,0.05), transparent 55%), #FFF1F1",
        }}
      >
        {/* Title */}
        <div className="text-center mb-14 sm:mb-16 lg:mb-20" data-gsap-reveal>
          <h2 className="text-[32px] sm:text-[40px] lg:text-[48px] xl:text-[52px] font-extrabold text-ink leading-[1.12] tracking-tight max-w-[1100px] mx-auto">
            Thousands Are Moving{" "}
            <span className="gradient-text">Smarter</span>{" "}
            with MovEazy
          </h2>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6 lg:gap-x-8">
          {FEATURES.map(({ icon, title, desc, gradient, glow }) => (
            <FeatureCard
              key={title}
              icon={icon}
              title={title}
              desc={desc}
              gradient={gradient}
              glow={glow}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-14 sm:mt-16 lg:mt-20" data-gsap-reveal>
          <button
            type="button"
            onClick={() => navigate("/plan")}
            className="px-9 py-4 text-[15px] sm:text-[16px] font-semibold text-white bg-primary rounded-xl btn-glow-pulse"
          >
            Personalized match
          </button>
        </div>
      </div>
    </section>
  );
}
