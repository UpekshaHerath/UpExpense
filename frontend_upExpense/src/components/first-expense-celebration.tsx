"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Mirrors profiles.first_expense_celebrated_at so a returning user costs no
 * round-trip on every save. The database column stays the source of truth —
 * clearing site data must not replay the celebration on another device.
 */
const STORAGE_KEY = "upexpense.firstexpense.v1";

/**
 * Decides whether a just-saved expense is the user's first, and remembers the
 * answer. Call `maybeCelebrate()` after an expense *insert* only — edits and
 * income saves are not the moment.
 */
export function useFirstExpenseCelebration() {
  const supabase = createClient();
  const [celebrating, setCelebrating] = useState(false);

  const maybeCelebrate = useCallback(async () => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "done") return;
    } catch {
      // Storage blocked — fall through to the database check.
    }

    // RLS scopes this to the caller's own row.
    const { data, error } = await supabase
      .from("profiles")
      .select("first_expense_celebrated_at")
      .maybeSingle();

    // No row, or the migration hasn't been applied yet: stay out of the way
    // rather than firing the popup on every single save.
    if (error || !data) return;

    if (data.first_expense_celebrated_at) {
      try {
        localStorage.setItem(STORAGE_KEY, "done");
      } catch {}
      return;
    }

    setCelebrating(true);

    // Burn the one-shot immediately, not on dismiss — a reload mid-confetti
    // must not earn a second party.
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {}
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ first_expense_celebrated_at: new Date().toISOString() })
      .eq("id", user.id);
  }, [supabase]);

  return {
    celebrating,
    maybeCelebrate,
    dismiss: useCallback(() => setCelebrating(false), []),
  };
}

const CONFETTI_COLORS = [
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

type Piece = {
  /** Horizontal travel at the top of the arc, in px. */
  driftX: number;
  /** How high the piece pops before gravity wins, in px (negative = up). */
  riseY: number;
  /** How far below the origin it lands, in px. */
  fallY: number;
  spin: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  round: boolean;
  color: string;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => {
    // Fan the burst sideways and up: straight-down pieces read as a leak.
    const angle = (Math.random() - 0.5) * Math.PI * 1.1;
    const power = 120 + Math.random() * 170;
    const round = Math.random() < 0.45;
    const width = round ? 7 + Math.random() * 5 : 5 + Math.random() * 4;
    return {
      driftX: Math.sin(angle) * power,
      riseY: -Math.abs(Math.cos(angle)) * power * 0.9 - 40,
      fallY: 320 + Math.random() * 260,
      spin: (Math.random() - 0.5) * 900,
      delay: Math.random() * 0.18,
      duration: 1.5 + Math.random() * 0.9,
      width,
      height: round ? width : width * 2.2,
      round,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    };
  });
}

/** Full-screen burst, purely decorative — never intercepts taps. */
function Confetti() {
  const pieces = useMemo(() => makePieces(44), []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      <div className="absolute left-1/2 top-[38%]">
        {pieces.map((p, i) => (
          <motion.span
            key={i}
            className={p.round ? "absolute rounded-full" : "absolute rounded-sm"}
            style={{
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={{
              x: [0, p.driftX * 0.7, p.driftX],
              y: [0, p.riseY, p.fallY],
              rotate: [0, p.spin * 0.4, p.spin],
              opacity: [0, 1, 0],
              scale: 1,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              times: [0, 0.32, 1],
              ease: ["easeOut", "easeIn"],
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One-time reward for logging a first expense: confetti, a bouncing emoji and
 * a pat on the back. Driven by `useFirstExpenseCelebration`.
 */
export function FirstExpenseCelebration({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Confetti is the one thing here that can't degrade gracefully — a burst of
  // static dots helps nobody, so reduced-motion users get the card alone.
  const reduced = useReducedMotion();

  return (
    <>
      <AnimatePresence>{open && !reduced && <Confetti />}</AnimatePresence>

      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
                🥳
              </motion.span>
            </div>

            <DialogTitle className="mt-5 text-xl font-bold">
              Look at you, adulting!
            </DialogTitle>
            <DialogDescription className="mt-2 text-balance">
              One expense down, a lifetime of receipts to go. Future you is
              already saying thanks.
            </DialogDescription>

            <Button onClick={onClose} className="mt-6 h-10 w-full">
              Let&apos;s go
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
