/** Per-page loading layouts composed from the shadcn Skeleton primitive. */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export { Skeleton };

export function DaySkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading day view">
      {/* Day total card */}
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-40" />
        </CardContent>
      </Card>

      {/* Entry form */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-full" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-14" />
            <Skeleton className="h-9 w-14" />
          </div>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Expense list */}
      <ListSkeleton rows={3} />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
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
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading report">
      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="py-0">
            <CardContent className="flex flex-col items-center gap-2 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category bars */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5 px-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex h-32 items-end gap-1">
          {[45, 70, 30, 90, 55, 65, 40, 80, 25, 60, 75, 35].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
