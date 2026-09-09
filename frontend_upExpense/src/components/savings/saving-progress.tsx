"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { SavingSummary } from "@/lib/types";
import { hasTarget, savingProgress } from "@/lib/savings";
import { cn } from "@/lib/utils";

/**
 * How full the pot is. Tinted with the pot's own colour so the bar, the chip
 * and the expense row all read as the same thing.
 *
 * An open-ended pot has no finish line, so it gets a faint striped track
 * rather than a bar stuck at 0% — "no target" and "no progress" must not look
 * the same.
 */
export function SavingProgress({
  pot,
  className,
  height = "h-2",
}: {
  pot: SavingSummary;
  className?: string;
  /** Tailwind height class — thinner inside dense lists. */
  height?: string;
}) {
  const reduced = useReducedMotion();
  const targeted = hasTarget(pot);
  const pct = savingProgress(pot);

  if (!targeted) {
    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          height,
          className
        )}
        aria-hidden
      >
        <div
          className="h-full w-full opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(135deg, ${pot.color} 0 6px, transparent 6px 12px)`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        height,
        className
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pot.name} saved`}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: pot.color }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      />
    </div>
  );
}
