# Enabling Google Sign-In (Supabase OAuth)

The login modal's **Continue with Google** button calls `loginWithGoogle()`
(`src/context/AuthContext.jsx`), which uses Supabase OAuth. On return from Google,
`handleSession` auto-creates the user's profile. None of this works until the
Supabase backend below is configured. Steps 1–3 are done in web dashboards (your
accounts, your secrets). Step 4 I can do for you once you have the two values.

---

## 1. Create a Supabase project
1. Go to https://supabase.com → sign in → **New Project**.
2. Choose a name, a strong database password, and a region. Wait ~2 min for it to provision.
3. Open **Project Settings → API** and copy:
   - **Project URL** — e.g. `https://abcdefgh.supabase.co`
   - **anon / public** key (or the newer **publishable** key)
   Note the **Project Ref** (the `abcdefgh` part) — you need it in step 2.

## 2. Create Google OAuth credentials (Google Cloud Console)
1. Go to https://console.cloud.google.com → create or pick a project.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill app name +
   support email, and add your own Google address under **Test users** (so you can log
   in before the app is verified).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URI**:
     `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     (use the Project Ref from step 1)
4. Copy the generated **Client ID** and **Client Secret**.

## 3. Enable Google in Supabase
1. Supabase Dashboard → **Authentication → Providers → Google** → toggle **Enable**.
2. Paste the **Client ID** and **Client Secret** from step 2. Save.
3. Supabase Dashboard → **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (for local dev)
   - **Redirect URLs** (allowlist): add `http://localhost:5173/**`
     (and your production URL later, e.g. `https://yourdomain.com/**`)

## 4. Add the env vars  ← I can do this step for you
Create `MovEazy-FE/.env.local`:

```
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon or publishable key>
```

Then restart the dev server. (The anon/publishable key is designed to be public and
ships in the browser bundle, so it is safe to paste here. Never put the Google Client
Secret or a Supabase *service_role* key in this file — those belong only in the
Supabase dashboard / backend.)

## 5. Create the profile tables
So the profile row can be written on first login, run the schema SQL in the Supabase
**SQL Editor** (files now live in `MovEazy-BE/supabase/`):
- `customer_schema.sql` — `user_profiles` (required for profiles)
- `broker_schema.sql`, `admin_schema.sql`, `chatbot_schema.sql` — as needed

---

## Result
Once 1–5 are done, clicking **Continue with Google**:
1. Redirects to the Google account picker.
2. You pick your Google account and consent.
3. Supabase creates the auth user and returns to the app.
4. `handleSession` writes your profile (name/email from Google, role `customer`).
5. You're signed in.

## Note on email/password signup
Separately, email/password sign-up needs email confirmation, which requires SMTP. For
local testing you can turn it off: **Authentication → Providers → Email → uncheck
"Confirm email"**. This does not affect Google sign-in (OAuth accounts are pre-verified).
