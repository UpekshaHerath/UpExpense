# upExpense — Daily reminder notifications

A once-a-day web push nudge on days the user hasn't logged anything.

**Author:** Upeksha Herath · **Date:** 2026-09-07

---

## How it works

```
pg_cron (hourly, in Supabase)
   └─ send_due_reminders()  ──pg_net POST──▶  /api/cron/reminders   (Next.js, Vercel)
                                                  │
                                                  ├─ rpc due_reminders()   ← who is due right now
                                                  ├─ web-push → FCM / Mozilla / APNs
                                                  └─ rpc mark_reminder_sent()
                                                                    │
                                                        push event ▼
                                                            public/sw.js
                                                          showNotification()
```

The cron runs **hourly**, not daily: "20:00" means 20:00 where the user lives.
Each run, the database picks the subscriptions whose local clock just struck
their chosen hour. Everything else — timezone maths, the "already logged?"
check, the double-send guard — is one SQL query, `public.due_reminders()`.

**Never guilt** (engagement plan §2): a day that already holds an expense, an
income, or a no-spend marker gets no push.

## Files

| File | Role |
|---|---|
| `supabase/migrations/011_reminders.sql` | `push_subscriptions` table, RLS, `due_reminders()`, `mark_reminder_sent()`, `drop_subscription()` |
| `supabase/migrations/012_reminder_cron.sql` | pg_cron schedule + `send_due_reminders()` (pg_net POST) |
| `frontend_upExpense/src/app/api/cron/reminders/route.ts` | The sender. Secret-checked, Node runtime, `web-push` |
| `frontend_upExpense/src/lib/push.ts` | Browser side: subscribe / unsubscribe / change hour |
| `frontend_upExpense/src/lib/supabase/admin.ts` | Service-role client (server only) |
| `frontend_upExpense/src/components/reminder-settings.tsx` | The Settings → Daily reminder section |
| `frontend_upExpense/public/sw.js` | `push` + `notificationclick` handlers |

## Setup

### 1. VAPID keys (once)

```bash
cd frontend_upExpense
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

### 2. Environment variables

Local `.env.local` and Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public key from step 1 (shipped to the browser) |
| `VAPID_PRIVATE_KEY` | private key from step 1 — **server only** |
| `VAPID_SUBJECT` | `mailto:you@your-domain.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role. Bypasses RLS |
| `CRON_SECRET` | long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Changing `NEXT_PUBLIC_VAPID_PUBLIC_KEY` later invalidates every existing
subscription — users would have to toggle the reminder off and on again.

### 3. Database

Run `011_reminders.sql` in the Supabase SQL editor (or `supabase db push`).

Then, before `012_reminder_cron.sql`, set the two database settings it reads:

```sql
alter database postgres
  set app.reminder_endpoint = 'https://your-domain.com/api/cron/reminders';
alter database postgres
  set app.cron_secret = '<the same value as CRON_SECRET>';
```

Reconnect (settings are per session), then run `012_reminder_cron.sql`.

### 4. Verify

```sql
select * from cron.job;                                        -- the schedule exists
select * from cron.job_run_details order by start_time desc limit 5;
select id, status_code, content from net._http_response order by created desc limit 5;
```

The route also answers a health check:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://your-domain.com/api/cron/reminders
# {"ok":true}
```

Fire a real sweep by hand:

```bash
curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-domain.com/api/cron/reminders
# {"due":1,"sent":1,"dropped":0,"failed":0}
```

To test end to end without waiting for evening, set your row's
`reminder_hour` to the current UTC-local hour and clear the guard:

```sql
update push_subscriptions set reminder_hour = 14, last_sent_on = null;
```

## Behaviour notes

- **One row per browser.** Phone and laptop are separate subscriptions; the
  toggle turns off the device you press it on. The *hour* is account-wide.
- **Dev has no reminders.** The service worker registers in production builds
  only (`pwa-register.tsx`), so Settings shows "Not available in this
  browser" under `next dev`. Test with `npm run build && npm start` over
  HTTPS, or on the deployed site.
- **iOS.** Safari only delivers web push to a PWA **installed to the home
  screen** (iOS 16.4+). In a normal Safari tab the toggle reports it is
  unavailable. The Play Store TWA build inherits Android's behaviour, which
  works normally.
- **Dead subscriptions self-clean.** A 404/410 from a push service deletes the
  row (`drop_subscription`).
- **Timezone drift.** The zone is re-stamped whenever the app reads the
  reminder state and notices it changed, so travel moves the nudge with the
  user.
