# MovEazy v1 Launch — Product Spec (overnight build)

_Author: founder brief (2026-08-02), transcribed + scoped by Cowork. Branch: `overnight/v1-launch-flows`._

## Objectives
1. **Renters see matching properties.** ✅ Working — `/map` shows 13 published Bengaluru
   listings from Supabase `inventory`. `/recommendations` shows 0 only until the user sets a
   search profile (expected). No fix needed; monitor.
2. **Anyone can post a flat easily, with a role-specific post-flat experience.** Poster roles:
   **owner**, **tenant** (currently residing, passing it on), **broker**.

## Poster flows — requirements vs current state
Integration point: `src/pages/ListMyFlat.jsx`. Role picker + publish + a `published` confirmation
screen already exist. `WALLET_REWARD_AMOUNT = ₹10,000`, credited on successful sale; eligibility
= compact/affordable types (1 RK / 1 BHK / room) via `WALLET_REWARD_TYPES`.

### Tenant (mostly built — polish only)
- ✅ Reward created + shown in wallet on publish.
- ✅ Wallet/dashboard note: reward credited once property is sold via on-ground executive.
  → **Gap:** make copy explicitly say "…paid into your **bank account** once the property closes."
- ✅ "You're moving somewhere new" prompt → button → `navigate("/?find=1")` (Find-my-flat).
  → **Gap:** confirm `/?find=1` actually opens Find-my-flat; strengthen the CTA.

### Owner (partly built)
- ✅ Same ₹10,000 reward path.
- ❌ **Upsell services page** after publish — "Have other properties?", "Get painting/cleaning
  done", offered free / "Book now". BUILD.
- ❌ **Owner dashboard** — profile clicks, leads, views per property. BUILD (can reuse
  `view_count` on inventory + leads source; stub metrics not yet tracked).

### Broker (partly built)
- ✅ Post-publish "list as a broker" block + "Go to broker dashboard" + post-another.
- ❌ **70/30 commission screen** — "You keep 70% of the commission, MovEazy keeps 30%." BUILD.
- ❌ **₹4,999/mo subscription offer** with: guarantee of **20 visits/month if ≥5 properties
  posted**, else **full ₹4,999 refund**; on this plan **no commission** to MovEazy; catch —
  broker must **mark a property "sold"**, which removes it from the platform. BUILD (UI + data
  shape; NO real payment/refund wiring — stub + flag).
- ❌ **Broker multi-property dashboard** with per-property stats + **mark-as-sold** action
  (sets inventory `status` → e.g. `sold`/`archived`, removing it from public map). BUILD.

## Assumptions (correct anytime)
- Reward amount: single configurable value, default **₹10,000**, owner + tenant.
- Broker guarantee: **20 visits/month with ≥5 properties → else full refund** (primary);
  "100 leads" kept as secondary marketing copy only.
- **Money is UI-only tonight.** Wallet balance, reward payout, ₹4,999 charge + refund guarantee
  = screens + data shape only. Razorpay/UPI configs exist (`src/config/*`) but real payment,
  bank payout, and automated refund enforcement are NOT wired unattended. Flagged for a
  supervised pass.

## Data notes
- `inventory` table PK = `property_id` (not `id`). Status values seen: `published`.
  Mark-sold should set a non-public status; public reads filter `status = 'published'`.
- Reward/wallet + subscription have no dedicated tables yet (front-end/stub for now).

## Build guardrails (this session)
- Work only on branch `overnight/v1-launch-flows`. **No production deploy.**
- Verify each change with `npx eslint <files>` (cross-platform) + careful review. Full runtime
  testing against live Supabase is NOT done unattended — flagged per item in STATUS.md.
- Keep components modular and additive; avoid touching the working map/discovery/auth paths.

## Mobile CSS
- ForkHome CTAs ("Find my flat" / "List my flat") stack top/bottom on mobile and look wrong.
  Redesign the mobile layout for that fork. (Task #3.)
