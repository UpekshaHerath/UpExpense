"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { useReward } from "@/components/rewards/rewards";
import type { RewardKey } from "@/components/rewards/registry";

export type Streak = {
  days: number;
  /** Grace days available right now — one per rolling week. */
  skipsLeft: number;
  loggedToday: boolean;
};

type StreakContextValue = {
  streak: Streak | null;
  /**
   * Re-reads the streak. Pass `celebrate` after the user logs something, so
   * the first entry of the day gets its toast and any milestone fires.
   */
  refresh: (options?: { celebrate?: boolean }) => Promise<void>;
};

const StreakContext = createContext<StreakContextValue | null>(null);

/** Streak lengths worth a full milestone modal. Everything else is a toast. */
const MILESTONES: { at: number; key: RewardKey }[] = [
  { at: 7, key: "streak_7" },
  { at: 30, key: "streak_30" },
  { at: 100, key: "streak_100" },
];

export function StreakProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const toast = useToast();
  const claim = useReward();

  const [streak, setStreak] = useState<Streak | null>(null);
  // Read inside the async refresh, where `streak` would be a stale closure.
  const current = useRef<Streak | null>(null);

  const refresh = useCallback(
    async (options?: { celebrate?: boolean }) => {
      // The client owns "today": expense_date is a local calendar day and the
      // database runs in UTC.
      const { data, error } = await supabase.rpc("current_streak", {
        p_today: todayISO(),
      });

      // Migration not applied yet — no badge rather than a broken one.
      if (error || !data?.[0]) return;

      const next: Streak = {
        days: data[0].days ?? 0,
        skipsLeft: data[0].skips_left ?? 0,
        loggedToday: data[0].logged_today ?? false,
      };
      const previous = current.current;
      current.current = next;
      setStreak(next);

      if (!options?.celebrate) return;

      // Only the entry that *opens* the day gets a toast; the fifth expense of
      // an afternoon is not news.
      const openedTheDay = next.loggedToday && !previous?.loggedToday;
      if (openedTheDay) {
        toast(
          next.days <= 1
            ? "Streak started. Day 1."
            : `Day ${next.days}. Streak intact.`,
          { icon: "🔥" }
        );
      }

      // `>=` so a streak that jumped past a threshold (grace day, backfilled
      // data) still collects it. claim() guarantees once per account.
      for (const m of MILESTONES) {
        if (next.days >= m.at) claim(m.key);
      }
    },
    [supabase, toast, claim]
  );

  useEffect(() => {
    (async () => {
      await refresh();
    })();
  }, [refresh]);

  return (
    <StreakContext.Provider value={{ streak, refresh }}>
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error("useStreak must be used inside <StreakProvider>");
  return ctx;
}

/**
 * Always-visible progress. Hidden at zero — a dead flame is a scoreboard for
 * failure, and this app does not do guilt.
 */
export function StreakBadge() {
  const { streak } = useStreak();
  const days = streak?.days ?? 0;

  if (days < 1) return null;

  const title = [
    `${days}-day streak`,
    streak?.loggedToday ? "today is in" : "not logged today yet",
    streak?.skipsLeft ? "1 skip left this week" : "no skips left this week",
  ].join(" · ");

  return (
    <span
      title={title}
      aria-label={title}
      className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-600 tabular-nums dark:text-orange-400"
    >
      {/* Dimmed until the day is logged: a quiet nudge, never a scolding. */}
      <span className={streak?.loggedToday ? "" : "opacity-50"}>🔥</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={days}
          initial={{ y: 8, opacity: 0, scale: 0.7 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -8, opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
        >
          {days}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
