-- upExpense — streak engine
--
-- A day counts as "active" if it holds an expense, an income, or an explicit
-- no-spend marker. The streak measures the habit (did you show up?), never the
-- money, so a frugal day and a heavy day are worth exactly the same.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

-- ---------------------------------------------------------------------------
-- current_streak — length, grace state, and whether today is already in
--
-- `p_today` comes from the client, not `current_date`: expense_date is a local
-- calendar day and the database runs in UTC. At 02:00 in Colombo the server
-- still thinks it is yesterday, which would silently break a live streak.
--
-- Grace: one missed day is forgiven per rolling 7 days. Without it a single
-- busy day resets everything to zero, which is the moment people quit.
-- ---------------------------------------------------------------------------
create or replace function public.current_streak(p_today date)
returns table (days int, skips_left int, logged_today boolean)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  active     date[];
  cursor_day date;
  last_skip  date;
  streak     int := 0;
  guard      int := 0;
begin
  if auth.uid() is null then
    return query select 0, 0, false;
    return;
  end if;

  -- One pass over the three sources; two years back is far more than any
  -- milestone needs and keeps the array small.
  select coalesce(array_agg(d), '{}'::date[])
  into active
  from (
    select expense_date as d from public.expenses
      where user_id = auth.uid() and expense_date between p_today - 730 and p_today
    union
    select income_date from public.incomes
      where user_id = auth.uid() and income_date between p_today - 730 and p_today
    union
    select day from public.no_spend_days
      where user_id = auth.uid() and day between p_today - 730 and p_today
  ) s;

  logged_today := p_today = any(active);

  -- Today not logged yet is not a broken streak — the day is still running.
  cursor_day := case when logged_today then p_today else p_today - 1 end;

  loop
    guard := guard + 1;
    exit when guard > 800;

    if cursor_day = any(active) then
      streak := streak + 1;
      cursor_day := cursor_day - 1;
    elsif (streak > 0 or guard = 1)
      and (last_skip is null or last_skip - cursor_day >= 7)
    then
      -- `guard = 1` covers the live case: yesterday was missed and today is
      -- not logged yet. The streak is wounded, not dead — forgive and walk on.
      -- Spend the grace day and keep walking. It does not add to the count:
      -- a skipped day was not earned, it was only forgiven.
      last_skip := cursor_day;
      cursor_day := cursor_day - 1;
    else
      exit;
    end if;
  end loop;

  days := streak;
  -- What the badge shows: is a forgiveness available right now?
  skips_left := case
    when last_skip is not null and p_today - last_skip < 7 then 0
    else 1
  end;

  return next;
end;
$$;
