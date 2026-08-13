-- upExpense — first-expense celebration
--
-- Records when a user was shown the "first expense logged" celebration, so it
-- fires exactly once per account rather than once per device. The client also
-- mirrors this into localStorage, but this column is the source of truth.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

alter table public.profiles
  add column if not exists first_expense_celebrated_at timestamptz;

-- Anyone who already logged an expense has passed the moment we celebrate —
-- only accounts still on zero expenses should get the popup.
update public.profiles p
set first_expense_celebrated_at = now()
where p.first_expense_celebrated_at is null
  and exists (select 1 from public.expenses e where e.user_id = p.id);
