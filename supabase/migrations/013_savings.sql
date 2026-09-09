-- upExpense — savings pots
--
-- A savings pot is a `categories` row with kind='saving' plus a 1:1 `savings`
-- row holding an optional target and a description. It is the mirror image of
-- a loan: a loan starts full and counts DOWN, a pot starts empty and counts UP.
--
-- Money in  = an ordinary `expenses` row on that category. Putting cash aside
--             is money leaving the spendable pile, so the day total, the
--             streak and the expense reports all stay honest.
-- Money out = an ordinary `incomes` row on that category — raiding the pot
--             puts spendable cash back in hand.
--
-- Balance is therefore always derived (deposits − withdrawals), never a column
-- that can drift out of step with the entries behind it.
--
-- Idempotent and safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. categories.kind gains 'saving'.
-- ---------------------------------------------------------------------------
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories
  add constraint categories_kind_check
  check (kind in ('expense', 'income', 'loan', 'saving'));

-- ---------------------------------------------------------------------------
-- 2. savings — the extra fields a savings category carries.
-- ---------------------------------------------------------------------------
create table if not exists public.savings (
  category_id uuid primary key references public.categories (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Optional: "New laptop — 300,000" gets a progress bar, "Emergency fund"
  -- with no target just shows a running balance. Open-ended saving is normal.
  target      numeric(12, 2) check (target is null or target > 0),
  description text,
  -- Set when the user marks the pot done. A closed pot keeps every entry and
  -- its balance; it just stops offering itself as a chip on the day view.
  closed_at   timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists savings_user_idx on public.savings (user_id);

alter table public.savings enable row level security;

drop policy if exists "savings: own rows" on public.savings;
create policy "savings: own rows"
  on public.savings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Withdrawals slice incomes by category, the same way loan progress slices
-- expenses. Without this the pot summary scans the user's whole income history.
create index if not exists incomes_category_idx on public.incomes (category_id);

-- ---------------------------------------------------------------------------
-- 3. saving_summaries() — every pot with its balance in one round trip.
--
-- The day view needs these for its chips on every load, so both sides are
-- aggregated in Postgres rather than fanning out per pot on the client.
-- ---------------------------------------------------------------------------
create or replace function public.saving_summaries()
returns table (
  category_id      uuid,
  name             text,
  color            text,
  icon             text,
  target           numeric,
  description      text,
  deposited        numeric,
  withdrawn        numeric,
  balance          numeric,
  tx_count         bigint,
  last_activity_on date,
  closed_at        timestamptz,
  created_at       timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.color,
    c.icon,
    s.target,
    s.description,
    coalesce(d.deposited, 0),
    coalesce(w.withdrawn, 0),
    -- A pot cannot hold less than nothing: over-withdrawing floors at zero
    -- rather than showing a negative saved balance.
    greatest(coalesce(d.deposited, 0) - coalesce(w.withdrawn, 0), 0),
    coalesce(d.tx_count, 0) + coalesce(w.tx_count, 0),
    greatest(d.last_on, w.last_on),
    s.closed_at,
    s.created_at
  from public.savings s
  join public.categories c on c.id = s.category_id
  left join lateral (
    select sum(e.amount)        as deposited,
           count(*)             as tx_count,
           max(e.expense_date)  as last_on
    from public.expenses e
    where e.category_id = s.category_id
      and e.user_id = auth.uid()
  ) d on true
  left join lateral (
    select sum(i.amount)       as withdrawn,
           count(*)            as tx_count,
           max(i.income_date)  as last_on
    from public.incomes i
    where i.category_id = s.category_id
      and i.user_id = auth.uid()
  ) w on true
  where s.user_id = auth.uid()
  -- Open pots first (they are the ones you can still add to), then by name.
  order by s.closed_at is null desc, c.name;
$$;
