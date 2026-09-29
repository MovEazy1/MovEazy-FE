# MovEazy Partners — launch PRD (partners.moveazy.co.in)

Owner: Product (MovEazy). Status: draft for build, v0.1 — 29 Sep 2026.
Source: founder brief of 29 Sep 2026, checked against the code on `main` (FE `24aba7e`, BE `40b8d82`).

Legend for **Now**: ✅ built and matching · 🟡 partly there / differs · ❌ not built · 🐞 built but broken.

---

## 0. The funnel in one line

Visitor → **Become Partner** (mobile first, then Google) → **free account in demo mode** (everything visible on dummy data, every button explains itself) → **Join Premium** (3 plans, Razorpay) → **payment verified** → **Congratulations + ROI + Refer & Earn** → **Complete profile** (areas, RERA) → **Gold partner**.
Everything real (own listings, leads, AI curated lists, groups, sold-out, notifications) is premium-only.

Two internal tools: **/sales-funnel** (broker acquisition + payment approval) and **/sales-funnel/leads** (sign-ups by channel, incl. referrals). One CRM addition: **Broker leads** (tenants brought by brokers, never mixed into MovEazy leads).

---

## 1. Signed-out landing (partners.moveazy.co.in)

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| L1 | No pricing anywhere on the signed-out page | ❌ | Price appears in: hero price line, calculator "Premium −₹1,499" row, FAQ "What does Premium cost?", closing price bar, sticky bar "Premium ₹1,499/mo". Remove all; calculator shows income without the fee. |
| L2 | Every "Join free" CTA reads **Become Partner** | ❌ | Hero, "Match my clients", closing CTA, sticky bar, nav. |
| L3 | Become Partner → **mobile number first** (if not known), then Google | ❌ | Today: Google first, then the site-wide phone modal. New: a sheet asks name-less 10-digit mobile → "Verify & continue with Google" → Google → number saved to the partner record automatically (no second prompt). |
| L4 | Number recorded in the partners DB at sign-up | 🟡 | `partner_register` copies it from `user_profiles`. New: carry the pre-Google number through the redirect (session storage), save to `user_profiles.phone` and `broker_partners.phone`, and log funnel event `number_filled`. |

"Verify" = format check (Indian mobile). No SMS OTP exists in the stack today — see Q1.

## 2. After sign-up, before a plan: demo mode

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| D1 | Non-paying partner sees the app on **dummy data** | ❌ | Today a free partner sees real broker/group listings and can add real listings/leads. New: `me.plan_active=false` → app renders demo data sets. |
| D2 | Counts: MovEazy **1000**, Self **20**, Brokers **300**, **6 groups × 20** | ❌ | Show the numbers; render 5–6 sample cards per tab (real photos from published stock, no addresses/contacts). |
| D3 | Sticky **Join Premium** button, bottom centre, on every demo screen | ❌ | Above the bottom nav. |
| D4 | Every action opens a **premium explainer pop-up** (what it would do) | ❌ | e.g. WhatsApp on a listing → "Sends the lister a message asking availability and exact location." Pop-up has "Join Premium" CTA. |
| D5 | Self property: **Mark as closed** with a confirm message ("removed from your list for easier management") | ❌ | Also real for premium (see P-S). |
| D6 | Leads: dummy names | ❌ | 6 sample leads. |
| D7 | Each lead: **AI matching** button → curated list → WhatsApp share (demo shows the flow, share is explained not sent) | 🟡 | Matching exists (`LeadMatches`), no curated list / share. |

## 3. Premium features (real, plan required)

### 3.1 AI curated list for a broker's tenant (lead)

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| C1 | From a lead: **AI matching → curated list** (top matches, broker can deselect) | 🟡 | Scoring exists; no list object. New table `partner_curated_lists` (broker, lead, property ids, token). |
| C2 | **WhatsApp share** sends one link; tenant opens a **swipe flow** of the broker's picks | ❌ | New public page `moveazy.co.in/c/<token>` — separate from MovEazy's `/curated/:token` (CRM). Branded as the broker's list. |
| C3 | Tenant enters **contact details** (name, mobile) on the list | ❌ | See Q5 for when (before swiping vs on first like). |
| C4 | Broker sees **tenant action per property** (liked / skipped / viewed) | ❌ | Stored per list × property. |
| C5 | Broker is **notified** when the tenant likes a property → **Notifications** section | ❌ | New in-app notifications (bell + page). Also used by sold-out (G1) and storefront likes. |
| C6 | Broker-sourced tenants are **unverified tenants**, attributed to the broker, **never merged into MovEazy leads** | ❌ | New table `partner_tenants` (broker_id, name, phone, source list, status `unverified`). `crm_clients` gains `attributed_to` (`'moveazy'` default, else broker id) so CRM lists `attributed_to = 'moveazy'` only. |
| C7 | CRM section **Broker leads** at moveazy.co.in/crm, filterable by broker | ❌ | New CRM tab reading `partner_tenants` + storefront likes. |

