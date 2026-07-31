# Deploying MovEazy-FE

The frontend is a Vite + React SPA hosted on **Vercel**, served at
**https://www.moveazy.co.in**.

- **Host:** Vercel (`server: Vercel` on responses).
- **Canonical host:** Vercel redirects the apex → `www` (`moveazy.co.in` → `www.moveazy.co.in`, HTTP 308).
  Because of that, the app does **not** do any client-side hostname redirect in `index.html`
  (an app-level www→apex redirect would fight Vercel's apex→www and cause an infinite loop).
- **Production branch:** `main`. Merging/pushing to `main` should trigger a production deploy
  **if** the Vercel project is connected to `github.com/MovEazy1/MovEazy-FE` with Production
  Branch = `main` (verify in Vercel → Settings → Git).

---

## 1. Environment variables (set in Vercel)

Vite inlines `VITE_*` vars at **build time**, so they must exist in Vercel **before** a build,
and changing them requires a **redeploy** to take effect.

Vercel → Project → **Settings → Environment Variables** (Production + Preview):

| Variable | Where to get the value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API (Project URL) | Public |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API (anon / publishable key) | Public by design — ships in the browser bundle |
| `VITE_ADMIN_EMAILS` | Your admin allowlist (comma-separated) | Copy from local `.env.local` |

> The same values are in local `MovEazy-FE/.env.local` (git-ignored). Never put a Supabase
> **service_role** key or the Google **Client Secret** here — those live only in the Supabase
> dashboard.

**Symptom if missing:** the login modal shows *"Google sign-in requires Supabase configuration."*
(and email/password auth is disabled), because `isSupabaseConfigured` is false at build time.

---

## 2. Supabase auth configuration (for the production domain)

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://www.moveazy.co.in`
- **Redirect URLs** (allowlist): add
  - `https://www.moveazy.co.in/**`
  - `https://moveazy.co.in/**`
  - keep `http://localhost:5173/**` for local dev

**Google sign-in** (see `GOOGLE_AUTH_SETUP.md` for the full walkthrough):
- Authentication → Providers → **Google** must be **enabled** with a Client ID / Secret.
- Google Cloud Console authorized redirect URI stays the Supabase callback:
  `https://<PROJECT_REF>.supabase.co/auth/v1/callback` (does not change per app domain).

---

## 3. Deploy

**Preferred — Git (auto):** merge to `main`; Vercel builds and deploys.

**Manual — Vercel CLI** (from `MovEazy-FE/`):

```bash
npm i -g vercel
vercel login          # interactive
vercel link           # pick the existing MovEazy project
vercel --prod         # build + deploy to production
```

**Dashboard:** Vercel → Deployments → ⋯ → **Redeploy** (use this after changing env vars).

---

## 4. Verify a deploy went live

The built main JS asset is content-hashed, so a new deploy changes the filename:

```bash
curl -s https://www.moveazy.co.in/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'
```

Cross-check the hash against a local build (`npm run build` → `dist/assets/index-*.js`).
Then load the site and confirm the brand logo, the "Find Your Next Occupant / To someone
who'll treat it like home" hero, and — if env vars + Supabase are set — that **Continue with
Google** opens the Google account picker instead of the config error.

---

## Local development

```bash
npm install
npm run dev           # http://localhost:5173 (honors a host-assigned PORT if set)
npm run build         # production build
npm run lint
```
