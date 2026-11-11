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
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { DeliveryPolicy, RefundPolicy } from "./pages/Policies";
import SupabaseLogin from "./pages/SupabaseLogin";
import { PartnerStyles } from "./pages/partners/partnerUi";

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
};

/** The page's HTML, every lazy part resolved. `page` is a PAGES name or a ROUTES path. */
export async function render(page) {
  const el = ROUTES[page] ? ROUTES[page]() : PAGES[page]();
  const { prelude } = await prerenderToNodeStream(<Shell location={ROUTES[page] ? page : "/"}>{el}</Shell>);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}
