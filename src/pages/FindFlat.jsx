/**
 * /find — seeker chatbot page.
 * The chat itself restores in-progress conversations from localStorage and,
 * for signed-in customers, pre-fills answers from (and syncs back to) their
 * saved dashboard search profile — see FlatSearchAgentChat.jsx.
 */
import { Link } from "react-router-dom";
import FlatSearchAgentChat from "../components/FlatSearchAgentChat";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ProfileNavLink, { SignInLink } from "../components/account/UserAccountMenu";

export default function FindFlat() {
  const { user, logout, loading } = useAuth();
  return (
    <div
      style={{
        background: "#F7F4ED",
        minHeight: "100dvh",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600, color: "#8B8578",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={15} />
          Back
        </Link>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace", fontSize: 11.5, color: "#8B8578",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}
        >
          Find a flat
        </div>
        <div style={{ flex: 1 }} />
        {loading ? (
          <div style={{ width: 96, height: 28 }} aria-hidden />
        ) : user ? (
          <ProfileNavLink user={user} />
        ) : (
          <SignInLink />
        )}
      </div>

      {/* ── Content ── */}
      <main
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "0 24px 64px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "48px 56px",
          alignItems: "start",
        }}
      >
        {/* Left — intro */}
        <div style={{ paddingTop: 8 }}>
          <div
            style={{
              width: 46, height: 46, borderRadius: 12,
              background: "#E3EEE7", color: "#2D6A4F",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>

          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(24px, 4vw, 32px)",
              fontWeight: 600, lineHeight: 1.2, marginBottom: 14,
            }}
          >
            Tell us what you need —<br />
            <span style={{ color: "#2D6A4F" }}>we&apos;ll find the flat.</span>
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.65, color: "#4a5568", marginBottom: 28, maxWidth: 420 }}>
            Answer a few quick questions in the chat. Our agent will rank verified listings from
            Bangalore&apos;s live catalogue by how well they match your preferences.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { num: "1", text: "Area, budget, BHK, move-in date" },
              { num: "2", text: "Must-haves (parking, gym, pet-friendly…)" },
              { num: "3", text: "Ranked matches with a % score" },
            ].map(({ num, text }) => (
              <div key={num} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14 }}>
                <span
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: "#1A2421", color: "#F7F4ED",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {num}
                </span>
                <span style={{ color: "#1A2421", lineHeight: 1.5, paddingTop: 3 }}>{text}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 36 }}>
            <Link
              to="/new-listings"
              style={{
                fontSize: 13, fontWeight: 600, color: "#8B8578",
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              Browse all listings →
            </Link>
          </div>
        </div>

        {/* Right — chatbot */}
        <FlatSearchAgentChat />
      </main>
    </div>
  );
}
