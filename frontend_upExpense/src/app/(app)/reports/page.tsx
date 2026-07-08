"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryTotal,
  DailyTotal,
  Expense,
  MonthlyTotal,
} from "@/lib/types";
import {
  formatDayHeading,
  formatMoney,
  MONTH_NAMES,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MonthPicker, YearPicker } from "@/components/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportSkeleton } from "@/components/skeletons";
import { EmptyState as EmptyStateBox } from "@/components/empty-state";

type Tab = "month" | "year";

// Single-series magnitude hue (labels + tooltips carry exact values).
const chartConfig = {
  total: { label: "Spent", color: "var(--primary)" },
} satisfies ChartConfig;

/** Tooltip row: single series, so name is fixed — value in money format. */
function moneyTooltipRow(value: unknown) {
  return (
    <div className="flex w-full min-w-28 items-center justify-between gap-4 leading-none">
      <span className="text-muted-foreground">
        {chartConfig.total.label}
      </span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {formatMoney(Number(value))}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  const today = todayISO();
  const [tab, setTab] = useState<Tab>("month");
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [year, setYear] = useState(Number(today.slice(0, 4)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Stats</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Filter row — one row above the charts */}
      {tab === "month" ? (
        <MonthPicker
          value={month}
          max={today.slice(0, 7)}
          onChange={setMonth}
          ariaLabel="Stats month"
          className="h-9"
        />
      ) : (
        <YearPicker
          value={year}
          max={Number(today.slice(0, 4))}
          onChange={setYear}
          ariaLabel="Stats year"
          className="h-9"
        />
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

          <Card className="gap-0 py-0">
            <CardHeader className="border-b !py-4">
              <CardTitle>Daily spending</CardTitle>
              <CardDescription>
                {MONTH_NAMES[mm - 1]} {yy}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 py-4 sm:px-6">
              <DailyColumns
                days={days}
                month={month}
                daysInMonth={daysInMonth}
              />
            </CardContent>
          </Card>
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
          <Card className="gap-0 py-0">
            <CardHeader className="border-b !py-4">
              <CardTitle>Month by month</CardTitle>
              <CardDescription>{year}</CardDescription>
            </CardHeader>
            <CardContent className="px-2 py-4 sm:px-6">
              <MonthColumns months={months} />
            </CardContent>
          </Card>

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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {tiles.map((t, i) => (
        <Card
          key={t.label}
          // Mobile: period total gets its own full-width row so large
          // amounts stay readable; the other two share the second row.
          className={cn("py-0", i === 0 && "col-span-2 sm:col-span-1")}
        >
          <CardContent className="p-3 text-center sm:p-4">
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              {t.label}
            </p>
            <p
              className={cn(
                "mt-1 truncate font-bold tabular-nums sm:text-lg",
                i === 0 ? "text-xl" : "text-base"
              )}
            >
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
      <Card className="mb-2 ml-3 py-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      </Card>
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

/** Daily spending bars for one month. Single hue; tooltip per bar. */
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
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { iso, total: byDay.get(iso) ?? 0 };
  });

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-48 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="iso"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(iso: string) => String(Number(iso.slice(-2)))}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) =>
                formatDayHeading(payload[0].payload.iso)
              }
              formatter={moneyTooltipRow}
            />
          }
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/** Monthly totals for one year. Single hue; tooltip per bar. */
function MonthColumns({ months }: { months: MonthlyTotal[] }) {
  const byMonth = new Map(months.map((m) => [m.month, Number(m.total)]));
  const data = Array.from({ length: 12 }, (_, i) => ({
    name: MONTH_NAMES[i],
    total: byMonth.get(i + 1) ?? 0,
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(name: string) => name.slice(0, 3)}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={moneyTooltipRow} />}
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
