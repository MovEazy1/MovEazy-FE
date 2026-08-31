# MovEazy — Status & Verification Log

_Last updated: 2026-08-02_

## 1. Database cleanup question — RESOLVED (no code change made)
The concern was "two databases — pick one, abandon the other." Investigation showed there
are **not** two competing databases:

| Thing | Role | Verdict |
|---|---|---|
| **Supabase** | Auth + all app data (profiles, listings, visits, recommendations, admin) | ✅ Keep — this IS the database |
| **Firebase Storage** | Listing images only | ✅ Keep — still needed |
| **Firebase Hosting** | Serves the website | ✅ Keep — still needed |
| **Firestore code** | Old database logic, already neutered (returns empty defaults) | 🗑️ Dead, but LEFT AS-IS per founder decision |

Dead/unrouted legacy pages (safe to quarantine later if desired, imported by nothing):
HomeV2, MyActivity, AdminDashboard, CrmDashboard, SellerDashboard, ListingDashboard,
MoveazyPlanPage, Onboarding, Contact, Guarantee.

## 2. Localhost vs Production parity — VERIFIED MATCHING
Method: compared Vite's content-hashed bundle filenames (unique per build).

- Live (moveazy.co.in) main bundle: `index-B-xlLgbk.js`, CSS `index-tNBGTuGf.css` + `inventoryMatch-DtQ6Dmri.css`
- Local `dist/index.html`: identical hashes.
- **Conclusion: production is exactly your latest local build (commit `80bd68b`). No drift.**

## 3. Live flow check (read-only walk, logged in as YS)
| Route | Result |
|---|---|
| `/` Home | ✅ Renders (fork: Find Your Next Home / Next Occupant) |
| `/map` | ✅ Renders; map + filters work — but "0 places … 0 of 0 results" |
| `/recommendations` | ✅ Renders; "No strong matches yet" (0 homes) |
| `/visits` | ✅ Renders; "No homes added yet" |
| Console | ✅ No errors, no failed requests |

**Key finding:** the app is healthy, but there is **no inventory data** anywhere. This is a
data question, not a code bug. Decide before launch: is empty expected, or should listings
be seeded?

## 4. Localhost verification checklist — run in Claude Code on your machine
Cowork verified live==local by fingerprint. To confirm the running app behaves identically:

