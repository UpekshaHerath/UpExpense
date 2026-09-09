/**
 * Daily reminder push — browser side.
 *
 * The service worker (public/sw.js) owns the subscription; this module only
 * creates, updates and tears it down, and mirrors it into Supabase so the
 * hourly sender can find it. Rows are RLS-protected to their owner, so the
 * ordinary anon client is enough here.
 */

import { createClient } from "@/lib/supabase/client";

export const DEFAULT_REMINDER_HOUR = 20;

export type ReminderState = {
  /** Push is impossible in this browser (no SW, no Push API, iOS Safari tab). */
  supported: boolean;
  /** Notification.permission, or "unsupported". */
  permission: NotificationPermission | "unsupported";
  /** A subscription exists for THIS browser and is switched on. */
  enabled: boolean;
  hour: number;
};

export const UNSUPPORTED: ReminderState = {
  supported: false,
  permission: "unsupported",
  enabled: false,
  hour: DEFAULT_REMINDER_HOUR,
};

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID public keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToBase64(key: ArrayBuffer | null) {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The SW registers in production only (see pwa-register.tsx), so in dev this
 * resolves to null and the settings UI reports "not available" rather than
 * hanging on a promise that never settles.
 */
async function registration() {
  if (!isPushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

/** Current state for this browser: permission + whether a row is switched on. */
export async function readReminderState(): Promise<ReminderState> {
  if (!isPushSupported()) return UNSUPPORTED;

  const permission = Notification.permission;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();

  if (!sub) {
    return { supported: true, permission, enabled: false, hour: await storedHour() };
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("enabled, reminder_hour, timezone")
    .eq("endpoint", sub.endpoint)
    .maybeSingle();

  // Travel (or a first subscribe under a stale clock) moves the user's local
  // 20:00. Re-stamp the zone whenever the app notices it drifted.
  const zone = localTimezone();
  if (data && data.timezone !== zone) {
    await supabase
      .from("push_subscriptions")
      .update({ timezone: zone })
      .eq("endpoint", sub.endpoint);
  }

  return {
    supported: true,
    permission,
    enabled: Boolean(data?.enabled),
    hour: data?.reminder_hour ?? DEFAULT_REMINDER_HOUR,
  };
}

/** Any row of the user's tells us the hour they picked on another device. */
async function storedHour() {
  const supabase = createClient();
  const { data } = await supabase
    .from("push_subscriptions")
    .select("reminder_hour")
    .limit(1)
    .maybeSingle();
  return data?.reminder_hour ?? DEFAULT_REMINDER_HOUR;
}

/**
 * Ask for permission, subscribe this browser, store the row. Returns the new
 * state; `enabled: false` with permission "denied" means the user said no and
 * the browser will not ask again.
 */
export async function enableReminders(
  hour = DEFAULT_REMINDER_HOUR
): Promise<ReminderState> {
  if (!isPushSupported()) return UNSUPPORTED;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { supported: true, permission, enabled: false, hour };
  }

  const reg = await registration();
  if (!reg) {
    // No service worker (dev, or registration failed) — nothing to subscribe.
    return { supported: true, permission, enabled: false, hour };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    }));

  const json = sub.toJSON();
  const supabase = createClient();
  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.user?.id,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? keyToBase64(sub.getKey("p256dh")),
      auth_key: json.keys?.auth ?? keyToBase64(sub.getKey("auth")),
      enabled: true,
      reminder_hour: hour,
      timezone: localTimezone(),
      // A fresh opt-in should be eligible tonight, not blocked by an old guard.
      last_sent_on: null,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;

  return { supported: true, permission, enabled: true, hour };
}

/** Unsubscribe this browser and forget the row. Other devices keep theirs. */
export async function disableReminders(): Promise<ReminderState> {
  if (!isPushSupported()) return UNSUPPORTED;

  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();

  if (sub) {
    const supabase = createClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }

  return {
    supported: true,
    permission: Notification.permission,
    enabled: false,
    hour: DEFAULT_REMINDER_HOUR,
  };
}

/**
 * Move the nudge to another hour. Applies to every device the user has, which
 * is what "my reminder time" means to a person with a phone and a laptop.
 */
export async function setReminderHour(hour: number) {
  const supabase = createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ reminder_hour: hour, timezone: localTimezone() })
    .eq("enabled", true);
  if (error) throw error;
}
