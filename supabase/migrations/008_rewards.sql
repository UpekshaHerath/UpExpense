-- upExpense — reward engine
--
-- Generalises the one-off first-expense flag (007) into a keyed achievements
-- table, so every future milestone is a row rather than a new column. Also
-- adds the zero-spend day marker and the user-facing celebrations kill switch.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

-- ---------------------------------------------------------------------------
-- achievements — one row per unlocked milestone
--
-- The database stores keys only; the copy for each key lives client-side in
-- components/rewards/registry.ts, so rewording never needs a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key       text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.achievements enable row level security;

drop policy if exists "achievements: own rows" on public.achievements;
create policy "achievements: own rows"
  on public.achievements for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- no_spend_days — "spent nothing today", declared explicitly
--
-- An empty day is ambiguous: it can mean no spending, or forgetting to log.
-- This table records the first meaning, which keeps a streak alive.
-- ---------------------------------------------------------------------------
create table if not exists public.no_spend_days (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.no_spend_days enable row level security;

drop policy if exists "no_spend_days: own rows" on public.no_spend_days;
create policy "no_spend_days: own rows"
  on public.no_spend_days for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Kill switch — celebrations are opt-out, not opt-in
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists celebrations_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- claim_achievement — atomic one-shot unlock
--
-- Returns true only for a genuinely new unlock, so two tabs racing the same
-- milestone produce exactly one celebration. Callers fire the modal on true
-- and stay silent on false.
-- ---------------------------------------------------------------------------
create or replace function public.claim_achievement(p_key text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed int;
begin
  if auth.uid() is null then
    return false;
  end if;

  insert into public.achievements (user_id, key)
  values (auth.uid(), p_key)
  on conflict (user_id, key) do nothing;

  get diagnostics claimed = row_count;
  return claimed > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Carry 007 forward: anyone already past the first-expense moment keeps it.
-- ---------------------------------------------------------------------------
-- Guarded: 008 must also apply cleanly on a database that skipped 007.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'first_expense_celebrated_at'
  ) then
    insert into public.achievements (user_id, key, earned_at)
    select p.id, 'first_expense', p.first_expense_celebrated_at
    from public.profiles p
    where p.first_expense_celebrated_at is not null
    on conflict (user_id, key) do nothing;
  else
    -- No 007 to carry: anyone with expenses is already past the moment.
    insert into public.achievements (user_id, key)
    select p.id, 'first_expense'
    from public.profiles p
    where exists (select 1 from public.expenses e where e.user_id = p.id)
    on conflict (user_id, key) do nothing;
  end if;
end
$$;

-- Same for income: an existing user must not be congratulated on their 40th.
insert into public.achievements (user_id, key)
select p.id, 'first_income'
from public.profiles p
where exists (select 1 from public.incomes i where i.user_id = p.id)
on conflict (user_id, key) do nothing;

-- 007's column is now redundant — achievements is the source of truth.
alter table public.profiles
  drop column if exists first_expense_celebrated_at;