### 3.2 Add property (fast, one question per screen)

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| P1 | Step flow: tap option → Next (no dropdown page) | ❌ | Today one long form with selects. |
| P2 | Q1 House type: 1RK, 1BHK, 2BHK, 3BHK, 4BHK, 5BHK, Room in pre-occupied flat — **1BHK preselected** | ❌ | Today defaults 2 BHK, no 1RK/5BHK/room option (check `BHK_OPTIONS`). |
| P3 | Q2 Price (numeric) | 🟡 | |
| P4 | Q3 Location: **default HSR**; paste Google Maps link **or** pick on map | 🟡 | Map picker exists; no link parsing; default empty. |
| P5 | Q4 Photos from gallery — **must actually save** | 🐞 | Reported broken. Suspects: `listings` bucket insert policy for non-staff, or the follow-up `inventory` update blocked by RLS. To verify on production. |
| P6 | After publish: **Add more details** any time — name of the listing + a paste box for the WhatsApp text | 🟡 | Edit exists partly. New: paste box → parsed into a systematic description (deposit, furnishing, availability, amenities…) — see Q8. |
| P7 | Don't ask unnecessary details (furnishing, property type, owner contacts move to "more details") | ❌ | |

### 3.3 Add tenant (lead)

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| T1 | Only **mobile** mandatory | 🟡 | Today name + mobile required. |
| T2 | New: **Bachelor / Family**, **Male / Female / Co-ed** | ❌ | New columns on `partner_leads`. |
| T3 | Location: **exact select from all localities in DB** | 🟡 | Today free text with suggestions from a static list. New: pick-only from DB localities. |

### 3.4 Groups: sold out

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| G1 | Any group member can **mark a listing sold out** | ❌ | |
| G2 | Notifies **MovEazy** + the **listing broker** | ❌ | Uses notifications (C5) + CRM. |
| G3 | Until the listing broker approves: **"Potentially rented"** marker everywhere | ❌ | New status on inventory; not deleted. |
| G4 | On approval → **Sold out**; never deleted from the DB | ❌ | Soft status only. |

### 3.5 Anything else in the brief
Item "8. at all places" was cut off — see Q12.

## 4. Plans and payment

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| M1 | **Join Premium** page: all 3 plans in one screen | ❌ | Today one price + WhatsApp "ask". |
| M2 | Plans: **1 month ₹1,500 (trial)** · **5 months ₹4,999** (refundable within 1 month) · **12 months ₹9,999** (refundable within 1 month, no questions) | ❌ | Today `program_settings.premium_price` = one price. New: 3 plan rows, CRM-editable (Q3). Terms `#refunds` updated to match. |
| M3 | Pay button → **Razorpay payment link** | ❌ | Each plan its own link (Q2). Log `payment_tried` with plan before redirect. |
| M4 | Payment processed → **plan recorded against the broker** | ❌ | Either Razorpay webhook (auto) or super-admin approval in /sales-funnel (Q2). Writes `partner_entitlements` with plan + months. |
| M5 | All features activate only with a plan | ❌ | Gate = active entitlement. Existing free partners → Q4. |

## 5. After payment

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| A1 | **Congratulations** page — "dopamine" one-pager with ROI | ❌ | Confetti, plan, ROI (uses the earnings calculator numbers), **Refer & Earn** CTA. Shown once after activation. |
| A2 | Refer & Earn: **unique referral code**, copy link, share to WhatsApp | ❌ | `broker_partners.referral_code`; link `partners.moveazy.co.in/?ref=CODE`; sign-ups store `referred_by`. |
| A3 | **₹1,500 per referred subscription**, earned after 1 month without cancellation | ❌ | Referral ledger: pending → earned (day 30 & not refunded) → paid (Q6). |
| A4 | Broker **Referrals page** (who joined, status, earnings) | ❌ | |
| A5 | Home **dashboard card: Complete profile** — operational areas (from DB localities) + **RERA ID** | ❌ | |
| A6 | Profile complete → **golden Premium card** + broker **logo turns gold** (from dark green) | ❌ | Gold logo asset needed (Q10). |

