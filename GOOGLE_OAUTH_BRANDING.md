# Google sign-in screen: showing "MovEazy" + logo (instead of the supabase.co domain)

## TL;DR of the current state
- **App name is already "MovEazy"** in Google Cloud → Google Auth Platform → Branding.
  Editing it does nothing new.
- The sign-in screen shows `yspladsmazxklcfehimi.supabase.co` because the OAuth app is
  **unverified / "Testing"**, and Google routes the callback through Supabase's shared
  domain. For unverified apps, Google shows the **callback domain**, not your app name/logo.
- To show **"MovEazy" + your logo**, the app must be **verified by Google**. Verification
  requires an **Authorized Domain you own and can prove** — but the current callback host is
  `supabase.co` (Supabase's), which you can't verify.
- **Fix:** move Supabase auth onto *your* domain (e.g. `auth.moveazy.co.in`), then verify
  `moveazy.co.in` with Google and submit for brand verification.

## Project facts (for reference)
- Supabase project ref: `yspladsmazxklcfehimi`
- Google Cloud project: `moveazy-503018`
- OAuth client ID: `354403173888-goqgjhv8246pl3bat2e71te014815he1.apps.googleusercontent.com`
- Scopes used: `email`, `profile`, `openid` (all **non-sensitive**)
- Production domain: `https://www.moveazy.co.in`

---

## Step 1 — Set up a Supabase custom auth domain  (**you** — paid, ~30–60 min + DNS wait)
Supabase custom domains are a paid add-on on the **Pro** plan (about $10/mo on top of Pro).

1. Supabase Dashboard → your project → **Settings → General → Custom Domains** (or **Add-ons**).
2. Enable the add-on and enter your chosen auth host, e.g. **`auth.moveazy.co.in`**.
3. Supabase gives you DNS records (a CNAME + a TXT for verification).
4. Add those records at your domain registrar / DNS host for `moveazy.co.in`.
5. Back in Supabase, click **Verify / Activate**. Wait for it to go active (can take up to a
   few hours for DNS + SSL).

After this, your auth endpoints live at `https://auth.moveazy.co.in/...` and the OAuth callback
becomes `https://auth.moveazy.co.in/auth/v1/callback`.

## Step 2 — Update the Google OAuth client redirect URI  (**me or you** — 2 min)
Google Cloud → **APIs & Services → Credentials → the OAuth client above → Authorized redirect URIs**:
- **Add:** `https://auth.moveazy.co.in/auth/v1/callback`
- Keep the old `https://yspladsmazxklcfehimi.supabase.co/auth/v1/callback` until the custom
  domain is confirmed working, then remove it.

## Step 3 — Verify domain ownership in Google Search Console  (**you** — 10 min + DNS)
1. Go to https://search.google.com/search-console → add property **`moveazy.co.in`**.
2. Verify via the DNS TXT record it provides (add at your registrar).
   This is what lets Google accept `moveazy.co.in` as an **Authorized Domain**.

## Step 4 — Fill in branding + authorized domain  (**me or you** — 5 min)
Google Cloud → **Google Auth Platform → Branding**:
- **App name:** `MovEazy` (already set)
- **App logo:** upload `moveazy-google-oauth-logo.png` (square, 512×512, prepared for you)
- **Application home page:** `https://www.moveazy.co.in`
- **Privacy policy link:** `https://www.moveazy.co.in/privacy`  *(this page must actually exist —
  create one if it doesn't; verification will fail without a reachable privacy policy)*
- **Authorized domains:** add `moveazy.co.in`

## Step 5 — Publish + submit for verification  (**you** — clicks, then Google review)
Google Cloud → **Google Auth Platform → Audience**:
- Click **Publish app** (Testing → In production).
- Because you're adding a **logo**, Google requires **brand verification**. Since your scopes
  are non-sensitive, this is the lighter "brand" review (no security assessment), but it is
  still a manual Google review — typically **a few days to a couple of weeks**.
- Watch **Verification Center** for status / any requested changes.

## Result
Once verified, the Google account chooser + consent screen show **"to continue to MovEazy"**
with your logo, instead of the `supabase.co` domain.

---

## Notes / alternatives
- **Without** the custom domain you cannot pass verification (you can't prove ownership of
  `supabase.co`), so the name/logo cannot be shown — there is no free shortcut.
- Publishing to production *without* the custom domain removes the 100-test-user cap and lets
  any Google user sign in, but does **not** change the `supabase.co` wording on the screen.
- The logo file `moveazy-google-oauth-logo.png` was generated from `public/logo-moveazy.png`
  (tightened to reduce padding). Google wants square PNG/JPG/BMP ≤ 1 MB; this is 512×512, ~26 KB.
