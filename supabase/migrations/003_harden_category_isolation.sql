-- Fix: categories (and expenses/profiles) leaking across users.
--
-- The intended policy from 001 is correct (own rows via auth.uid()), but a
-- deployed database can drift: a permissive "read all" policy added by hand
-- in the Supabase dashboard is OR-ed with the correct one, so any
-- authenticated user sees everyone's rows. An anon request still returns
-- nothing (the stray policy is usually scoped to the `authenticated` role),
-- which is why the leak hides from unauthenticated checks.
--
-- This migration is idempotent and safe to run on an already-correct DB:
-- it drops EVERY existing policy on the three user-scoped tables, then
-- recreates exactly one own-rows policy per table, scoped to authenticated.
--
-- Note: RLS is enabled but NOT forced. handle_new_user() is SECURITY DEFINER
-- (runs as the table owner) and seeds default categories during signup, when
-- auth.uid() is null — forcing RLS would subject that insert to the policy
-- and break signup. Owners bypass non-forced RLS, so the seed still works.

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('categories', 'expenses', 'profiles')
  loop
    execute format(
      'drop policy %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
  end loop;
end $$;

alter table public.categories enable row level security;
alter table public.expenses   enable row level security;
alter table public.profiles   enable row level security;

create policy "categories: own rows"
  on public.categories for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "expenses: own rows"
  on public.expenses for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "profiles: own rows"
  on public.profiles for all
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
