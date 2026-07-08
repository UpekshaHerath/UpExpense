import { cn } from "@/lib/utils";

/**
 * upExpense mark: three ascending expense bars, the tallest one turning
 * into an up-arrow. Colors ride on the theme tokens (primary tile,
 * primary-foreground bars) so the mark adapts to light/dark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="upExpense logo"
      className={cn("size-8", className)}
    >
      <rect
        width="64"
        height="64"
        rx="14"
        className="fill-primary"
      />
      <g className="fill-primary-foreground">
        <rect x="13" y="36" width="8" height="14" rx="3" />
        <rect x="25" y="28" width="8" height="22" rx="3" />
        <rect x="37" y="24" width="8" height="26" rx="3" />
        <path d="M41 8 L51.5 21.5 H30.5 Z" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  textClassName,
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={markClassName} />
      <span
        className={cn(
          "text-lg font-bold tracking-tight text-foreground",
          textClassName
        )}
      >
        <span className="text-primary">up</span>Expense
      </span>
    </span>
  );
}
