"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Expense, Income, SavingSummary } from "@/lib/types";
import {
  fetchSavingSummaries,
  hasTarget,
  isClosed,
  isReached,
  remainingToTarget,
  savingProgress,
  setSavingClosed,
} from "@/lib/savings";
import { formatDayHeading, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { SavingDialog } from "@/components/savings/saving-dialog";
import { SavingProgress } from "@/components/savings/saving-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Entries per request — enough to fill a screen, cheap enough to be instant. */
const PAGE_SIZE = 25;

/** A pot's history interleaves both tables, so rows carry their direction. */
type Movement = {
  id: string;
  direction: "in" | "out";
  date: string;
  amount: number;
  note: string | null;
};

function toMovements(deposits: Expense[], withdrawals: Income[]): Movement[] {
  return [
    ...deposits.map((e) => ({
      id: e.id,
      direction: "in" as const,
      date: e.expense_date,
      amount: Number(e.amount),
      note: e.note,
    })),
    ...withdrawals.map((i) => ({
      id: i.id,
      direction: "out" as const,
      date: i.income_date,
      amount: Number(i.amount),
      note: i.note,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * One savings pot: how full it is, and every movement in or out. Deposits are
 * expenses and withdrawals are incomes, so each row links back to its day.
 */
export function SavingDetail({ id }: { id: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [pot, setPot] = useState<SavingSummary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  /**
   * Both sides are paged together: a page here means "the next PAGE_SIZE of
   * each table", which over-fetches slightly rather than paging two cursors
   * through one merged list.
   */
  const loadPage = useCallback(
    async (from: number) => {
      const [depRes, wdrRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .eq("category_id", id)
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1),
        supabase
          .from("incomes")
          .select("*")
          .eq("category_id", id)
          .order("income_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1),
      ]);
      const deposits = (depRes.data ?? []) as Expense[];
      const withdrawals = (wdrRes.data ?? []) as Income[];
      setHasMore(
        deposits.length === PAGE_SIZE || withdrawals.length === PAGE_SIZE
      );
      return toMovements(deposits, withdrawals);
    },
    [supabase, id]
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [summaries, rows] = await Promise.all([
        fetchSavingSummaries(supabase).catch(() => [] as SavingSummary[]),
        loadPage(0),
      ]);
      if (ignore) return;
      const match = summaries.find((p) => p.category_id === id) ?? null;
      setPot(match);
      setNotFound(!match);
      setMovements(rows);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleLoadMore() {
    setLoadingMore(true);
    // Both tables advance by the same offset — see loadPage.
    const offset = Math.max(
      movements.filter((m) => m.direction === "in").length,
      movements.filter((m) => m.direction === "out").length
    );
    const rows = await loadPage(offset);
    setMovements((prev) => {
      // The two tables page independently, so a row can arrive twice; the
      // merged list has to be de-duplicated and re-sorted, not appended to.
      const seen = new Set(prev.map((m) => `${m.direction}-${m.id}`));
      const merged = [
        ...prev,
        ...rows.filter((m) => !seen.has(`${m.direction}-${m.id}`)),
      ];
      return merged.sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0
      );
    });
    setLoadingMore(false);
  }

  async function handleToggleClosed() {
    if (!pot) return;
    const closing = !isClosed(pot);
    const previous = pot.closed_at;
    setPot({ ...pot, closed_at: closing ? new Date().toISOString() : null });
    try {
      await setSavingClosed(supabase, pot.category_id, closing);
    } catch {
      setPot({ ...pot, closed_at: previous });
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <ListSkeleton rows={1} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (notFound || !pot) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon="🔍"
          title="Pot not found"
          hint="It may have been deleted. Head back to the savings list."
        />
      </div>
    );
  }

  const closed = isClosed(pot);
  const reached = isReached(pot);
  const targeted = hasTarget(pot);

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
              style={{ backgroundColor: `${pot.color}22` }}
            >
              {pot.icon ?? "🐷"}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                <span className="truncate">{pot.name}</span>
                {closed ? (
                  <Badge variant="secondary">Done</Badge>
                ) : (
                  reached && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
                      Reached
                    </Badge>
                  )
                )}
              </h1>
              {pot.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {pot.description}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleClosed}
              aria-label={closed ? `Reopen ${pot.name}` : `Mark ${pot.name} done`}
              title={closed ? "Reopen" : "Mark done"}
            >
              {closed ? <RotateCcw /> : <Check />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setEditOpen(true)}
              aria-label={`Edit ${pot.name}`}
            >
              <Pencil />
            </Button>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    reached
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  )}
                >
                  {formatMoney(pot.balance)}
                </span>{" "}
                {targeted ? "saved" : "saved so far"}
              </p>
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                {targeted ? `${savingProgress(pot)}%` : "No target"}
              </p>
            </div>
            <SavingProgress pot={pot} height="h-2.5" />
            {targeted && !reached && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatMoney(remainingToTarget(pot))} to go
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
            <Stat
              label="Target"
              value={targeted ? formatMoney(pot.target as number) : "—"}
            />
            <Stat label="Put in" value={formatMoney(pot.deposited)} />
            <Stat label="Taken out" value={formatMoney(pot.withdrawn)} />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Movement history</h2>
        {movements.length === 0 ? (
          <EmptyState
            icon="🐷"
            title="Nothing in the pot yet"
            hint="Log a deposit from the Today tab — pick this pot's chip on the expense side, and the balance climbs."
          />
        ) : (
          <>
            <Card className="py-0">
              <ul className="divide-y">
                {movements.map((m) => (
                  <li key={`${m.direction}-${m.id}`}>
                    <Link
                      href={`/day/${m.date}`}
                      className="ripple flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {formatDayHeading(m.date)}
                        </p>
                        {m.note && (
                          <p className="truncate text-xs text-muted-foreground">
                            {m.note}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase"
                      >
                        {m.direction === "in" ? "In" : "Out"}
                      </Badge>
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          m.direction === "out" && "text-destructive"
                        )}
                      >
                        {m.direction === "in" ? "+" : "−"}
                        {formatMoney(m.amount)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            {hasMore && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="mt-3 w-full"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </>
        )}
      </div>

      <SavingDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={pot}
        onSaved={(updated) => {
          setPot(updated);
          // The name lives on the category, which other views cache.
          router.refresh();
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/categories#savings">
        <ArrowLeft />
        Back to savings
      </Link>
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
