"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, parseISODate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Popover day picker. `value`/`max` are ISO dates (YYYY-MM-DD). */
export function DatePicker({
  value,
  onChange,
  max,
  ariaLabel = "Pick a date",
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  max?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 text-sm font-normal", className)}
          aria-label={ariaLabel}
        >
          <CalendarIcon className="text-muted-foreground" />
          {parseISODate(value).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="single"
          selected={parseISODate(value)}
          defaultMonth={parseISODate(value)}
          disabled={max ? { after: parseISODate(max) } : undefined}
          onSelect={(d) => {
            if (!d) return;
            setOpen(false);
            onChange(toISODate(d));
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Popover month picker (react-day-picker has no month mode), styled to
 * match DatePicker. `value`/`max` are YYYY-MM.
 */
export function MonthPicker({
  value,
  onChange,
  max,
  ariaLabel = "Pick a month",
  className,
}: {
  value: string;
  onChange: (yyyyMm: string) => void;
  max?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));

  const label = `${MONTH_NAMES[Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}`;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(Number(value.slice(0, 4)));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 text-sm font-normal", className)}
          aria-label={ariaLabel}
        >
          <CalendarIcon className="text-muted-foreground" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setYear((y) => y - 1)}
            aria-label="Previous year"
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setYear((y) => y + 1)}
            disabled={max ? year >= Number(max.slice(0, 4)) : false}
            aria-label="Next year"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_NAMES.map((name, i) => {
            const yyyyMm = `${year}-${String(i + 1).padStart(2, "0")}`;
            return (
              <Button
                key={name}
                variant={yyyyMm === value ? "default" : "ghost"}
                size="sm"
                disabled={max ? yyyyMm > max : false}
                onClick={() => {
                  setOpen(false);
                  onChange(yyyyMm);
                }}
                className="font-normal"
              >
                {name.slice(0, 3)}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const YEARS_PER_PAGE = 12;

/** Popover year picker, styled to match DatePicker/MonthPicker. */
export function YearPicker({
  value,
  onChange,
  max,
  ariaLabel = "Pick a year",
  className,
}: {
  value: number;
  onChange: (year: number) => void;
  max?: number;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // First year of the visible 12-year page.
  const [start, setStart] = useState(
    Math.floor(value / YEARS_PER_PAGE) * YEARS_PER_PAGE
  );
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => start + i);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setStart(Math.floor(value / YEARS_PER_PAGE) * YEARS_PER_PAGE);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 text-sm font-normal", className)}
          aria-label={ariaLabel}
        >
          <CalendarIcon className="text-muted-foreground" />
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="mb-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setStart((s) => s - YEARS_PER_PAGE)}
            aria-label="Previous years"
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium">
            {years[0]} – {years[years.length - 1]}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setStart((s) => s + YEARS_PER_PAGE)}
            disabled={max !== undefined && start + YEARS_PER_PAGE > max}
            aria-label="Next years"
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {years.map((y) => (
            <Button
              key={y}
              variant={y === value ? "default" : "ghost"}
              size="sm"
              disabled={max !== undefined && y > max}
              onClick={() => {
                setOpen(false);
                onChange(y);
              }}
              className="font-normal tabular-nums"
            >
              {y}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