## 6. Internal: sales funnel

| ID | Requirement | Now | Gap / note |
|---|---|---|---|
| F1 | **partners.moveazy.co.in/sales-funnel**: signed up → number filled → payment tried (which plan) → plan approved | ❌ | Funnel from `partner_funnel_events`. |
| F2 | Only **super admin** can approve a payment/plan | 🟡 | CRM "grant premium" exists for `partners.manage`; tighten to super admin for payment approval. |
| F3 | **/sales-funnel/leads**: sign-ups by channel (organic, referral code, group invite, QR, campaign UTM) and each broker's stage, so product can nudge | ❌ | Capture `utm_*`/`ref` at landing, store on the partner row. |

---

## 7. Data model (new / changed)

- `partner_plans` (id, label, months, price, refund_days, razorpay_link, active, sort) — CRM-editable.
- `partner_entitlements` + `plan_id`, `amount`, `payment_ref`; approvals by super admin.
- `partner_payment_attempts` (broker, plan, started_at, status tried/paid/approved/rejected, razorpay ref).
- `partner_funnel_events` (broker, event, meta, at) — signed_up, number_filled, payment_tried, plan_approved, profile_completed.
- `broker_partners` + `referral_code`, `referred_by`, `signup_channel`, `utm`, `operational_areas text[]`, `rera_id`, `profile_completed_at`.
- `partner_referrals` (referrer, referee, plan, status pending/earned/paid/void, amount 1500, earn_after).
- `partner_leads` + `household` (bachelor/family), `gender_pref` (male/female/coed); name optional.
- `partner_curated_lists` (token, broker, lead, property_ids, created_at) + `partner_curated_actions` (list, property, action, at).
- `partner_tenants` (broker_id, name, phone, via list/storefront, status unverified) — the broker-leads source.
- `crm_clients.attributed_to text default 'moveazy'` — CRM lead views filter to MovEazy only.
- `partner_notifications` (broker, kind, payload, read_at).
- inventory status gains `potentially_rented` and `sold_out` (+ `sold_out_by`, `sold_out_at`), never deleted.

## 8. Build order (each step ships on its own, tested, live)

1. **Fix-first**: photo upload bug (P5); remove pricing + Become Partner + mobile-first sign-up (L1–L4).
2. Plans, payment attempts, super-admin approval, funnel events, /sales-funnel (M1–M5, F1–F2).
3. Demo mode for non-paying partners + Join Premium sticky + explainer pop-ups (D1–D7).
4. Congratulations + Refer & Earn + referrals page + /sales-funnel/leads (A1–A4, F3).
5. Complete profile + gold card/logo (A5–A6).
6. Add property step flow + more details paste box (P1–P7); add tenant fields (T1–T3).
7. AI curated list → tenant swipe page → actions → notifications → broker leads in CRM (C1–C7).
8. Groups sold-out with potentially-rented marker (G1–G4).

## 9. Decisions (29 Sep 2026)

| # | Question | Decision |
|---|---|---|
| Q1 | Mobile verification | **No OTP.** Valid Indian mobile format, saved before Google. |
| Q2 | Payment → active plan | **Razorpay webhook, automatic.** A Vercel function creates a payment link per broker + plan (notes carry both), Razorpay's `payment_link.paid` webhook activates the plan. Needs `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Super admin can still approve/reject by hand in /sales-funnel. |
| Q4 | Existing free brokers | **Move to demo mode.** Their data stays; it comes back when they pay. |
| Q5 | Tenant contact on curated list | **Mobile only, before swiping** (name optional). |
| D-add | Demo mode and own data | **Adding own listings and leads is free.** Sharing, AI curated lists, groups, MovEazy stock and broker network stay premium. |
| Q8 | WhatsApp paste in more details | **Stored as-is** (lightly cleaned) as the description. |
| Q6 | Referral payouts | **Tracked; super admin marks paid** after transferring. |
| Q12 | "8. at all places" | Ignored (stray line). |
| — | Plan prices | Editable in CRM (plan rows). |
| — | Sold-out rejected by listing broker | Listing goes back to available; the marker is cleared. |
