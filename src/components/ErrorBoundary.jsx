import { Component } from "react";
import { captureException } from "../lib/sentry.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureException(error, { contexts: { react: { componentStack: errorInfo?.componentStack } } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "linear-gradient(180deg, #fff4f2 0%, #f8fafc 100%)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#64748b", margin: "0 0 20px", textAlign: "center", maxWidth: 420 }}>
            Please refresh the page. If this keeps happening, contact support from the Contact page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 20px",
              fontWeight: 700,
              background: "#b91c1c",
              color: "white",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
