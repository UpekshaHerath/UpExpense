import { cn } from "@/lib/utils";

/**
 * Full-screen branded loading animation, built from the upExpense mark.
 *
 * The three ascending bars pulse up in a staggered "rising equalizer" wave,
 * the up-arrow floats above them, and an emerald arc sweeps around the tile.
 * Pure CSS/SVG (keyframes live in globals.css) so it renders server-side and
 * before hydration — safe to use both as a route `loading.tsx` and as a
 * client-side overlay. Colors ride the theme tokens, so it adapts to
 * light/dark and the user's accent. Honors `prefers-reduced-motion`.
 */
export function BrandLoader({
  className,
  label = "Loading…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 grid place-items-center bg-background",
        className
      )}
    >
      <div className="bl-enter flex flex-col items-center gap-7">
        <div className="relative grid size-28 place-items-center">
          {/* Sweeping emerald arc around the mark */}
          <svg
            viewBox="0 0 100 100"
            className="bl-ring absolute inset-0 size-full text-primary"
            fill="none"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="70 220"
            />
          </svg>

          {/* The mark: emerald tile + animated bars + floating arrow */}
          <svg
            viewBox="0 0 64 64"
            role="img"
            aria-label="upExpense"
            className="size-16 drop-shadow-sm"
          >
            <rect width="64" height="64" rx="14" className="fill-primary" />
            <g className="fill-primary-foreground">
              <rect
                className="bl-bar bl-bar-1"
                x="13"
                y="36"
                width="8"
                height="14"
                rx="3"
              />
              <rect
                className="bl-bar bl-bar-2"
                x="25"
                y="28"
                width="8"
                height="22"
                rx="3"
              />
              <rect
                className="bl-bar bl-bar-3"
                x="37"
                y="24"
                width="8"
                height="26"
                rx="3"
              />
              <path className="bl-arrow" d="M41 8 L51.5 21.5 H30.5 Z" />
            </g>
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-bold tracking-tight text-foreground">
            <span className="text-primary">up</span>Expense
          </span>
          <span className="bl-word text-sm text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}
