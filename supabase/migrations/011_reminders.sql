-- upExpense — daily reminder push notifications
--
-- One row per browser/device push subscription. A user on phone + laptop has
-- two rows; disabling on one device leaves the other alone.
--
-- The sender (Next.js route /api/cron/reminders, woken hourly by pg_cron)
-- asks `due_reminders()` who should be nudged right now. All the timezone and
-- "did they already log today?" logic lives here, in one query, rather than
-- being re-derived per row in TypeScript.
--
-- Idempotent and safe to re-run. Run in the Supabase SQL editor or
-- `supabase db push`.

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  -- The push service URL is the subscription's identity. Re-subscribing the
  -- same browser yields the same endpoint, so upsert on it.
  endpoint      text not null unique,
  p256dh        text not null,
  -- Named auth_key, not auth: a column called `auth` shadows the auth schema,
  -- which breaks every `auth.uid()` in this table's RLS policies.
  auth_key      text not null,
  enabled       boolean not null default true,
  -- Local wall-clock hour to nudge at, 0-23. Evening by default: the day's
  -- spending has happened, and there is still time to log it.
  reminder_hour smallint not null default 20
                check (reminder_hour between 0 and 23),
  -- IANA name from the browser (Intl.DateTimeFormat().resolvedOptions()).
  timezone      text not null default 'UTC',
  -- Last local day a push actually went out — the double-send guard. The cron
  -- fires hourly and a run can overlap or retry; without this a user could be
  -- nudged twice in the same hour.
  last_sent_on  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- The hourly sweep filters on these two first.
create index if not exists push_subscriptions_due_idx
  on public.push_subscriptions (enabled, reminder_hour);

-- ---------------------------------------------------------------------------
-- Timezone sanity
--
-- An unknown IANA name makes `at time zone` raise, which would take down the
-- whole sweep for every other user. Fall back to UTC on write instead.
-- ---------------------------------------------------------------------------
create or replace function public.push_subscriptions_normalize()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  begin
    perform now() at time zone new.timezone;
  exception
    when others then
      new.timezone := 'UTC';
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_normalize on public.push_subscriptions;
create trigger push_subscriptions_normalize
  before insert or update on public.push_subscriptions
  for each row execute function public.push_subscriptions_normalize();

-- ---------------------------------------------------------------------------
-- RLS — a subscription is private to its owner
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;

drop policy if exists "own subscriptions readable" on public.push_subscriptions;
create policy "own subscriptions readable"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "own subscriptions insertable" on public.push_subscriptions;
create policy "own subscriptions insertable"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "own subscriptions updatable" on public.push_subscriptions;
create policy "own subscriptions updatable"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own subscriptions deletable" on public.push_subscriptions;
create policy "own subscriptions deletable"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- due_reminders — who gets nudged this hour
--
-- security definer so the service-role sender can read across users; execute
-- is revoked from anon/authenticated so a signed-in client cannot enumerate
-- other people's endpoints.
--
-- "Never guilt" (engagement plan §2): a day that already holds an expense, an
-- income, or a no-spend marker is a day the user showed up. No push.
-- ---------------------------------------------------------------------------
create or replace function public.due_reminders()
returns table (
  id         uuid,
  user_id    uuid,
  endpoint   text,
  p256dh     text,
  auth_key   text,
  local_date date
)
language sql
volatile
security definer
set search_path = public
as $$
  select s.id,
         s.user_id,
         s.endpoint,
         s.p256dh,
         s.auth_key,
         l.local_ts::date as local_date
  from public.push_subscriptions s
  cross join lateral (
    select now() at time zone s.timezone as local_ts
  ) l
  where s.enabled
    and extract(hour from l.local_ts)::int = s.reminder_hour
    and s.last_sent_on is distinct from l.local_ts::date
    and not exists (
      select 1 from public.expenses e
      where e.user_id = s.user_id and e.expense_date = l.local_ts::date
    )
    and not exists (
      select 1 from public.incomes i
      where i.user_id = s.user_id and i.income_date = l.local_ts::date
    )
    and not exists (
      select 1 from public.no_spend_days n
      where n.user_id = s.user_id and n.day = l.local_ts::date
    );
$$;

revoke all on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;

-- ---------------------------------------------------------------------------
-- mark_reminder_sent — close the loop so the next hourly run skips this row
-- ---------------------------------------------------------------------------
create or replace function public.mark_reminder_sent(p_id uuid, p_day date)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.push_subscriptions
  set last_sent_on = p_day
  where id = p_id;
$$;

revoke all on function public.mark_reminder_sent(uuid, date) from public, anon, authenticated;
grant execute on function public.mark_reminder_sent(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- drop_subscription — a push service answered 404/410: the browser is gone
-- ---------------------------------------------------------------------------
create or replace function public.drop_subscription(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where id = p_id;
$$;

revoke all on function public.drop_subscription(uuid) from public, anon, authenticated;
grant execute on function public.drop_subscription(uuid) to service_role;
