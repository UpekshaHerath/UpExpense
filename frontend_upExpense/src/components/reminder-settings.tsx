"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogSection, DialogSectionHeader } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_REMINDER_HOUR,
  disableReminders,
  enableReminders,
  isPushSupported,
  readReminderState,
  setReminderHour,
  UNSUPPORTED,
  type ReminderState,
} from "@/lib/push";

/** 24 rows is a long list on a phone; the small hours are noise. */
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00 – 23:00

function hourLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

/**
 * Daily reminder controls. One subscription per browser, so the toggle reads
 * "is this device subscribed?" while the hour is the account's, shared across
 * devices.
 */
export function ReminderSettings() {
  const toast = useToast();
  const [state, setState] = useState<ReminderState | null>(null);
  const [busy, setBusy] = useState(false);

  // Reading the state touches the service worker and the database, so it
  // lands after the first paint; the controls stay disabled until it does.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const next = isPushSupported() ? await readReminderState() : UNSUPPORTED;
      if (!ignore) setState(next);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleToggle() {
    if (!state) return;
    setBusy(true);
    try {
      const next = state.enabled
        ? await disableReminders()
        : await enableReminders(state.hour ?? DEFAULT_REMINDER_HOUR);
      setState(next);

      if (!state.enabled && !next.enabled) {
        toast(
          next.permission === "denied"
            ? "Notifications are blocked in your browser settings."
            : "Reminders need the installed app — add upExpense to your home screen.",
          { icon: "🔕" }
        );
      } else {
        toast(next.enabled ? "Daily reminder on" : "Daily reminder off", {
          icon: next.enabled ? "🔔" : "🔕",
        });
      }
    } catch (err) {
      console.error(err);
      toast("Could not change the reminder. Try again.", { icon: "⚠️" });
    } finally {
      setBusy(false);
    }
  }

  async function handleHour(value: string) {
    const hour = Number(value);
    const previous = state;
    setState((s) => (s ? { ...s, hour } : s));
    try {
      await setReminderHour(hour);
      toast(`Reminder moved to ${hourLabel(hour)}`, { icon: "⏰" });
    } catch (err) {
      console.error(err);
      setState(previous);
      toast("Could not save the reminder time.", { icon: "⚠️" });
    }
  }

  const supported = state?.supported ?? true;
  const enabled = state?.enabled ?? false;

  return (
    <DialogSection>
      <DialogSectionHeader
        icon={<Bell />}
        title="Daily reminder"
        hint={
          supported
            ? "A nudge on days you haven't logged"
            : "Not available in this browser"
        }
        action={
          <Button
            variant={enabled ? "outline" : "default"}
            size="sm"
            disabled={!state || !supported || busy}
            onClick={handleToggle}
            aria-pressed={enabled}
          >
            {busy ? "…" : enabled ? "Turn off" : "Turn on"}
          </Button>
        }
      />

      {enabled && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Remind me at</p>
          <Select
            value={String(state?.hour ?? DEFAULT_REMINDER_HOUR)}
            onValueChange={handleHour}
          >
            <SelectTrigger size="sm" aria-label="Reminder time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {hourLabel(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </DialogSection>
  );
}
