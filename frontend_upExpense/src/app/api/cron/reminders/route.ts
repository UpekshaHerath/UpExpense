/**
 * Daily reminder sender.
 *
 * Woken hourly by pg_cron (see supabase/migrations/012_reminder_cron.sql),
 * which calls this route with the shared secret. Every run asks the database
 * `due_reminders()` — whose local clock just struck their chosen hour and who
 * has logged nothing today — and pushes to those subscriptions only.
 *
 * Node runtime: web-push signs VAPID headers with node:crypto.
 */

import { timingSafeEqual } from "node:crypto";
import webpush, { WebPushError } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DueReminder = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  local_date: string;
};

/**
 * Reward the logging, never the spending; never guilt (engagement plan §2).
 * Rotating by date keeps a daily notification from turning into wallpaper.
 */
const NUDGES = [
  "Two taps and today is logged.",
  "What did today cost? Takes 10 seconds.",
  "Keep the streak burning — log today.",
  "Spent nothing? Mark it a no-spend day.",
  "Today's numbers are still fresh. Log them.",
  "One entry keeps the month's picture honest.",
  "Quick check-in: anything to log today?",
];

function nudgeFor(localDate: string) {
  // Day-of-month is enough spread and needs no state.
  const day = Number(localDate.slice(-2)) || 1;
  return NUDGES[day % NUDGES.length];
}

function secretOk(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretOk(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@upexpense.app";
  if (!publicKey || !privateKey) {
    return Response.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("due_reminders");
  if (error) {
    console.error("due_reminders failed:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const due = (data ?? []) as DueReminder[];
  let sent = 0;
  let dropped = 0;
  let failed = 0;

  // Small batches: a push service call is ~100ms and the whole run must fit
  // inside a serverless invocation.
  const BATCH = 20;
  for (let i = 0; i < due.length; i += BATCH) {
    const batch = due.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (row) => {
        const payload = JSON.stringify({
          title: "upExpense",
          body: nudgeFor(row.local_date),
          tag: `daily-reminder-${row.local_date}`,
          url: `/day/${row.local_date}`,
        });

        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth_key },
            },
            payload,
            { TTL: 6 * 60 * 60 } // Stale by tomorrow; don't deliver a day late.
          );
          await supabase.rpc("mark_reminder_sent", {
            p_id: row.id,
            p_day: row.local_date,
          });
          sent++;
        } catch (err) {
          // 404/410: the browser dropped the subscription (uninstalled,
          // cleared site data). It will never work again — delete it.
          if (
            err instanceof WebPushError &&
            (err.statusCode === 404 || err.statusCode === 410)
          ) {
            await supabase.rpc("drop_subscription", { p_id: row.id });
            dropped++;
            return;
          }
          failed++;
          console.error(
            "push failed:",
            err instanceof Error ? err.message : String(err)
          );
        }
      })
    );
  }

  return Response.json({ due: due.length, sent, dropped, failed });
}

/** Health check — confirms the route is deployed and the secret matches. */
export async function GET(request: Request) {
  if (!secretOk(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true });
}
