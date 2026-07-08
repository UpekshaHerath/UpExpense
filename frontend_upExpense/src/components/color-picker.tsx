"use client";

import { useRef, useState } from "react";
import { Check, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// First 10 = the CVD-validated categorical palette used for seeded
// categories; the rest are extra usable hues.
const SWATCHES = [
  "#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7",
  "#e34948", "#e87ba4", "#eb6834", "#1c5cab", "#b45309",
  "#0891b2", "#16a34a", "#7c3aed", "#db2777", "#d97706",
  "#dc2626", "#0d9488", "#a855f7", "#64748b", "#78716c",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);
  const isCustom = !SWATCHES.includes(value.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Choose color (current ${value})`}
        >
          <span
            className="size-4.5 rounded-full border border-black/10 dark:border-white/20"
            style={{ backgroundColor: value }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3">
        <div className="grid grid-cols-5 gap-1.5">
          {SWATCHES.map((color) => {
            const selected = value.toLowerCase() === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                aria-label={`Color ${color}`}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover"
                )}
                style={{ backgroundColor: color }}
              >
                {selected && (
                  <Check className="size-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            onClick={() => customRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border",
                isCustom && "ring-2 ring-ring ring-offset-1 ring-offset-popover"
              )}
              style={
                isCustom
                  ? { backgroundColor: value }
                  : {
                      background:
                        "conic-gradient(#e34948, #eda100, #008300, #2a78d6, #7c3aed, #e34948)",
                    }
              }
            >
              {isCustom && (
                <Pipette className="size-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
              )}
            </span>
            Custom color…
            <span className="ml-auto font-mono text-xs uppercase">
              {value}
            </span>
          </button>
          {/* Hidden native input drives the OS color dialog */}
          <input
            ref={customRef}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
