# MovEazy — Project Brain (read this first)

MovEazy is a two-sided house-renting marketplace for Bengaluru: renters find flats and
book visits; owners/brokers list flats and post open visit slots. Founder (Yatharth) is
non-technical — keep changes safe, tested, and reversible.

This file is auto-read by Claude Code at the start of every session. Keep it current.
It is the source of truth so no conversation has to re-learn the project.

## Repos
- `MovEazy-FE/` — the website. React 18 + Vite + Tailwind, React Router. THIS is what users see.
- `MovEazy-BE/` — backend "agent" + Supabase SQL schemas. Deploys to Render.

## Architecture — the database question is SETTLED
- **Supabase = the database.** Auth (email/password + Google OAuth) AND all app data:
  profiles, listings/inventory, visits, recommendations, admin. Source of truth.
  Client: `src/lib/supabase.js`. Auth: `src/context/AuthContext.jsx`.
- **Firebase = NOT a second database.** It does only two jobs:
  1. **Storage** — listing images (`src/lib/firebase.js` = storage only; `propertyImageUpload.js`, `SmartImage.jsx`).
  2. **Hosting** — the site is deployed on Firebase Hosting.
- **Firestore = retired/dead code.** Old database logic, already neutered (returns safe
  empty defaults). `src/lib/firestoreStore.js` is now a Supabase-backed shim — KEEP it
  (live pages import it). Do not "fix" Firestore; the migration to Supabase is done.

Per founder decision (Aug 2026): legacy code is LEFT AS-IS for now, not deleted. Do not
remove the dead pages below unless explicitly asked.

## Live routes (the real app — src/App.jsx)
`/` ForkHome · `/map` MapPage · `/how-it-works` · `/about` · `/list-my-flat` (auth) ·
`/admin` AdminDatabase · `/recommendations` · `/visits` (auth) · `/auth` SupabaseLogin ·
`/profile` (auth) · `/broker` BrokerDashboard (auth)

## Dead / unrouted legacy pages (imported by nothing — ignore unless quarantining)
HomeV2, MyActivity, AdminDashboard, CrmDashboard, SellerDashboard, ListingDashboard,
MoveazyPlanPage, Onboarding, Contact, Guarantee

## Deploy — hosted on VERCEL (verified 2026-08-02), NOT Firebase
- Live host = **Vercel** (response header `server: Vercel`, region bom1). Domain
  `moveazy.co.in` → 308 → `www.moveazy.co.in`.
- **Deploy = push/merge to `main`** on GitHub `MovEazy1/MovEazy-FE` → Vercel auto-builds & deploys.
  Env vars (`VITE_*`) are set in Vercel → Settings → Environment Variables (inlined at build time).
- ⚠️ **Do NOT run** `npm run deploy:hosting*` — those are legacy Firebase Hosting scripts
  pointing at projects (`moveasy-30eed`, `moveazy-34225`) that do NOT serve production.
- No `.firebaserc` / `firebase.json` in repo — Firebase Hosting is not wired here.
  Firebase Storage in the prod build runs on demo config (effectively unused). See `DEPLOY.md`.

## Env (`.env.local`, not committed)
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ADMIN_EMAILS`.
Firebase keys (`VITE_FIREBASE_*`) come from build-mode env; without them Storage runs in demo mode.

## Verified state (2026-08-02)
- **Production == local `main`.** Live bundle `index-B-xlLgbk.js` / `index-tNBGTuGf.css`
  matches local `dist` exactly. Live site = commit `80bd68b`. No drift, nothing un-deployed.
- Flows render cleanly, no console errors. BUT inventory is empty everywhere (map 0,
  recommendations 0, visits empty) — no listing data in the system yet. Confirm intended.

## Workflow rules
1. Test on localhost before deploying. `npm run dev` (localhost), `npm run build`,
   `npm test` (vitest), `npm run e2e` (playwright).
2. One task per session; keep changes small and reviewable.
3. Never touch production data from a dev/test context.
4. Update this file + `docs/STATUS.md` when the state changes.
