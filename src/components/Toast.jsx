import { motion, AnimatePresence } from "framer-motion";

/**
 * A brief top-of-screen confirmation, for a success that also closes
 * whatever the user was looking at (e.g. a booked visit) — the toast is
 * what's left to tell them it worked. Not self-dismissing; the caller owns
 * the message's lifetime (set it, clear it after a timeout).
 */
export default function Toast({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
            zIndex: 4000, maxWidth: "92vw",
            display: "flex", alignItems: "center", gap: 8,
            background: "#04211D", color: "#5EEAD4",
            padding: "12px 20px", borderRadius: 999,
            fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(4,33,29,.35)",
          }}
        >
          <span aria-hidden>🎉</span>
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
