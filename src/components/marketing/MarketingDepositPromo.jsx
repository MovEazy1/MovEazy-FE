import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import depositArt from "../../assets/images/guarentee-deposit.png";

const EASE = [0.22, 1, 0.36, 1];

const FEATURES = [
  "Deep cleaning & handover support",
  "Minor repair coordination",
  "Deposit dispute assistance",
  "Documentation & checklists",
];

const TRUST = ["Verified experts", "Transparent pricing", "On-time service", "Quality assurance"];

export default function MarketingDepositPromo() {
  const navigate = useNavigate();

  return (
    <section className="mkt-deposit max-w-[1330px] mx-auto w-full rounded-[20px] px-6 sm:px-11 py-12 sm:py-16 bg-white border border-stone-100">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#111827] leading-tight">
            Get Your Full Deposit Back for Just{" "}
            <span className="text-[#ff3131]">₹1499</span>
          </h2>
          <p className="mt-4 text-[#6b7280] text-base leading-relaxed">
            Move-out stress ends here. MovEazy Deposit Saver helps you protect your deposit with verified support.
          </p>
          <ul className="mt-6 space-y-2.5">
            {FEATURES.map((t) => (
              <li key={t} className="flex gap-2 text-sm font-medium text-stone-800">
                <span className="text-[#ff3131]">✓</span> {t}
              </li>
            ))}
          </ul>
          <button type="button" className="mkt-btn-primary mkt-btn-red mt-8" onClick={() => navigate("/guarantee")}>
            Get Deposit Saver →
          </button>
        </motion.div>

        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <img src={depositArt} alt="" className="max-w-[320px] w-full drop-shadow-lg" draggable={false} />
        </motion.div>
      </div>

      <div className="mt-10 pt-8 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        {TRUST.map((label) => (
          <div key={label} className="text-sm font-semibold text-stone-700">
            <span className="block text-2xl mb-1 text-[#ff3131]">✓</span>
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}
