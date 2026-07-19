-- upExpense — Phase 2: income tracking + balances
--
-- Adds an income side to the app: categories gain a `kind` (expense|income),
-- a new `incomes` table mirrors `expenses`, and income aggregation RPCs mirror
-- the expense ones. Balances (income − expense) are computed client-side from
-- the two totals.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

-- ---------------------------------------------------------------------------
-- 1. categories.kind — existing rows stay 'expense'.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists kind text not null default 'expense'
  check (kind in ('expense', 'income'));

-- Name uniqueness becomes per (user, kind): "Other" can exist on both sides.
alter table public.categories drop constraint if exists categories_user_id_name_key;
create unique index if not exists categories_user_kind_name_key
  on public.categories (user_id, kind, name);

-- ---------------------------------------------------------------------------
-- 2. incomes — mirrors expenses. No payment_method (not meaningful for income).
-- ---------------------------------------------------------------------------
create table if not exists public.incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- restrict: the app reassigns incomes to "Other Income" before a category delete
  category_id uuid not null references public.categories (id) on delete restrict,
  amount      numeric(12, 2) not null check (amount > 0),
  note        text,
  income_date date not null,
  created_at  timestamptz not null default now()
);

create index if not exists incomes_user_date_idx on public.incomes (user_id, income_date);

alter table public.incomes enable row level security;

drop policy if exists "incomes: own rows" on public.incomes;
create policy "incomes: own rows"
  on public.incomes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. New-user bootstrap now seeds income categories too.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );

  -- Expense categories: CVD-validated 10-slot categorical palette.
  insert into public.categories (user_id, name, color, icon, is_default, kind)
  values
    (new.id, 'Petrol',         '#2a78d6', '⛽', true, 'expense'),
    (new.id, 'Vehicle Repair', '#1baf7a', '🔧', true, 'expense'),
    (new.id, 'Dayout & Trips', '#eda100', '🌄', true, 'expense'),
    (new.id, 'Food',           '#008300', '🍽️', true, 'expense'),
    (new.id, 'Gym',            '#4a3aa7', '🏋️', true, 'expense'),
    (new.id, 'Supplements',    '#e34948', '💊', true, 'expense'),
    (new.id, 'Groceries',      '#e87ba4', '🛒', true, 'expense'),
    (new.id, 'Utilities',      '#eb6834', '💡', true, 'expense'),
    (new.id, 'Health',         '#1c5cab', '🩺', true, 'expense'),
    (new.id, 'Other',          '#b45309', '📦', true, 'expense');

  -- Income sources.
  insert into public.categories (user_id, name, color, icon, is_default, kind)
  values
    (new.id, 'Salary',       '#1baf7a', '💼', true, 'income'),
    (new.id, 'Business',     '#2a78d6', '🏢', true, 'income'),
    (new.id, 'Investments',  '#eda100', '📈', true, 'income'),
    (new.id, 'Gifts',        '#e87ba4', '🎁', true, 'income'),
    (new.id, 'Other Income', '#b45309', '💰', true, 'income');

  return new;
end;
$$;

-- Backfill income categories for users created before this migration.
-- Runs as the migration owner (bypasses RLS); conflicts skipped.
insert into public.categories (user_id, name, color, icon, is_default, kind)
select p.id, v.name, v.color, v.icon, true, 'income'
from public.profiles p
cross join (values
  ('Salary',       '#1baf7a', '💼'),
  ('Business',     '#2a78d6', '🏢'),
  ('Investments',  '#eda100', '📈'),
  ('Gifts',        '#e87ba4', '🎁'),
  ('Other Income', '#b45309', '💰')
) as v(name, color, icon)
on conflict (user_id, kind, name) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Income report functions — mirror the expense aggregations.
-- ---------------------------------------------------------------------------

-- Per-category income totals for any date range.
create or replace function public.income_category_totals(p_from date, p_to date)
returns table (
  category_id uuid,
  name        text,
  color       text,
  icon        text,
  total       numeric,
  tx_count    bigint
)
language sql
security invoker
set search_path = public
as $$
  select c.id, c.name, c.color, c.icon, sum(i.amount), count(*)
  from public.incomes i
  join public.categories c on c.id = i.category_id
  where i.user_id = auth.uid()
    and i.income_date between p_from and p_to
  group by c.id, c.name, c.color, c.icon
  order by sum(i.amount) desc;
$$;

-- Per-day income totals for any date range.
create or replace function public.income_daily_totals(p_from date, p_to date)
returns table (day date, total numeric)
language sql
security invoker
set search_path = public
as $$
  select i.income_date, sum(i.amount)
  from public.incomes i
  where i.user_id = auth.uid()
    and i.income_date between p_from and p_to
  group by i.income_date
  order by i.income_date;
$$;

-- Per-month income totals for a year.
create or replace function public.income_monthly_totals(p_year int)
returns table (month int, total numeric)
language sql
security invoker
set search_path = public
as $$
  select extract(month from i.income_date)::int, sum(i.amount)
  from public.incomes i
  where i.user_id = auth.uid()
    and extract(year from i.income_date) = p_year
  group by 1
  order by 1;
$$;
