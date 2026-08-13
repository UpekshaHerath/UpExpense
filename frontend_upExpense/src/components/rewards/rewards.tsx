"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Confetti } from "@/components/rewards/confetti";
import { REWARDS, type RewardKey } from "@/components/rewards/registry";

/**
 * Mirrors the keys already in public.achievements, so a returning user costs no
 * round-trip on every save. The table stays the source of truth — clearing site
 * data must not replay a celebration on another device.
 */
const EARNED_KEY = "upexpense.rewards.earned.v1";
/** Last day a modal was shown. One interruption per day, hard cap. */
const MODAL_DAY_KEY = "upexpense.rewards.modalday.v1";

function readEarned(): Set<string> {
  try {
    const raw = localStorage.getItem(EARNED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markEarned(key: string) {
  try {
    const earned = readEarned();
    earned.add(key);
    localStorage.setItem(EARNED_KEY, JSON.stringify([...earned]));
  } catch {
    // Storage blocked — claim_achievement still guarantees once-per-account.
  }
}

const RewardContext = createContext<((key: RewardKey) => void) | null>(null);

export function RewardProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [active, setActive] = useState<RewardKey | null>(null);
  // Read inside the async claim path, where `active` would be stale.
  const activeRef = useRef<RewardKey | null>(null);
  // profiles.celebrations_enabled, fetched once per session on first claim.
  const enabled = useRef<boolean | null>(null);

  const claim = useCallback(
    async (key: RewardKey) => {
      if (readEarned().has(key)) return;

      if (enabled.current === null) {
        const { data } = await supabase
          .from("profiles")
          .select("celebrations_enabled")
          .maybeSingle();
        enabled.current = data?.celebrations_enabled ?? true;
      }

      // Atomic: true only for a genuinely new unlock, so two open tabs racing
      // the same milestone still produce exactly one celebration.
      const { data: claimed, error } = await supabase.rpc(
        "claim_achievement",
        { p_key: key }
      );

      // Migration not applied yet — stay silent rather than firing on repeat.
      if (error) return;

      markEarned(key);
      if (!claimed || !enabled.current) return;

      // Budget: one modal a day, and never two at once. Anything over the cap
      // degrades to a toast rather than queueing up an interruption.
      let modalDay: string | null = null;
      try {
        modalDay = localStorage.getItem(MODAL_DAY_KEY);
      } catch {}
      const today = todayISO();

      if (activeRef.current || modalDay === today) {
        toast(REWARDS[key].toast, { icon: REWARDS[key].emoji });
        return;
      }

      try {
        localStorage.setItem(MODAL_DAY_KEY, today);
      } catch {}
      activeRef.current = key;
      setActive(key);
    },
    [supabase, toast]
  );

  const dismiss = useCallback(() => {
    activeRef.current = null;
    setActive(null);
  }, []);

  const reward = active ? REWARDS[active] : null;

  return (
    <RewardContext.Provider value={claim}>
      {children}

      {/* Confetti is the one thing here that can't degrade gracefully — a burst
          of static dots helps nobody, so reduced-motion users get the card. */}
      <AnimatePresence>{active && !reduced && <Confetti />}</AnimatePresence>

      <Dialog open={!!reward} onOpenChange={(o) => !o && dismiss()}>
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden p-0 text-center sm:max-w-xs"
        >
          {/* Warm wash behind the emoji so the card feels lit, not flat. */}
          <div className="relative px-6 pb-6 pt-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-primary/20 blur-3xl"
            />

            <div className="relative flex justify-center">
              {/* Ring pulse, timed to land under the emoji's bounce. */}
              <motion.span
                aria-hidden
                className="absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/40"
                initial={{ scale: 0.4, opacity: 0.7 }}
                animate={{ scale: 2.4, opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
              />
              <motion.span
                className="block text-6xl leading-none"
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 12,
                  delay: 0.05,
                }}
              >
                {reward?.emoji}
              </motion.span>
            </div>

            <DialogTitle className="mt-5 text-xl font-bold">
              {reward?.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-balance">
              {reward?.line}
            </DialogDescription>

            <Button onClick={dismiss} className="mt-6 h-10 w-full">
              {reward?.cta}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RewardContext.Provider>
  );
}

/**
 * Fire-and-forget milestone unlock. Safe to call on every save — already-earned
 * keys short-circuit on a local mirror, and the server is the final judge.
 */
export function useReward() {
  const claim = useContext(RewardContext);
  if (!claim) throw new Error("useReward must be used inside <RewardProvider>");
  return claim;
}
