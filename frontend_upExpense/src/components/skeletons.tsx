/** Per-page loading layouts composed from the shadcn Skeleton primitive. */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { Skeleton };

/**
 * Mirrors the day view while it loads: Earned / Spent / Net summary strip,
 * the Expense / Income switch, the entry form (title, amount, category chips,
 * note + payment row, submit), then the entry list.
 */
export function DaySkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading day view">
      {/* Day summary — three divided cells */}
      <Card className="py-0">
        <CardContent className="grid grid-cols-3 divide-x p-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 px-2 py-3"
            >
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Expense / Income switch */}
      <Skeleton className="h-8 w-full rounded-lg" />

      {/* Entry form: title, amount field, category chips, note row, submit */}
      <Card>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="flex flex-wrap gap-1.5">
            {[80, 96, 64, 112, 80, 96].map((w, i) => (
              <Skeleton
                key={i}
                className="h-7 rounded-full"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
            <Skeleton className="h-9 w-14 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Entry list — icon, name + note, amount, edit/delete */}
      <ListSkeleton rows={3} actions={2} />
    </div>
  );
}

/** Generic divided-row list. `actions` adds trailing icon-button placeholders. */
export function ListSkeleton({
  rows = 4,
  actions = 0,
}: {
  rows?: number;
  actions?: number;
}) {
  return (
    <Card className="py-0" aria-busy aria-label="Loading list">
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-4 w-20" />
            {actions > 0 && (
              <div className="flex gap-0.5">
                {Array.from({ length: actions }).map((_, a) => (
                  <Skeleton key={a} className="size-7 rounded-lg" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ReportSkeleton({
  chartHeight = "h-48",
  groups = 16,
}: {
  chartHeight?: string;
  groups?: number;
}) {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading report">
      {/* Balance bar + Income / Expenses tiles */}
      <div className="space-y-2 sm:space-y-3">
        <Card className="py-0">
          <CardContent className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-24" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="py-0">
              <CardContent className="flex flex-col items-center gap-1.5 p-3 sm:p-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Flow chart card */}
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-start justify-between gap-2 border-b !py-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-12" />
          </div>
        </CardHeader>
        <CardContent className="px-2 py-4 sm:px-6">
          <div className={cn("flex w-full flex-col", chartHeight)}>
            <div className="flex flex-1 items-end gap-1.5">
              {Array.from({ length: groups }).map((_, i) => (
                <div key={i} className="flex h-full flex-1 items-end gap-px">
                  <Skeleton
                    className="flex-1 rounded-b-none"
                    style={{ height: `${BAR_HEIGHTS[i % BAR_HEIGHTS.length]}%` }}
                  />
                  <Skeleton
                    className="flex-1 rounded-b-none"
                    style={{
                      height: `${BAR_HEIGHTS[(i + 5) % BAR_HEIGHTS.length]}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            {/* x axis ticks */}
            <div className="mt-2 flex items-center justify-between">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-5" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By category: heading + Expense/Income switch, then bar rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <ul className="space-y-1">
          {[44, 36, 30, 24, 20].map((w, i) => (
            <li key={i} className="px-2 py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Skeleton className="h-4" style={{ width: `${w * 4}px` }} />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="mt-1 h-2 w-full rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Deterministic bar heights — same skeleton on server and client. */
const BAR_HEIGHTS = [45, 70, 30, 90, 55, 65, 40, 80, 25, 60, 75, 35];
