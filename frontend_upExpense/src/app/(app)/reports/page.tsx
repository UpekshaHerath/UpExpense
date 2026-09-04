"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import type {
  EntryKind,
  CategoryTotal,
  DailyTotal,
  Expense,
  Income,
  MonthlyTotal,
} from "@/lib/types";
import {
  formatDayHeading,
  formatMoney,
  formatSignedMoney,
  MONTH_NAMES,
  netToneClass,
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

// Expense keeps the themeable brand primary; income gets a fixed money-green
// so the two series read the same in every theme (dataviz: distinct hues,
// labels + values on every tooltip/row so colour is never the only signal).
const INCOME_COLOR = "oklch(0.62 0.17 152)";
const flowConfig = {
  expense: { label: "Spent", color: "var(--primary)" },
  income: { label: "Income", color: INCOME_COLOR },
} satisfies ChartConfig;

/* Page-load choreography: sections rise in one after another. */
const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

/** Tooltip row for the flow chart: coloured dot + series label + money. */
function flowTooltipRow(value: unknown, name: unknown) {
  const key = String(name) as keyof typeof flowConfig;
  return (
    <div className="flex w-full min-w-32 items-center justify-between gap-4 leading-none">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ background: `var(--color-${key})` }}
        />
        {flowConfig[key]?.label ?? key}
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
      <div data-tour="stats-body">
        {tab === "month" ? (
          <MonthReport key={month} month={month} />
        ) : (
          <YearReport key={year} year={year} />
        )}
      </div>
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
  const [expCats, setExpCats] = useState<CategoryTotal[]>([]);
  const [incCats, setIncCats] = useState<CategoryTotal[]>([]);
  const [expDays, setExpDays] = useState<DailyTotal[]>([]);
  const [incDays, setIncDays] = useState<DailyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  // Keyed by month at the call site — runs once per period.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { from, to } = monthRange(month);
      const [ec, ic, ed, id] = await Promise.all([
        supabase.rpc("category_totals", { p_from: from, p_to: to }),
        supabase.rpc("income_category_totals", { p_from: from, p_to: to }),
        supabase.rpc("daily_totals", { p_from: from, p_to: to }),
        supabase.rpc("income_daily_totals", { p_from: from, p_to: to }),
      ]);
      if (ignore) return;
      setExpCats(ec.data ?? []);
      setIncCats(ic.data ?? []);
      setExpDays(ed.data ?? []);
      setIncDays(id.data ?? []);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const expTotal = expCats.reduce((s, c) => s + Number(c.total), 0);
  const incTotal = incCats.reduce((s, c) => s + Number(c.total), 0);
  const net = incTotal - expTotal;
  const [yy, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();

  if (loading) {
    return <ReportSkeleton />;
  }

  const flow = dailyFlow(expDays, incDays, month, daysInMonth);

  return (
    <motion.div
      className="space-y-6"
      variants={staggerParent}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <BalanceTiles
          periodLabel={`${MONTH_NAMES[mm - 1]} ${yy}`}
          income={incTotal}
          expense={expTotal}
          net={net}
        />
      </motion.div>

      {expTotal === 0 && incTotal === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState />
        </motion.div>
      ) : (
        <>
          <motion.div variants={fadeUp}>
            <FlowCard
              title="Money flow"
              subtitle={`${MONTH_NAMES[mm - 1]} ${yy}`}
              data={flow}
              xKey="iso"
              xTickFormatter={(iso: string) => String(Number(iso.slice(-2)))}
              labelFormatter={(iso: string) => formatDayHeading(iso)}
              height="h-48"
              minTickGap={24}
            />
          </motion.div>

          <motion.section variants={fadeUp}>
            <CategoryBreakdown
              expCats={expCats}
              incCats={incCats}
              month={month}
            />
          </motion.section>
        </>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Year report                                                         */
/* ------------------------------------------------------------------ */

function YearReport({ year }: { year: number }) {
  const supabase = createClient();
  const [expCats, setExpCats] = useState<CategoryTotal[]>([]);
  const [incCats, setIncCats] = useState<CategoryTotal[]>([]);
  const [expMonths, setExpMonths] = useState<MonthlyTotal[]>([]);
  const [incMonths, setIncMonths] = useState<MonthlyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  // Keyed by year at the call site — runs once per period.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const range = { p_from: `${year}-01-01`, p_to: `${year}-12-31` };
      const [ec, ic, em, im] = await Promise.all([
        supabase.rpc("category_totals", range),
        supabase.rpc("income_category_totals", range),
        supabase.rpc("monthly_totals", { p_year: year }),
        supabase.rpc("income_monthly_totals", { p_year: year }),
      ]);
      if (ignore) return;
      setExpCats(ec.data ?? []);
      setIncCats(ic.data ?? []);
      setExpMonths(em.data ?? []);
      setIncMonths(im.data ?? []);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const expTotal = expCats.reduce((s, c) => s + Number(c.total), 0);
  const incTotal = incCats.reduce((s, c) => s + Number(c.total), 0);
  const net = incTotal - expTotal;

  if (loading) {
    return <ReportSkeleton />;
  }

  const flow = monthlyFlow(expMonths, incMonths);

  return (
    <motion.div
      className="space-y-6"
      variants={staggerParent}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={fadeUp}>
        <BalanceTiles
          periodLabel={String(year)}
          income={incTotal}
          expense={expTotal}
          net={net}
        />
      </motion.div>

      {expTotal === 0 && incTotal === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState />
        </motion.div>
      ) : (
        <>
          <motion.div variants={fadeUp}>
            <FlowCard
              title="Month by month"
              subtitle={String(year)}
              data={flow}
              xKey="name"
              xTickFormatter={(name: string) => name.slice(0, 3)}
              labelFormatter={(name: string) => name}
              height="h-56"
            />
          </motion.div>

          <motion.section variants={fadeUp}>
            <CategoryBreakdown
              expCats={expCats}
              incCats={incCats}
              year={year}
            />
          </motion.section>
        </>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** Income / Expense / Net balance for a period. Net is the headline. */
function BalanceTiles({
  periodLabel,
  income,
  expense,
  net,
}: {
  periodLabel: string;
  income: number;
  expense: number;
  net: number;
}) {
  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Net balance — slim inline bar so it doesn't crowd the tiles. */}
      <Card className="py-0">
        <CardContent className="flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="shrink-0 text-[11px] text-muted-foreground sm:text-xs">
            {periodLabel} balance
          </p>
          <p
            className={cn(
              "min-w-0 text-right text-base font-bold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-lg",
              netToneClass(net)
            )}
          >
            {formatSignedMoney(net)}
          </p>
        </CardContent>
      </Card>

      {/* Income + Expenses — full width each on mobile for the widest numbers. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <MiniTile
          label="Income"
          value={formatMoney(income)}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <MiniTile label="Expenses" value={formatMoney(expense)} />
      </div>
    </div>
  );
}

function MiniTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-3 text-center sm:p-4">
        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 text-lg font-bold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-xl",
            tone
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <EmptyStateBox
      icon="📭"
      title="Nothing in this period"
      hint="Expenses and income you add on the day view will show up here."
    />
  );
}

/** Income-vs-expense grouped bars (daily for a month, monthly for a year). */
function FlowCard({
  title,
  subtitle,
  data,
  xKey,
  xTickFormatter,
  labelFormatter,
  height,
  minTickGap,
}: {
  title: string;
  subtitle: string;
  data: Record<string, string | number>[];
  xKey: string;
  xTickFormatter: (v: string) => string;
  labelFormatter: (v: string) => string;
  height: string;
  minTickGap?: number;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b !py-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
          <LegendDot color={INCOME_COLOR} label="Income" />
          <LegendDot color="var(--primary)" label="Spent" />
        </div>
      </CardHeader>
      <CardContent className="px-2 py-4 sm:px-6">
        <ChartContainer
          config={flowConfig}
          className={cn("aspect-auto w-full", height)}
        >
          <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={minTickGap}
              tickFormatter={xTickFormatter}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    labelFormatter(String(payload?.[0]?.payload?.[xKey]))
                  }
                  formatter={flowTooltipRow}
                />
              }
            />
            <Bar
              dataKey="income"
              fill="var(--color-income)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expense"
              fill="var(--color-expense)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-[2px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/** By-category section with an Expense / Income switch. */
function CategoryBreakdown({
  expCats,
  incCats,
  month,
  year,
}: {
  expCats: CategoryTotal[];
  incCats: CategoryTotal[];
  month?: string;
  year?: number;
}) {
  const [kind, setKind] = useState<EntryKind>("expense");
  const cats = kind === "expense" ? expCats : incCats;
  const total = cats.reduce((s, c) => s + Number(c.total), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          By {kind === "income" ? "source" : "category"}
        </h2>
        <Tabs value={kind} onValueChange={(v) => setKind(v as EntryKind)}>
          <TabsList className="h-8">
            <TabsTrigger value="expense" className="text-xs">
              Expense
            </TabsTrigger>
            <TabsTrigger value="income" className="text-xs">
              Income
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {total === 0 ? (
        <EmptyStateBox
          icon={kind === "income" ? "💰" : "🧾"}
          title={
            kind === "income"
              ? "No income in this period"
              : "No expenses in this period"
          }
        />
      ) : (
        <CategoryBars
          cats={cats}
          total={total}
          kind={kind}
          month={month}
          year={year}
        />
      )}
    </div>
  );
}

/**
 * Horizontal labeled bar rows. Identity = icon + name text (never color
 * alone); exact values printed on every row — doubles as the table view.
 */
function CategoryBars({
  cats,
  total,
  kind,
  month,
  year,
}: {
  cats: CategoryTotal[];
  total: number;
  kind: EntryKind;
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
              title={`${c.name}: ${formatMoney(value)} · ${c.tx_count} ent(y/ies)`}
              className="ripple w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/50"
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
                <motion.span
                  className="block h-full rounded-full"
                  style={{ backgroundColor: c.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(value / max) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  className="overflow-hidden"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <CategoryDrilldown
                    categoryId={c.category_id}
                    kind={kind}
                    month={month}
                    year={year}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

/** PRD RPT-3: tap a category → its entries in the period. */
function CategoryDrilldown({
  categoryId,
  kind,
  month,
  year,
}: {
  categoryId: string;
  kind: EntryKind;
  month?: string;
  year?: number;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<(Expense | Income)[] | null>(null);

  const table = kind === "income" ? "incomes" : "expenses";
  const dateCol = kind === "income" ? "income_date" : "expense_date";

  useEffect(() => {
    let ignore = false;
    (async () => {
      const from = month ? monthRange(month).from : `${year}-01-01`;
      const to = month ? monthRange(month).to : `${year}-12-31`;
      const { data } = await supabase
        .from(table)
        .select("*")
        .eq("category_id", categoryId)
        .gte(dateCol, from)
        .lte(dateCol, to)
        .order(dateCol, { ascending: false });
      if (!ignore) setItems(data ?? []);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, kind, month, year]);

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
              {kind === "income"
                ? (e as Income).income_date
                : (e as Expense).expense_date}
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

/* ------------------------------------------------------------------ */
/* Flow data builders                                                  */
/* ------------------------------------------------------------------ */

function dailyFlow(
  expDays: DailyTotal[],
  incDays: DailyTotal[],
  month: string,
  daysInMonth: number
) {
  const exp = new Map(expDays.map((d) => [d.day, Number(d.total)]));
  const inc = new Map(incDays.map((d) => [d.day, Number(d.total)]));
  return Array.from({ length: daysInMonth }, (_, i) => {
    const iso = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { iso, expense: exp.get(iso) ?? 0, income: inc.get(iso) ?? 0 };
  });
}

function monthlyFlow(expMonths: MonthlyTotal[], incMonths: MonthlyTotal[]) {
  const exp = new Map(expMonths.map((m) => [m.month, Number(m.total)]));
  const inc = new Map(incMonths.map((m) => [m.month, Number(m.total)]));
  return Array.from({ length: 12 }, (_, i) => ({
    name: MONTH_NAMES[i],
    expense: exp.get(i + 1) ?? 0,
    income: inc.get(i + 1) ?? 0,
  }));
}
