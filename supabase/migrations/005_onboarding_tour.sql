-- upExpense — first-run guided tour
--
-- Records when a user finished (or skipped) the onboarding walkthrough, so it
-- runs exactly once per account rather than once per device. The client also
-- mirrors this into localStorage, but this column is the source of truth.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

alter table public.profiles
  add column if not exists tour_completed_at timestamptz;

-- Everyone who already has an account has already learned the app — only
-- accounts created after this migration should get the walkthrough.
update public.profiles
set tour_completed_at = now()
where tour_completed_at is null;
