import { captureException } from "./lib/sentry.js";
import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/home-marketing.css";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";

/** Old links used HashRouter (#/checkout). Convert once so BrowserRouter sees the path. */
(function migrateLegacyHashRoutes() {
  try {
    const { hash } = window.location;
    if (hash.startsWith("#/")) {
      window.history.replaceState(null, "", hash.slice(1));
    }
  } catch {
    /* ignore */
  }
})();

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(error, errorInfo) {
    captureException(error, { contexts: { react: { componentStack: errorInfo?.componentStack } } });
  }

  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: "1.25rem", fontFamily: "system-ui,sans-serif", color: "#0f172a", maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.15rem", fontWeight: 800 }}>This page couldn’t load</h1>
          <p style={{ marginTop: 10, color: "#475569", lineHeight: 1.5 }}>
            Try a refresh or open the site in an updated browser (Chrome or Safari). If you use a private tab, allow storage for this site.
          </p>
          {import.meta.env.DEV ? (
            <pre
              style={{
                marginTop: 14,
                fontSize: 11,
                overflow: "auto",
                background: "#f1f5f9",
                padding: 12,
                borderRadius: 8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {String(this.state.err?.message || this.state.err)}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
