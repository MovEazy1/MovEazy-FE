// src/components/sections/GuaranteeFAQ.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import consultantImg from "../../assets/images/kuldeep.png";

const EASE = [0.22, 1, 0.36, 1];

const FAQS = [
  {
    q: "What Exactly Is MovEazy Guarantee?",
    a: "MovEazy Guarantee is a protection plan that helps you avoid illegal security deposit deductions during move-out. It works with legal and operational support to audit your rental agreement, document the property condition, and negotiate directly with your landlord if any unfair charges arise.",
  },
  {
    q: "How Does MovEazy Protect My Deposit?",
    a: "We protect your deposit through a three-step Structural Shield process: legal audit of your contract, comprehensive photo and document verification of the property, and direct legal negotiation with your landlord to dispute any invalid deductions.",
  },
  {
    q: "What If The Owner Still Refuses To Return My Deposit?",
    a: "If your landlord refuses to comply after our negotiation, MovEazy will escalate the matter through legal channels. We provide binding contract documentation and evidence gathered during the move-in/move-out inspection to back your claim.",
  },
  {
    q: "When Should I Take The MovEazy Guarantee Plan?",
    a: "Ideally, subscribe before or at the time of signing your rental agreement. This gives us time to audit the contract and establish a baseline property condition record. However, you can also subscribe during your tenancy or at move-out to still get protection.",
  },
  {
    q: "What Does The ₹1999 Plan Include?",
    a: "The ₹1999 plan includes: full legal audit of your rental agreement, a comprehensive move-out inspection report, photographic and written documentation, direct landlord negotiation by our legal team, and coverage for broker negligence that leads to financial loss on your deposit.",
  },
];

function AccordionItem({ item, index, isOpen, onToggle }) {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggle}
        className="
          w-full flex items-center justify-between
          py-6 text-left
          group focus:outline-none
        "
        aria-expanded={isOpen}
      >
        <span className="text-[15px] sm:text-[16px] font-bold text-[#1E2A3A] pr-4 leading-snug transition-colors duration-150">
          {index}. {item.q}
        </span>
        <span
          className={`
            flex-shrink-0 w-8 h-8 rounded-full
            flex items-center justify-center
            text-[20px] font-light
            transition-all duration-200
            ${
              isOpen
                ? "bg-[#1E2A3A] text-white border border-[#1E2A3A]"
                : "text-gray-400 border border-gray-300 group-hover:border-[#1E2A3A] group-hover:text-[#1E2A3A]"
            }
          `}
        >
          {isOpen ? "×" : "+"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[14px] sm:text-[15px] text-gray-500 leading-[1.8]">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GuaranteeFAQ() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(0);

  const handleToggle = (i) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="bg-white py-20 sm:py-24 lg:py-28">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-10">
        <div className="grid lg:grid-cols-[300px_1fr] gap-12 lg:gap-20 items-start">

          {/* ── LEFT PANEL ──────────────────────────────────────────── */}
          <div className="flex flex-col gap-8">
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="
                text-[26px] sm:text-[30px] lg:text-[34px]
                font-extrabold text-[#1E2A3A]
                leading-[1.18] tracking-tight
              "
            >
              Frequently Asked Questions
            </motion.h2>

            {/* Book-a-call card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="
                rounded-xl border border-gray-200 bg-white
                px-5 py-5 shadow-sm
                flex flex-col gap-4
              "
            >
              {/* Avatar — stacked above text */}
              <div className="flex flex-col gap-3">
                <div className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border border-gray-100">
                  <img
                    src={consultantImg}
                    alt="Consultation advisor"
                    className="w-full h-full object-cover object-top"
                    draggable={false}
                  />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#1E2A3A]">Book A 15 Min Call</p>
                  <p className="mt-1 text-[12px] text-gray-400 leading-[1.6]">
                    Questions before you subscribe? Reach us on the contact page — MovEazy Flat Search starts at ₹1,499; Guarantee is ₹1,999.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/contact")}
                className="
                  w-full py-[10px] text-[13px] font-semibold
                  text-white bg-[#E85A4F] rounded-lg
                  hover:bg-[#D64A3F] active:scale-[0.975]
                  transition-all duration-200
                "
              >
                Contact &amp; paid match
              </button>
            </motion.div>
          </div>

          {/* ── RIGHT: Accordion ─────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.65, ease: EASE }}
          >
            {FAQS.map((item, i) => (
              <AccordionItem
                key={i}
                item={item}
                index={i + 1}
                isOpen={openIndex === i}
                onToggle={() => handleToggle(i)}
              />
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  );
}
