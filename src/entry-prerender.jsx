/**
 * Build time only (scripts/prerender.mjs): the landing pages a first-time
 * visitor opens, rendered to HTML once, so the browser can paint them before
 * any JavaScript has arrived. The app then starts as usual and draws the same
 * page over them.
 *
 *   home      www.moveazy.co.in/        (pages/ForkHome.jsx, signed out)
 *   partners  partners.moveazy.co.in/   (pages/partners/PartnerLanding.jsx)
 *   the info pages and sign-in, as a signed-out visitor first sees
 *   them (ROUTES); the app's RouteHandOff swaps them out once drawn.
 *
 * Rendered through the real providers, signed out, with the defaults the
 * page shows before its data loads.
 */
import { prerenderToNodeStream } from "react-dom/static";
import { StaticRouter } from "react-router";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { LoginModalProvider } from "./context/LoginModalContext";
import { VisitCartProvider } from "./context/VisitCartContext";
import ForkHome from "./pages/ForkHome";
import PartnerLanding from "./pages/partners/PartnerLanding";
import OwnerLanding from "./pages/owners/OwnerLanding";
import SocietyWelcome from "./pages/society/Welcome";
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { DeliveryPolicy, RefundPolicy } from "./pages/Policies";
import SupabaseLogin from "./pages/SupabaseLogin";
import FindHub from "./pages/find/FindHub";
import StealDeals from "./pages/find/StealDeals";
import DealOfTheDay from "./pages/find/DealOfTheDay";
import { PartnerStyles } from "./pages/partners/partnerUi";
import { OwnerStyles } from "./pages/owners/ownerUi";
import { SocietyStyles } from "./pages/society/societyUi";

function Shell({ children, location = "/" }) {
  return (
    <StaticRouter location={location}>
      <ErrorBoundary>
        <AuthProvider>
          <LoginModalProvider>
            <VisitCartProvider>{children}</VisitCartProvider>
          </LoginModalProvider>
        </AuthProvider>
      </ErrorBoundary>
    </StaticRouter>
  );
}

const PAGES = {
  home: () => <ForkHome />,
  partners: () => (
    <div className="pz">
      <PartnerStyles />
      <PartnerLanding />
    </div>
  ),
  // owners.moveazy.co.in and society.moveazy.co.in, signed out: their landing / first splash,
  // inside their app's frame and styles (OwnerApp, SocietyApp) as the app draws them.
  owners: () => (
    <div className="oz">
      <OwnerStyles />
      <OwnerLanding />
    </div>
  ),
  society: () => (
    <div className="sx">
      <SocietyStyles />
      <SocietyWelcome />
    </div>
  ),
};

/** www pages drawn at their own path: path → the page. */
export const ROUTES = {
  "/how-it-works": () => <HowItWorks />,
  "/about": () => <About />,
  "/contact": () => <Contact />,
  "/terms": () => <Terms />,
  "/privacy": () => <Privacy />,
  "/refund-policy": () => <RefundPolicy />,
  "/delivery-policy": () => <DeliveryPolicy />,
  "/auth": () => <SupabaseLogin />,
  // Find my home (pages/find): signed out, its header band — the cards wait for the phone gate.
  "/find": () => <FindHub />,
  "/find/steal-deals": () => <StealDeals />,
  "/find/deal-of-the-day": () => <DealOfTheDay />,
  // A signed-out visitor's /matches (TopMatches, no preferences); signed-in ones get the plain page.
  "/matches": () => (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px 60px" }}>
        <div style={{ textAlign: "center", padding: "80px 16px" }}>
          <p style={{ color: "#5c554e", marginBottom: 16 }}>We don't have your preferences yet.</p>
          <button type="button" style={{ padding: "12px 24px", borderRadius: 999, border: "none", background: "#04211D", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Tell us what you're looking for
          </button>
        </div>
      </div>
    </div>
  ),
};

/** Pages that hand over themselves, once their own first read has settled (not when their code arrives). */
export const SELF_HANDOFF = new Set(["/matches"]);

/** The page's HTML, every lazy part resolved. `page` is a PAGES name or a ROUTES path. */
export async function render(page) {
  const el = ROUTES[page] ? ROUTES[page]() : PAGES[page]();
  const { prelude } = await prerenderToNodeStream(<Shell location={ROUTES[page] ? page : "/"}>{el}</Shell>);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}
