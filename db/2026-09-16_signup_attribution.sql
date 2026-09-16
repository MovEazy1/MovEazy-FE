-- Which post brought each account in.
--
-- Until now a signup recorded nothing about where the person came from. UTM
-- parameters were read off the current URL only (src/lib/shareAttribution.js),
-- so anyone who landed from a Facebook post, browsed for ten minutes and then
-- registered was indistinguishable from someone who typed the address in.
--
-- src/lib/attribution.js keeps the visitor's first touch in localStorage and
-- condenses it into one token at signup; these are the columns it lands in.
-- Apply this in the Supabase SQL editor before expecting the CRM to show a
-- source — until then the write is silently skipped and nothing breaks.

alter table public.user_profiles
  add column if not exists attribution_token   text,
  add column if not exists signup_source       text,
  add column if not exists signup_attribution  jsonb;

comment on column public.user_profiles.attribution_token is
  'First-touch source as one parseable string: mza1:<source>:<medium>:<campaign>:<content>:<base36 ms>. Written once, never updated.';
comment on column public.user_profiles.signup_source is
  'Just the source segment (facebook, reddit, crm, google, …), so grouping does not need to parse the token.';
comment on column public.user_profiles.signup_attribution is
  'Full first-touch detail: medium, campaign, content, term, mz_s share token, referrer, landing path, touch count, and the last touch for comparison.';

-- Counting signups per source is the whole point of the column, and that query
-- runs on every dashboard load. Partial, because the rows that matter are the
-- attributed ones and everything from before this migration is null.
create index if not exists user_profiles_signup_source_idx
  on public.user_profiles (signup_source)
  where signup_source is not null;

-- The client writes these through the same row-owner update policy it already
-- uses for name and phone, so no new policy is needed. The write is guarded
-- with `.is('attribution_token', null)` in src/lib/profileService.js, which is
-- what makes first touch win even if the call is repeated.

-- Signups by source, last 30 days — the answer this whole change exists for.
--
--   select coalesce(signup_source, 'direct') as source,
--          count(*) as signups
--     from public.user_profiles
--    where created_at > now() - interval '30 days'
--    group by 1
--    order by signups desc;
