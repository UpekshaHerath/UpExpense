-- upExpense — Phase 1 schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique not null,
  currency   text not null default 'LKR',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own rows"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default '#2a78d6',
  icon       text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

create policy "categories: own rows"
  on public.categories for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- restrict: the app reassigns expenses to "Other" before a category delete
  category_id    uuid not null references public.categories (id) on delete restrict,
  amount         numeric(12, 2) not null check (amount > 0),
  note           text,
  payment_method text check (payment_method in ('cash', 'card')),
  expense_date   date not null,
  created_at     timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, expense_date);

alter table public.expenses enable row level security;

create policy "expenses: own rows"
  on public.expenses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- New-user bootstrap: profile row + default categories
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

  -- Colors: CVD-validated 10-slot categorical palette (dataviz six-checks pass).
  insert into public.categories (user_id, name, color, icon, is_default)
  values
    (new.id, 'Petrol',         '#2a78d6', '⛽', true),
    (new.id, 'Vehicle Repair', '#1baf7a', '🔧', true),
    (new.id, 'Dayout & Trips', '#eda100', '🌄', true),
    (new.id, 'Food',           '#008300', '🍽️', true),
    (new.id, 'Gym',            '#4a3aa7', '🏋️', true),
    (new.id, 'Supplements',    '#e34948', '💊', true),
    (new.id, 'Groceries',      '#e87ba4', '🛒', true),
    (new.id, 'Utilities',      '#eb6834', '💡', true),
    (new.id, 'Health',         '#1c5cab', '🩺', true),
    (new.id, 'Other',          '#b45309', '📦', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Report functions (aggregation stays in Postgres — PRD RPT-4)
-- ---------------------------------------------------------------------------

-- Per-category totals for any date range (month, year, custom).
create or replace function public.category_totals(p_from date, p_to date)
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
  select c.id, c.name, c.color, c.icon, sum(e.amount), count(*)
  from public.expenses e
  join public.categories c on c.id = e.category_id
  where e.user_id = auth.uid()
    and e.expense_date between p_from and p_to
  group by c.id, c.name, c.color, c.icon
  order by sum(e.amount) desc;
$$;

-- Per-day totals for any date range (daily spending line / heatmap).
create or replace function public.daily_totals(p_from date, p_to date)
returns table (day date, total numeric)
language sql
security invoker
set search_path = public
as $$
  select e.expense_date, sum(e.amount)
  from public.expenses e
  where e.user_id = auth.uid()
    and e.expense_date between p_from and p_to
  group by e.expense_date
  order by e.expense_date;
$$;

-- Per-month totals for a year (yearly report bars).
create or replace function public.monthly_totals(p_year int)
returns table (month int, total numeric)
language sql
security invoker
set search_path = public
as $$
  select extract(month from e.expense_date)::int, sum(e.amount)
  from public.expenses e
  where e.user_id = auth.uid()
    and extract(year from e.expense_date) = p_year
  group by 1
  order by 1;
$$;
