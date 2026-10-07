import { createContext, lazy, Suspense, useContext, useState, useCallback } from "react";

// Fetched the first time somebody is asked to sign in, not on every page load.
const LoginPopupLayer = lazy(() => import("../components/LoginPopup"));

const Ctx = createContext(null);
export function useLoginModal() { return useContext(Ctx); }

export function LoginModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  // Mounted from the first open on, so the closing animation still plays.
  const [opened, setOpened] = useState(false);
  const [copy, setCopy] = useState({});

  /**
   * Callers still pass a "do this once they're in" callback, and it is still
   * accepted so none of them need changing — but it cannot fire any more.
   * Google sign-in redirects the browser to the account picker, which tears
   * this page down; by the time the user returns, the closure is gone. That
   * was already true of the Google path before it became the only one.
   * Anything that must happen after sign-in belongs in AuthContext's session
   * handler, which runs on return.
   */
  /**
   * Also accepts `{ title, subtitle }` now, so the gate that follows the
   * preference questionnaire can say what is waiting on the other side of it
   * rather than the generic "Login to your Account". Existing callers pass a
   * function, which is ignored exactly as before.
   */
  const openLogin = useCallback((arg) => {
    setCopy(arg && typeof arg === "object" ? arg : {});
    setOpen(true);
    setOpened(true);
  }, []);

  // Callers that own the back button need to be able to take this down
   // themselves — a page intercepting back to keep somebody on the site cannot
   // leave a sign-in sheet sitting on top of whatever it shows them instead.
  const closeLogin = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openLogin, closeLogin }}>
      {children}
      {opened && (
        <Suspense fallback={null}>
          <LoginPopupLayer open={open} onClose={() => setOpen(false)} title={copy.title} subtitle={copy.subtitle} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