```bash
cd MovEazy-FE
npm run dev            # open the localhost URL it prints
```
Then click through and confirm each matches production:
- [ ] Home fork loads; both CTAs work
- [ ] /map loads tiles + filters (note if inventory is empty here too)
- [ ] /auth login works (email + Google)
- [ ] /list-my-flat wizard opens when logged in
- [ ] /visits and /recommendations render their empty states
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` (unit) and `npm run e2e` (Playwright) pass

## 5. Hosting — RESOLVED: Vercel, not Firebase (verified 2026-08-02)
Live response header `server: Vercel` (x-vercel-id bom1). moveazy.co.in → 308 → www.
- **Deploy = push/merge to `main` on GitHub `MovEazy1/MovEazy-FE`** → Vercel auto-builds/deploys.
- ⚠️ The `npm run deploy:hosting*` scripts (Firebase projects moveasy-30eed / moveazy-34225)
  are LEGACY and do NOT serve production. Do not use them.
- Firebase Storage in prod build = demo config (effectively unused).

## 6. Overnight session log (2026-08-02, branch `overnight/v1-launch-flows`)
All changes are on branch `overnight/v1-launch-flows` — NOT deployed. Each verified with
`npx eslint` (exit 0). Needs a localhost run + click-through before merge (flagged below).

> NOTE: changes are saved as working-tree edits on the branch but **not yet committed** (a
> stale `.git/index.lock` blocked the sandbox from committing). To commit on your machine:
> `cd MovEazy-FE && rm -f .git/index.lock && git add -A && git commit -m "v1 launch flows"`.
> Review first with `git diff`. Files touched: `src/pages/ForkHome.jsx`, `src/pages/ListMyFlat.jsx`,
> plus new `CLAUDE.md`, `docs/PRD.md`, `docs/STATUS.md`.

**Done & lint-clean:**
1. **Renter discovery** — confirmed working (13 listings show on `/map`). No change needed.
2. **Mobile fork hero** (`src/pages/ForkHome.jsx`) — the split hero stacked "Show me flats"
   (top) and "List my Flat" (bottom) awkwardly on mobile. Added a dedicated mobile hero:
   a banner + two side-by-side cards ("Find a flat" / "List a flat") shown together. Desktop
   hero hidden ≤900px, new hero hidden on desktop → desktop unchanged. Visually previewed
   at 390px — looks clean.
3. **Broker plan card** (`ListMyFlat.jsx` `BrokerPlanCard`) — replaced old ₹1,999/100-leads
   with **₹4,999/mo Guaranteed Visits**: 20 visits/mo when 5+ listings, full refund if missed,
   0% commission on-plan, plus the mark-Sold rule note.
4. **Broker 70/30 commission** — new card on the broker post-flat screen (70% broker / 30%
   MovEazy; points to the 0%-commission plan).
5. **Owner post-flat** — added an **owner dashboard** card (listing views [live `view_count`],
   matched leads [live], profile clicks [stub 0]) and an **upsell services** card (painting,
   cleaning, photography, packers — "Get quote", stub).
6. **Tenant reward copy** — wallet notes now say the reward is held in-wallet and **paid to your
   bank account once the property closes**. (Tenant "find my next flat" redirect already existed.)

**Verify on localhost before merge:**
- [ ] `npm run dev` → open `/` on a narrow window: new mobile fork hero renders, both cards tap through.
- [ ] Post a flat as owner / tenant / broker → confirm the new cards render and no console errors.
- [ ] `npm run build` succeeds.

**Flagged — needs a supervised pass (NOT done overnight):**
- Broker "mark Sold → remove from public map": `BrokerDashboard.jsx` (CRM) uses a separate
  `properties` table from the public `inventory` table. Wiring mark-sold to flip `inventory.status`
  off `published` must be built + tested carefully. Not safe unattended.
- All money is UI-only: ₹10,000 reward payout, ₹4,999 charge + refund guarantee, upsell bookings.
  No Razorpay/UPI wiring, no bank payout, no refund automation.
- Reward currently shows only for compact types (1 RK / 1 BHK / room) via `WALLET_REWARD_TYPES`.
  Confirm whether owner/tenant reward should apply to all flat types.

## 7b. Open visits + mark-sold (added on request, any poster)
Available to **owner, tenant, and broker** on the post-flat screen (`ListMyFlat`).

**Built & lint-clean (0 errors):**
- `lib/inventory.js` — `setInventoryStatus()` + `markInventorySold()` (sets `status='sold'`,
  which removes the listing from the public map/search). Reversible to `'published'`.
- `lib/visits.js` — `fetchOpenVisitsFor()/fetchOpenVisitsForProperty()` (next-5-days window).
- `components/PropertyVisitSlots.jsx` — poster tool: add MULTIPLE open visit windows
  (date-time + max visitors), remove them, and "Mark as sold" (with confirm). Shown on the
  post-flat screen for every role.
- `components/OpenVisitsList.jsx` — renter view: a property's open visits for the next 5 days,
  shown in `PropertyModal` (auto-hides if the listing has none).

**⚠️ REQUIRED DB STEP (you must run this — I did not touch your live DB):**
- Run `MovEazy-BE/supabase/poster_visit_slots.sql` in the Supabase SQL editor. Until then,
  `property_visit_slots` is admin-write-only, so a non-admin poster's "Add open visit" will
  fail with a friendly "policy not applied yet" message. Mark-sold needs no DB change.

**Verify on localhost after running the SQL:**
- [ ] Post a flat (as owner/tenant/broker) → add 2–3 open visits → they list; remove one.
- [ ] Open that property as a renter (`/map` → card) → "Open visits — next 5 days" shows them.
- [ ] "Mark as sold" → confirm → listing disappears from the map.

## 8. Owner/poster dashboard — added the missing "shortlisted" metric (added on request)
Started this as a brand-new dashboard before realizing `/my-properties` ("My Properties",
commit `7da26c5`) already IS the self-service per-poster dashboard — reachable from the
nav once a user has a listing, shows views/visit-slots/photos/verified per property. It
was just missing a shortlist count, which is what was actually asked for. Corrected to
extend the real page instead of shipping a second, competing one (an earlier pass added a
duplicate "My Listings" tab to `/profile` — that has been removed).

**Built & lint-clean:**
- `lib/ownerDashboard.js` — `fetchMyListingStats()`, calls the new `my_listing_stats()` RPC.
- `pages/MyProperties.jsx` — merges each property's `shortlist_count` from that RPC onto
  its `fetchMyInventory()` row; added a **"Shortlisted"** stat to both the page-level
  totals strip and each property card's stat grid (now `grid-cols-3 sm:grid-cols-5`, up
  from 4, with `break-words` on stat labels — needed once "Shortlisted" didn't fit a
  narrow mobile column without wrapping).
- `pages/ListMyFlat.jsx` — post-publish screen now links to `/my-properties` (previously
  had no such link at all) so a poster can find this immediately after listing a flat.

**Why a new SQL function instead of querying tables directly:** `saved_properties` (the
shortlist/heart-button table) is RLS-locked to "the customer's own row, or admin" — a
poster has no row of their own there, so a direct client query would silently return 0
every time. `my_listing_stats()` runs `security definer`, aggregates COUNTS ONLY (never
which customer shortlisted) scoped to `poster_id = auth.uid()`, so posters get real
numbers without any RLS loosening on the underlying customer-activity tables. (Also
returns visit-request/booking/reaction counts for future use, unused by the UI today.)

**⚠️ REQUIRED DB STEP (you must run this — I did not touch your live DB):**
- Run `MovEazy-BE/supabase/owner_dashboard_stats.sql` in the Supabase SQL editor. Until
  then the RPC doesn't exist, so `/my-properties` still loads fine but "Shortlisted"
  always reads 0 (fails closed — `fetchMyListingStats()` catches the error).

**Verify on localhost after running the SQL:**
- [ ] Sign in as a user who has posted at least one flat → `/my-properties` shows it with
      a real "Shortlisted" count next to Views.
- [ ] From another account, heart/save that listing → the poster's "Shortlisted" count
      goes up on refresh.
- [ ] Post a flat → the new "View all my listings & shortlists →" button on the success
      screen lands on `/my-properties`.
- [ ] Resize to a phone width and confirm the 5 per-card stats wrap 3-then-2 with no
      clipped or single-letter-orphan labels (mobile-checked with mock data during dev;
      not yet re-checked against a real signed-in account).

## 7. Open items for founder
- [ ] Decide on inventory: keep the 13 seed listings or replace with real ones before launch.
- [ ] Confirm reward amount (defaulted ₹10,000) and whether it applies to all flat types.
- [ ] Review the branch, run the localhost checks above, then merge `main` to deploy (Vercel).
