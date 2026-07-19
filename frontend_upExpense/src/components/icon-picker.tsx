"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CategoryKind } from "@/lib/types";
import { cn } from "@/lib/utils";

// Curated, expense-relevant icons — grouped roughly by theme.
const EXPENSE_ICONS = [
  // Transport & vehicle
  "⛽", "🚗", "🏍️", "🔧", "🛞", "🚌", "🚕", "✈️",
  // Food & drink
  "🍽️", "🍔", "🥗", "☕", "🍺", "🎂", "🛒", "🍎",
  // Health & fitness
  "🏋️", "💊", "🩺", "🦷", "💉", "🧘", "⚽", "🏃",
  // Home & utilities
  "🏠", "💡", "💧", "🌐", "📱", "🛠️", "🧹", "🛋️",
  // Lifestyle
  "🌄", "🏖️", "🎬", "🎮", "🎵", "👕", "👟", "💇",
  // Money & misc
  "🎁", "📚", "🎓", "🐕", "💳", "🧾", "💰", "📦",
];

// Curated, income-relevant icons — grouped roughly by source.
const INCOME_ICONS = [
  // Work & business
  "💼", "🏢", "🧑‍💻", "🛠️", "📊", "🤝", "🧾", "🏦",
  // Investments & returns
  "📈", "💹", "🪙", "🏘️", "🏠", "💵", "🧧", "🎯",
  // Rewards & extras
  "🎁", "🏆", "🎉", "💸", "🪃", "🔄", "🧮", "⭐",
  // Money & misc
  "💰", "💳", "🤑", "🐷", "💎", "🍀", "📥", "➕",
];

export function IconPicker({
  value,
  onChange,
  kind = "expense",
}: {
  value: string;
  onChange: (icon: string) => void;
  kind?: CategoryKind;
}) {
  const [open, setOpen] = useState(false);
  const icons = kind === "income" ? INCOME_ICONS : EXPENSE_ICONS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Choose icon"
          className="text-lg"
        >
          {value || "🏷️"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {icons.map((icon) => (
            <Button
              key={icon}
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
              aria-label={`Icon ${icon}`}
              className={cn(
                "text-base",
                value === icon && "bg-primary/10 ring-1 ring-primary"
              )}
            >
              {icon}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
