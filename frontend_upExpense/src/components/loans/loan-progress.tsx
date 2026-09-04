"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LoanSummary } from "@/lib/types";
import { loanProgress } from "@/lib/loans";
import { cn } from "@/lib/utils";

/**
 * The one visual every loan surface shares: how much of the principal is gone.
 * Tinted with the loan's own colour so the bar, the chip and the expense row
 * all read as the same thing.
 */
export function LoanProgress({
  loan,
  className,
  height = "h-2",
}: {
  loan: LoanSummary;
  className?: string;
  /** Tailwind height class — thinner inside dense lists. */
  height?: string;
}) {
  const reduced = useReducedMotion();
  const pct = loanProgress(loan);

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
      aria-label={`${loan.name} repaid`}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: loan.color }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
      />
    </div>
  );
}
