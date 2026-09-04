-- upExpense — Phase 3: loans
--
-- A loan is a `categories` row with kind='loan' plus a 1:1 `loans` row holding
-- the borrowed principal and a description. Installments are ordinary
-- `expenses` rows pointing at that category, so the day list, the expense
-- reports and the category-delete reassignment all keep working untouched —
-- "paid so far" is just the sum of the category's expenses.
--
-- Idempotent and safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. categories.kind gains 'loan'.
-- ---------------------------------------------------------------------------
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories
  add constraint categories_kind_check
  check (kind in ('expense', 'income', 'loan'));

-- ---------------------------------------------------------------------------
-- 2. loans — the extra fields a loan category carries.
-- ---------------------------------------------------------------------------
create table if not exists public.loans (
  category_id uuid primary key references public.categories (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  principal   numeric(12, 2) not null check (principal > 0),
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists loans_user_idx on public.loans (user_id);

alter table public.loans enable row level security;

drop policy if exists "loans: own rows" on public.loans;
create policy "loans: own rows"
  on public.loans for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Loan progress and the loan detail page both slice expenses by category;
-- without this they fall back to a scan of the user's whole expense history.
create index if not exists expenses_category_idx on public.expenses (category_id);

-- ---------------------------------------------------------------------------
-- 3. loan_summaries() — every loan with its progress in one round trip.
--
-- The day view needs remaining balances for its chips on every load, so the
-- aggregation stays in Postgres (one query, no per-loan client fan-out).
-- ---------------------------------------------------------------------------
create or replace function public.loan_summaries()
returns table (
  category_id  uuid,
  name         text,
  color        text,
  icon         text,
  principal    numeric,
  description  text,
  paid         numeric,
  remaining    numeric,
  tx_count     bigint,
  last_paid_on date,
  created_at   timestamptz
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
    l.principal,
    l.description,
    coalesce(p.paid, 0),
    greatest(l.principal - coalesce(p.paid, 0), 0),
    coalesce(p.tx_count, 0),
    p.last_paid_on,
    l.created_at
  from public.loans l
  join public.categories c on c.id = l.category_id
  left join lateral (
    select sum(e.amount) as paid,
           count(*)      as tx_count,
           max(e.expense_date) as last_paid_on
    from public.expenses e
    where e.category_id = l.category_id
      and e.user_id = auth.uid()
  ) p on true
  where l.user_id = auth.uid()
  order by greatest(l.principal - coalesce(p.paid, 0), 0) > 0 desc, c.name;
$$;
