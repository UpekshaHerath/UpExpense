"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryTotal,
  DailyTotal,
  Expense,
  MonthlyTotal,
} from "@/lib/types";
import { formatMoney, MONTH_NAMES, todayISO } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportSkeleton } from "@/components/skeletons";
import { EmptyState as EmptyStateBox } from "@/components/empty-state";

type Tab = "month" | "year";

// Single-series magnitude hue (labels + tooltips carry exact values).
const BAR_HUE = "var(--primary)";

export default function ReportsPage() {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>("month");
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [year, setYear] = useState(Number(today.slice(0, 4)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Reports</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filter row — one row above the charts */}
      {tab === "month" ? (
        <Input
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="w-fit dark:[color-scheme:dark]"
          aria-label="Report month"
        />
      ) : (
        <Select
          value={String(year)}
          onValueChange={(v) => setYear(Number(v))}
        >
          <SelectTrigger className="w-28" aria-label="Report year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from(
              { length: 6 },
              (_, i) => Number(today.slice(0, 4)) - i
            ).map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Keyed by period: changing the filter remounts with fresh state. */}
      {tab === "month" ? (
        <MonthReport key={month} month={month} />
      ) : (
        <YearReport key={year} year={year} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Month report                                                        */
/* ------------------------------------------------------------------ */

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

function MonthReport({ month }: { month: string }) {
  const supabase = createClient();
  const [cats, setCats] = useState<CategoryTotal[]>([]);
  const [days, setDays] = useState<DailyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  // Keyed by month at the call site — runs once per period.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { from, to } = monthRange(month);
      const [catRes, dayRes] = await Promise.all([
        supabase.rpc("category_totals", { p_from: from, p_to: to }),
        supabase.rpc("daily_totals", { p_from: from, p_to: to }),
      ]);
      if (ignore) return;
      setCats(catRes.data ?? []);
      setDays(dayRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const total = cats.reduce((s, c) => s + Number(c.total), 0);
  const txCount = cats.reduce((s, c) => s + Number(c.tx_count), 0);
  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();

  if (loading) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: `${MONTH_NAMES[mm - 1]} total`, value: formatMoney(total) },
          { label: "Expenses", value: String(txCount) },
          {
            label: "Daily average",
            value: formatMoney(total / daysInMonth),
          },
        ]}
      />

      {total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              By category
            </h2>
            <CategoryBars cats={cats} total={total} month={month} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Daily spending
            </h2>
            <DailyColumns days={days} month={month} daysInMonth={daysInMonth} />
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Year report                                                         */
/* ------------------------------------------------------------------ */

function YearReport({ year }: { year: number }) {
  const supabase = createClient();
  const [cats, setCats] = useState<CategoryTotal[]>([]);
  const [months, setMonths] = useState<MonthlyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  // Keyed by year at the call site — runs once per period.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const [catRes, monRes] = await Promise.all([
        supabase.rpc("category_totals", {
          p_from: `${year}-01-01`,
          p_to: `${year}-12-31`,
        }),
        supabase.rpc("monthly_totals", { p_year: year }),
      ]);
      if (ignore) return;
      setCats(catRes.data ?? []);
      setMonths(monRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const total = cats.reduce((s, c) => s + Number(c.total), 0);
  const txCount = cats.reduce((s, c) => s + Number(c.tx_count), 0);
  const topMonth =
    months.length > 0
      ? months.reduce((a, b) => (Number(b.total) > Number(a.total) ? b : a))
      : null;

  if (loading) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <StatTiles
        tiles={[
          { label: `${year} total`, value: formatMoney(total) },
          { label: "Expenses", value: String(txCount) },
          {
            label: "Highest month",
            value: topMonth
              ? MONTH_NAMES[topMonth.month - 1].slice(0, 3)
              : "—",
          },
        ]}
      />

      {total === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Month by month
            </h2>
            <MonthColumns months={months} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              By category
            </h2>
            <CategoryBars cats={cats} total={total} year={year} />
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function StatTiles({
  tiles,
}: {
  tiles: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((t) => (
        <Card key={t.label} className="py-0">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-1 truncate text-lg font-bold tabular-nums">
              {t.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <EmptyStateBox
      icon="📭"
      title="No expenses in this period"
      hint="Entries you add on the day view will show up here."
    />
  );
}

/**
 * Horizontal labeled bar rows. Identity = icon + name text (never color
 * alone); exact values printed on every row — doubles as the table view.
 */
function CategoryBars({
  cats,
  total,
  month,
  year,
}: {
  cats: CategoryTotal[];
  total: number;
  month?: string;
  year?: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const max = Math.max(...cats.map((c) => Number(c.total)));

  return (
    <ul className="space-y-1">
      {cats.map((c) => {
        const value = Number(c.total);
        const open = openId === c.category_id;
        return (
          <li key={c.category_id}>
            <button
              onClick={() => setOpenId(open ? null : c.category_id)}
              title={`${c.name}: ${formatMoney(value)} · ${c.tx_count} expense(s)`}
              className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/50"
            >
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1 truncate font-medium">
                  {open ? (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  {c.icon} {c.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {((value / total) * 100).toFixed(0)}%
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(value)}
                </span>
              </span>
              <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(value / max) * 100}%`,
                    backgroundColor: c.color,
                  }}
                />
              </span>
            </button>
            {open && (
              <CategoryDrilldown
                categoryId={c.category_id}
                month={month}
                year={year}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** PRD RPT-3: tap a category → its expenses in the period. */
function CategoryDrilldown({
  categoryId,
  month,
  year,
}: {
  categoryId: string;
  month?: string;
  year?: number;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Expense[] | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const from = month ? monthRange(month).from : `${year}-01-01`;
      const to = month ? monthRange(month).to : `${year}-12-31`;
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("category_id", categoryId)
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false });
      if (!ignore) setItems(data ?? []);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, month, year]);

  if (!items) {
    return (
      <div className="mb-2 ml-3 space-y-1 py-1">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <Card className="mb-2 ml-3 py-0">
      <ul className="divide-y text-sm">
        {items.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">
              {e.expense_date}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs">
              {e.note ?? ""}
            </span>
            <span className="font-medium tabular-nums">
              {formatMoney(Number(e.amount))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Daily spending columns for one month. Single hue; tooltip per column. */
function DailyColumns({
  days,
  month,
  daysInMonth,
}: {
  days: DailyTotal[];
  month: string;
  daysInMonth: number;
}) {
  const byDay = new Map(days.map((d) => [d.day, Number(d.total)]));
  const all = Array.from({ length: daysInMonth }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, iso, total: byDay.get(iso) ?? 0 };
  });
  const max = Math.max(...all.map((d) => d.total), 1);

  return (
    <div>
      <div className="flex h-32 items-end gap-[2px]">
        {all.map((d) => (
          <div
            key={d.iso}
            title={`${d.iso}: ${formatMoney(d.total)}`}
            className="flex-1 rounded-t"
            style={{
              height:
                d.total > 0 ? `${Math.max((d.total / max) * 100, 3)}%` : "2px",
              backgroundColor: d.total > 0 ? BAR_HUE : "var(--muted)",
              opacity: d.total > 0 ? 1 : 0.6,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>1</span>
        <span>{Math.ceil(daysInMonth / 2)}</span>
        <span>{daysInMonth}</span>
      </div>
    </div>
  );
}

/** Monthly totals for one year. Direct label on the peak month only. */
function MonthColumns({ months }: { months: MonthlyTotal[] }) {
  const byMonth = new Map(months.map((m) => [m.month, Number(m.total)]));
  const all = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total: byMonth.get(i + 1) ?? 0,
  }));
  const max = Math.max(...all.map((m) => m.total), 1);

  return (
    <div>
      <div className="flex h-36 items-end gap-1">
        {all.map((m) => (
          <div
            key={m.month}
            className="flex flex-1 flex-col items-center gap-1"
          >
            {m.total === max && m.total > 0 && (
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {formatMoney(m.total)}
              </span>
            )}
            <div
              title={`${MONTH_NAMES[m.month - 1]}: ${formatMoney(m.total)}`}
              className="w-full rounded-t"
              style={{
                height:
                  m.total > 0
                    ? `${Math.max((m.total / max) * 110, 4)}px`
                    : "2px",
                backgroundColor: m.total > 0 ? BAR_HUE : "var(--muted)",
                opacity: m.total > 0 ? 1 : 0.6,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {MONTH_NAMES.map((n) => (
          <span
            key={n}
            className="flex-1 text-center text-[10px] text-muted-foreground"
          >
            {n[0]}
          </span>
        ))}
      </div>
    </div>
  );
}
