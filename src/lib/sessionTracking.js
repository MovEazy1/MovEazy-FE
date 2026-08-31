/**
 * Session Tracking Service
 * Captures user session data: device type, duration, pages visited, etc.
 */

export const DEVICE_TYPES = {
  MOBILE: "mobile",
  TABLET: "tablet",
  DESKTOP: "desktop",
};

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/mobile|android|iphone|ipod/i.test(ua)) return DEVICE_TYPES.MOBILE;
  if (/ipad|tablet|playbook|silk/i.test(ua)) return DEVICE_TYPES.TABLET;
  return DEVICE_TYPES.DESKTOP;
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  return {
    type: detectDeviceType(),
    userAgent: ua,
    screen: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    os: ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : ua.includes("Linux") ? "Linux" : "Unknown",
  };
}

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class SessionTracker {
  constructor() {
    this.sessionId = generateSessionId();
    this.startTime = Date.now();
    this.deviceInfo = getDeviceInfo();
    this.pages = [];
    this.userId = null;
    this.userRole = null;
    this.currentPage = null;
    this.pageStartTime = null;

    this.initSession();
    this.trackPageChange();
  }

  initSession() {
    const sessionData = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      deviceInfo: this.deviceInfo,
      pages: [],
      userId: null,
      userRole: null,
    };
    sessionStorage.setItem("moveazy_session_tracking", JSON.stringify(sessionData));
  }

  setUser(userId, userRole) {
    this.userId = userId;
    this.userRole = userRole;
    this.updateSession();
  }

  trackPageChange(page) {
    // Record previous page duration
    if (this.currentPage && this.pageStartTime) {
      const duration = Date.now() - this.pageStartTime;
      const pageData = this.pages.find((p) => p.page === this.currentPage);
      if (pageData) {
        pageData.duration += duration;
        pageData.visits += 1;
      }
    }

    this.currentPage = page || window.location.pathname;
    this.pageStartTime = Date.now();

    // Add or update page record
    const existingPage = this.pages.find((p) => p.page === this.currentPage);
    if (existingPage) {
      existingPage.visits += 1;
      existingPage.lastVisit = new Date().toISOString();
    } else {
      this.pages.push({
        page: this.currentPage,
        visits: 1,
        duration: 0,
        firstVisit: new Date().toISOString(),
        lastVisit: new Date().toISOString(),
      });
    }

    this.updateSession();
  }

  updateSession() {
    const sessionData = {
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Math.round((Date.now() - this.startTime) / 1000), // in seconds
      deviceInfo: this.deviceInfo,
      pages: this.pages,
      userId: this.userId,
      userRole: this.userRole,
    };
    sessionStorage.setItem("moveazy_session_tracking", JSON.stringify(sessionData));
  }

  getSessionData() {
    const data = sessionStorage.getItem("moveazy_session_tracking");
    return data ? JSON.parse(data) : null;
  }

  // Save session to localStorage when user leaves (optional)
  saveSessionToHistory() {
    const sessionData = this.getSessionData();
    if (!sessionData) return;

    const history = JSON.parse(localStorage.getItem("moveazy_session_history") || "[]");
    history.push(sessionData);

    // Keep only last 100 sessions
    if (history.length > 100) history.shift();
    localStorage.setItem("moveazy_session_history", JSON.stringify(history));
  }

  getSessionHistory() {
    return JSON.parse(localStorage.getItem("moveazy_session_history") || "[]");
  }

  getAnalytics() {
    const history = this.getSessionHistory();
    if (history.length === 0) return null;

    const deviceCounts = { mobile: 0, tablet: 0, desktop: 0 };
    let totalDuration = 0;
    const pageViews = {};
    const roleBreakdown = { tenant: 0, owner: 0, broker: 0, null: 0 };

    history.forEach((session) => {
      deviceCounts[session.deviceInfo.type]++;
      totalDuration += session.duration || 0;

      session.pages.forEach((page) => {
        pageViews[page.page] = (pageViews[page.page] || 0) + page.visits;
      });

      const role = session.userRole || "null";
      if (roleBreakdown.hasOwnProperty(role)) roleBreakdown[role]++;
    });

    return {
      totalSessions: history.length,
      averageSessionDuration: Math.round(totalDuration / history.length),
      deviceBreakdown: deviceCounts,
      pageViews: Object.entries(pageViews)
        .map(([page, views]) => ({ page, views }))
        .sort((a, b) => b.views - a.views),
      roleBreakdown,
      lastSession: history[history.length - 1],
    };
  }
}

// Global instance
export const sessionTracker = new SessionTracker();

// Auto-save session on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    sessionTracker.updateSession();
    sessionTracker.saveSessionToHistory();
  });
}
