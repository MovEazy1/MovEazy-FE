/**
 * Fork home — the new "/" landing page.
 * Design matches moveazy-home.html (Fraunces serif, paper/rust/verified palette).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import ProfileNavLink, { SignInLink } from "../components/account/UserAccountMenu";
import FlatSearchAgentChat from "../components/FlatSearchAgentChat";

const EASE = [0.22, 1, 0.36, 1];

function FadeUp({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ size = 10 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width={size} height={size}>
      <path d="M4 12l5 5L20 7" />
    </svg>
  );
}

function ChevronRight({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function VerifyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function PassportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <path d="M3 12h4l3 8 4-16 3 8h4" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17">
      <circle cx="8" cy="15" r="4" />
      <path d="M20 7l-2-2-5.37 5.37A6 6 0 1 0 12 15.5" />
    </svg>
  );
}

/* ── Handover visual card ──────────────────────────────────────────────────── */
function HandoverVisual() {
  return (
    <div
      style={{
        background: "#FFFEFB",
        border: "1px solid #D9D3C4",
        borderRadius: 18,
        padding: "26px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {[
          { label: "Vacating", initials: "AR", name: "Aditi R." },
          null,
          { label: "Moving in", initials: "KS", name: "Karthik S." },
        ].map((card, i) =>
          card ? (
            <div
              key={i}
              style={{
                flex: 1,
                background: "#F7F4ED",
                border: "1px solid #D9D3C4",
                borderRadius: 13,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 9.5,
                  color: "#8B8578",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  width: 34, height: 34,
                  borderRadius: "50%",
                  background: "#E3EEE7",
                  border: "1px solid #2D6A4F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 12, fontWeight: 500, color: "#2D6A4F",
                  marginBottom: 10,
                }}
              >
                {card.initials}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3 }}>{card.name}</div>
              <div style={{ fontSize: 11.5, color: "#2D6A4F", display: "flex", alignItems: "center", gap: 4 }}>
                <CheckIcon size={10} />
                Verified tenant
              </div>
            </div>
          ) : (
            <div
              key={i}
              style={{
                width: 34, height: 34, borderRadius: "50%",
                border: "1.5px solid #C8500F", color: "#C8500F",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowIcon />
            </div>
          )
        )}
      </div>
      <div
        style={{
          marginTop: 18, paddingTop: 16,
          borderTop: "1px dashed #D9D3C4",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 10.5,
            color: "#2D6A4F", background: "#E3EEE7",
            border: "1px solid #2D6A4F",
            padding: "4px 10px", borderRadius: 20,
            textTransform: "uppercase", letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          Trust Passport
        </span>
        <span style={{ fontSize: 12.5, color: "#8B8578", lineHeight: 1.4 }}>
          carries the home's verified history forward — water, society, deposit terms, all of it.
        </span>
      </div>
    </div>
  );
}

/* ── How it works grid ─────────────────────────────────────────────────────── */
const HOW_STEPS = [
  { num: "01", icon: <HomeIcon />, title: "List your handover", desc: "Tell us your move-out date and rent — your existing Trust Passport verification carries straight over." },
  { num: "02", icon: <VerifyIcon />, title: "We verify the match", desc: "Incoming tenants are Aadhaar-verified before they can even see your contact details." },
  { num: "03", icon: <PassportIcon />, title: "The passport transfers", desc: "Society rules, water timings, deposit terms, landlord history — handed to them directly." },
  { num: "04", icon: <KeyIcon />, title: "Hand over the keys", desc: "Deposit and notice handled between verified parties — no relisting, no more strangers." },
];

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function ForkHome() {
  const { user, loading } = useAuth();
  const ctaTo = user ? "/profile" : "/auth?next=/profile";
  const [showChatbot, setShowChatbot] = useState(false);

  return (
    <div style={{ background: "#F7F4ED", color: "#1A2421", fontFamily: "Inter, sans-serif", minHeight: "100dvh" }}>

      {/* ── Brand bar ── */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30, height: 30, border: "1.5px solid #1A2421",
            borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 500,
          }}
        >
          MZ
        </div>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 19, fontWeight: 600, letterSpacing: "0.01em" }}>
          Moveazy
        </div>
        <div style={{ flex: 1 }} />
        {loading ? (
          <div style={{ width: 96, height: 36 }} aria-hidden />
        ) : user ? (
          <ProfileNavLink user={user} />
        ) : (
          <SignInLink />
        )}
      </div>

      {/* ── Fork hero ── */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "56px 24px 88px", textAlign: "center" }}>
        <FadeUp>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: "#8B8578",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16,
            }}
          >
            Bangalore rentals, verified both ways
          </div>
        </FadeUp>

        <FadeUp delay={0.08}>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(28px, 5vw, 38px)",
              fontWeight: 600, lineHeight: 1.18, letterSpacing: "-0.01em", marginBottom: 14,
            }}
          >
            What brings you to Moveazy today?
          </h1>
        </FadeUp>

        <FadeUp delay={0.14}>
          <p style={{ fontSize: 16, opacity: 0.72, maxWidth: 480, margin: "0 auto 48px", lineHeight: 1.6 }}>
            Two doors in. Same Trust Passport behind both — built so nobody has to guess
            who they&apos;re renting from, or to.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, textAlign: "left" }}>

            {/* ── Seeker card ── */}
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
              onClick={() => setShowChatbot(true)}
              style={{
                background: "#FFFEFB", border: "1px solid #D9D3C4",
                borderTop: "3px solid #2D6A4F",
                borderRadius: "20px 20px 18px 18px", padding: 32,
                display: "flex", flexDirection: "column", height: "100%",
                cursor: "pointer", color: "#1A2421",
              }}
            >
              <div
                style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: "#E3EEE7", color: "#2D6A4F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <SearchIcon />
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "#2D6A4F", marginBottom: 10,
                }}
              >
                I&apos;m looking for a flat
              </div>
              <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
                Find your next home
              </h2>
              <p style={{ fontSize: 14.5, color: "#8B8578", lineHeight: 1.55, marginBottom: 24, flexGrow: 1 }}>
                Tell us your area, budget, and move-in date. We&apos;ll match you against verified listings —
                owners confirmed, deposits explained upfront, nothing left to guesswork.
              </p>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 500,
                  padding: "13px 22px", borderRadius: 10, width: "fit-content",
                  background: "#1A2421", color: "#F7F4ED",
                }}
              >
                Describe your next home <ChevronRight />
              </div>
            </motion.div>

            {/* ── Vacating card (coming soon) ── */}
            <motion.div
              style={{
                background: "#FFFEFB", border: "1px solid #D9D3C4",
                borderTop: "3px solid #C8500F",
                borderRadius: "20px 20px 18px 18px", padding: 32,
                display: "flex", flexDirection: "column", height: "100%",
                cursor: "default", color: "#1A2421", opacity: 0.65,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute", top: 20, right: 20,
                  fontFamily: "JetBrains Mono, monospace", fontSize: 10.5,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "#8B8578", background: "#F1ECE1",
                  padding: "4px 10px", borderRadius: 999,
                }}
              >
                Coming soon
              </div>
              <div
                style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: "#FBEAE0", color: "#C8500F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <ArrowIcon />
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "#C8500F", marginBottom: 10,
                }}
              >
                I&apos;m vacating mine
              </div>
              <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
                Pass your flat forward
              </h2>
              <p style={{ fontSize: 14.5, color: "#8B8578", lineHeight: 1.55, marginBottom: 24, flexGrow: 1 }}>
                Skip the broker and the blank-slate listing. Hand your flat to a verified incoming tenant directly,
                and carry your Trust Passport history with you, both ways.
              </p>
              <div
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 500,
                  padding: "13px 22px", borderRadius: 10, width: "fit-content",
                  background: "#D9D3C4", color: "#8B8578", cursor: "not-allowed",
                }}
              >
                Coming soon
              </div>
            </motion.div>

          </div>
        </FadeUp>
      </section>

      {/* ── Divider ── */}
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px" }}>
        <hr style={{ border: "none", borderTop: "1px dashed #D9D3C4", marginBottom: 80 }} />
      </div>

      {/* ── Pass-it-forward detail ── */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "0 24px 96px" }}>

        <FadeUp>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 56, alignItems: "center", marginBottom: 88 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8500F" }} />
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: "#C8500F",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}
                >
                  For tenants who are vacating
                </span>
              </div>
              <h2
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "clamp(26px, 4vw, 34px)",
                  fontWeight: 600, lineHeight: 1.16, letterSpacing: "-0.01em", marginBottom: 18,
                }}
              >
                Pass your flat to{" "}
                <em style={{ fontStyle: "italic", color: "#C8500F" }}>your replacement.</em>
                <br />Not a stranger.
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.78, maxWidth: 440, marginBottom: 28 }}>
                Hand off directly to a verified incoming tenant — and carry your Trust Passport history
                with you, both ways.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  to={ctaTo}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    fontSize: 14.5, fontWeight: 500, padding: "13px 24px",
                    borderRadius: 10, background: "#C8500F", color: "#FFFEFB",
                    textDecoration: "none",
                  }}
                >
                  {user ? "Update your profile" : "Get started"} <ChevronRight />
                </Link>
              </div>
            </div>
            <HandoverVisual />
          </div>
        </FadeUp>

        {/* ── How it works ── */}
        <FadeUp delay={0.1}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#8B8578",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10,
              }}
            >
              How a handover works
            </div>
            <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 600 }}>
              Four steps. No broker in the middle.
            </h3>
          </div>

          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              border: "1px solid #D9D3C4", borderRadius: 16, overflow: "hidden", marginBottom: 88,
            }}
          >
            {HOW_STEPS.map((s, i) => (
              <div
                key={i}
                style={{
                  background: "#FFFEFB", padding: "26px 20px",
                  borderRight: i < HOW_STEPS.length - 1 ? "1px solid #D9D3C4" : "none",
                }}
              >
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#C8500F", marginBottom: 14 }}>
                  {s.num}
                </div>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10, background: "#EFEAE0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 15, color: "#1A2421",
                  }}
                >
                  {s.icon}
                </div>
                <h4 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 15.5, fontWeight: 600, marginBottom: 8 }}>
                  {s.title}
                </h4>
                <p style={{ fontSize: 12.5, color: "#8B8578", lineHeight: 1.55 }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {/* ── Value grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {[
              {
                accent: "#C8500F", eyebrow: "If you're vacating",
                title: "Leave without the hassle",
                items: [
                  "No relisting, no open houses with strangers",
                  "Your Trust Passport transfers automatically",
                  "Deposit mediated between verified parties",
                  "Notice period handled with documentation",
                ],
              },
              {
                accent: "#2D6A4F", eyebrow: "If you're moving in",
                title: "Know exactly what you're getting",
                items: [
                  "Incoming with full home history — no surprises",
                  "Water timings, society rules, landlord details",
                  "Deposit amount and terms documented upfront",
                  "No broker in the middle — direct from last tenant",
                ],
              },
            ].map((card) => (
              <div
                key={card.eyebrow}
                style={{
                  background: "#FFFEFB", border: "1px solid #D9D3C4",
                  borderTop: `3px solid ${card.accent}`,
                  borderRadius: "18px 18px 16px 16px", padding: 30,
                }}
              >
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    color: card.accent, marginBottom: 10,
                  }}
                >
                  {card.eyebrow}
                </div>
                <h4 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
                  {card.title}
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {card.items.map((item) => (
                    <li key={item} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
                      <span style={{ color: card.accent, flexShrink: 0, marginTop: 2 }}>
                        <CheckIcon size={15} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </FadeUp>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid #D9D3C4", maxWidth: 1040, margin: "0 auto",
          padding: "32px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16,
        }}
      >
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#8B8578", letterSpacing: "0.04em" }}>
          © 2026 Moveazy · Bengaluru
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {user ? (
            <Link to="/profile" style={{ fontSize: 13, color: "#8B8578", textDecoration: "none", fontWeight: 500 }}>
              My profile
            </Link>
          ) : (
            <Link to="/auth" style={{ fontSize: 13, color: "#8B8578", textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          )}
        </div>
      </footer>

      {/* ── Chatbot Modal ── */}
      <AnimatePresence>
        {showChatbot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowChatbot(false)}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(26, 36, 33, 0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 16,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#FFFEFB",
                borderRadius: 20,
                width: "100%",
                maxWidth: 720,
                height: "min(760px, 90dvh)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowChatbot(false)}
                style={{
                  position: "absolute", top: 14, right: 14, zIndex: 10,
                  width: 32, height: 32, borderRadius: "50%",
                  border: "1px solid #D9D3C4", background: "#F7F4ED",
                  cursor: "pointer", fontSize: 18, color: "#8B8578",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
              <FlatSearchAgentChat embedded className="flex-1 min-h-0 w-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
