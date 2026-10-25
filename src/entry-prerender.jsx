/**
 * Build time only (scripts/prerender.mjs): the landing pages a first-time
 * visitor opens, rendered to HTML once, so the browser can paint them before
 * any JavaScript has arrived. The app then starts as usual and draws the same
 * page over them.
 *
 *   home      www.moveazy.co.in/        (pages/ForkHome.jsx, signed out)
 *   partners  partners.moveazy.co.in/   (pages/partners/PartnerLanding.jsx)
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
import { PartnerStyles } from "./pages/partners/partnerUi";

function Shell({ children }) {
  return (
    <StaticRouter location="/">
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

/** The page's HTML, every lazy part resolved. */
export async function render(page) {
  const { prelude } = await prerenderToNodeStream(<Shell>{PAGES[page]()}</Shell>);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}
