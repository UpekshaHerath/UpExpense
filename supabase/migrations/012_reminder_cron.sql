-- upExpense — hourly wake-up for the reminder sender
--
-- pg_cron fires every hour on the hour; pg_net posts to the Next.js route,
-- which decides who is actually due (see 011_reminders.sql → due_reminders()).
-- Hourly, not daily, because "20:00" means 20:00 *where the user lives* — a
-- single daily UTC run would nudge Colombo at half past midnight.
--
-- BEFORE RUNNING, set the two settings below (Supabase SQL editor, once):
--
--   alter database postgres
--     set app.reminder_endpoint = 'https://your-app.example.com/api/cron/reminders';
--   alter database postgres
--     set app.cron_secret = '<the same value as CRON_SECRET in Vercel>';
--
-- Then reconnect (settings are read per session) and run this file.
--
-- Idempotent and safe to re-run.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- send_due_reminders — one HTTP POST, fire and forget
--
-- pg_net is async: this returns a request id immediately and never blocks the
-- cron worker on a slow serverless cold start. Failures surface in
-- net._http_response, not here.
-- ---------------------------------------------------------------------------
create or replace function public.send_due_reminders()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  endpoint text := current_setting('app.reminder_endpoint', true);
  secret   text := current_setting('app.cron_secret', true);
begin
  if endpoint is null or secret is null then
    raise warning 'reminder cron: app.reminder_endpoint / app.cron_secret not set';
    return null;
  end if;

  return net.http_post(
    url     := endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.send_due_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedule: every hour, on the hour (UTC)
-- ---------------------------------------------------------------------------
select cron.unschedule('upexpense-daily-reminders')
where exists (
  select 1 from cron.job where jobname = 'upexpense-daily-reminders'
);

select cron.schedule(
  'upexpense-daily-reminders',
  '0 * * * *',
  $$select public.send_due_reminders();$$
);

-- Useful checks:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content from net._http_response order by created desc limit 10;
