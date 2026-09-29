/**
 * Design preview of the signed-in tenant home and the profile flow, at
 * /preview/tenant — no sign-in needed, so every state can be reviewed:
 * a new tenant, a half-done profile, Excellent (single) and Outstanding
 * (family). Find my flat / List my flat only say where they'd go here; in the
 * app they keep their existing flows.
 */
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, Heart, Home, Search } from "lucide-react";
import TenantHome from "./TenantHome";
import TenantProfileFlow from "./TenantProfileFlow";
import logoOnDark from "../../assets/logo/moveazy-logo-mint-dark.png";

const SIGNUP = { name: "Riya Sharma", phone: "9876543210" };
const FULL = {
  ...SIGNUP, linkedin: "https://www.linkedin.com/in/riya-sharma", currentCompany: "Swiggy", pastCompany: "Infosys",
  college: "BITS Pilani", graduationYear: "2021", inBangaloreSince: "2023",
};
const STATES = {
  new: { label: "New", profile: SIGNUP },
  partial: { label: "Partly done", profile: { ...SIGNUP, linkedin: FULL.linkedin, currentCompany: "Swiggy", inBangaloreSince: "2023" } },
  excellent: { label: "Excellent · single", profile: { ...FULL, maritalStatus: "single" } },
  outstanding: { label: "Outstanding · family", profile: { ...FULL, maritalStatus: "married" } },
};

export default function TenantPreview() {
  const [state, setState] = useState("new");
  const [profile, setProfile] = useState(STATES.new.profile);
  const [flow, setFlow] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
  const pick = (k) => { setState(k); setProfile(STATES[k].profile); setFlow(false); window.scrollTo(0, 0); };

  return (
    <div style={{ background: "#F4F2ED", minHeight: "100vh" }}>
      <style>{CSS}</style>
      <div className="pv-switch">
        <span>Design preview</span>
        {Object.entries(STATES).map(([k, s]) => <button key={k} type="button" className={state === k ? "on" : ""} onClick={() => pick(k)}>{s.label}</button>)}
      </div>

      {flow ? (
        <TenantProfileFlow
          initial={profile}
          onSave={setProfile}
          onClose={() => { setFlow(false); window.scrollTo(0, 0); }}
          onFind={() => setToast("→ opens the existing Find my flat flow")}
          onLinkedIn={() => setToast("Sign in with LinkedIn: fills name + photo")}
        />
      ) : (
        <>
          <header className="pv-bar">
            <img src={logoOnDark} alt="MovEazy" height="24" style={{ height: 24, width: "auto" }} />
            <span className="pv-bar-r"><Bell size={20} /><span className="pv-av">{profile.name?.[0] || "R"}</span></span>
          </header>
          <TenantHome
            name={profile.name}
            profile={profile}
            onFind={() => setToast("→ opens the existing Find my flat flow")}
            onList={() => setToast("→ opens the existing List my flat flow")}
            onProfile={() => { setFlow(true); window.scrollTo(0, 0); }}
          />
          <nav className="pv-tabs" aria-label="App tabs (as today)">
            {[[Home, "Home", true], [Search, "Find My Flat"], [Heart, "Shortlists"], [CalendarCheck, "Visits"]].map(([I, t, on]) => (
              <span key={t} className={on ? "on" : ""}><I size={20} />{t}</span>
            ))}
          </nav>
        </>
      )}
      {toast && <div className="pv-toast">{toast}</div>}
    </div>
  );
}

const CSS = `
.pv-switch { position: fixed; z-index: 90; top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; align-items: center; padding: 5px; border-radius: 99px;
  background: rgba(255,255,255,.92); box-shadow: 0 8px 24px rgba(0,0,0,.18); font-family: Manrope, Inter, sans-serif; max-width: calc(100vw - 16px); overflow-x: auto; }
.pv-switch span { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #8A6419; padding: 0 8px; white-space: nowrap; }
.pv-switch button { font: inherit; font-size: 12px; font-weight: 700; border: 0; border-radius: 99px; padding: 7px 10px; background: transparent; color: #04211D; cursor: pointer; white-space: nowrap; }
.pv-switch button.on { background: #04211D; color: #5EEAD4; }
.pv-bar { position: fixed; z-index: 80; top: 0; left: 0; right: 0; height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 44px 18px 0; height: 104px;
  background: linear-gradient(#04211D 60%, rgba(4,33,29,.96)); }
.pv-bar img { height: 24px; width: auto; }
.pv-bar-r { display: flex; align-items: center; gap: 14px; color: #CFE1DC; }
.pv-av { width: 34px; height: 34px; border-radius: 99px; background: #5EEAD4; color: #04211D; display: grid; place-items: center; font-weight: 800; font-family: Manrope, sans-serif; }
.pv-tabs { position: fixed; z-index: 80; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-around; padding: 10px 6px calc(12px + env(safe-area-inset-bottom));
  background: #04211D; border-top: 1px solid rgba(255,255,255,.08); font-family: Manrope, sans-serif; }
.pv-tabs span { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #7FA69E; }
.pv-tabs span.on { color: #5EEAD4; }
.pv-toast { position: fixed; z-index: 95; left: 50%; bottom: 90px; transform: translateX(-50%); background: #04211D; color: #fff; font: 700 13px Manrope, sans-serif;
  padding: 10px 16px; border-radius: 99px; box-shadow: 0 10px 24px rgba(0,0,0,.25); white-space: nowrap; }
.pv-bar ~ .tn .tn-head { padding-top: 124px; }
.pv-switch ~ .tn-flow .tn-flow-in, .pv-switch ~ .tn-flow .tn-done { padding-top: 64px; }
@media (min-width: 900px) { .pv-tabs { display: none; } }
`;
