"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Curated, expense-relevant icons — grouped roughly by theme.
const ICONS = [
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

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);

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
          {ICONS.map((icon) => (
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
