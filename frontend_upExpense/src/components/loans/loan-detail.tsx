"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Expense, LoanSummary } from "@/lib/types";
import { fetchLoanSummaries, isCleared, loanProgress } from "@/lib/loans";
import { formatDayHeading, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { LoanDialog } from "@/components/loans/loan-dialog";
import { LoanProgress } from "@/components/loans/loan-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Payments per request — enough to fill a screen, cheap enough to be instant. */
const PAGE_SIZE = 25;

/**
 * One loan: how much is left, and every installment logged against it. The
 * payments are ordinary expenses, so each row links back to its day.
 */
export function LoanDetail({ id }: { id: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [loan, setLoan] = useState<LoanSummary | null>(null);
  const [payments, setPayments] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const loadPayments = useCallback(
    async (from: number) => {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("category_id", id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      const rows = data ?? [];
      setHasMore(rows.length === PAGE_SIZE);
      return rows as Expense[];
    },
    [supabase, id]
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [summaries, rows] = await Promise.all([
        fetchLoanSummaries(supabase).catch(() => [] as LoanSummary[]),
        loadPayments(0),
      ]);
      if (ignore) return;
      const match = summaries.find((l) => l.category_id === id) ?? null;
      setLoan(match);
      setNotFound(!match);
      setPayments(rows);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleLoadMore() {
    setLoadingMore(true);
    const rows = await loadPayments(payments.length);
    setPayments((prev) => [...prev, ...rows]);
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <ListSkeleton rows={1} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (notFound || !loan) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon="🔍"
          title="Loan not found"
          hint="It may have been deleted. Head back to the loans list."
        />
      </div>
    );
  }

  const cleared = isCleared(loan);

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
              style={{ backgroundColor: `${loan.color}22` }}
            >
              {loan.icon ?? "🏦"}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold">
                <span className="truncate">{loan.name}</span>
                {cleared && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
                    Cleared
                  </Badge>
                )}
              </h1>
              {loan.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {loan.description}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setEditOpen(true)}
              aria-label={`Edit ${loan.name}`}
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
                    cleared
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-foreground"
                  )}
                >
                  {formatMoney(loan.remaining)}
                </span>{" "}
                left
              </p>
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                {loanProgress(loan)}%
              </p>
            </div>
            <LoanProgress loan={loan} height="h-2.5" />
          </div>

          <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
            <Stat label="Borrowed" value={formatMoney(loan.principal)} />
            <Stat label="Paid" value={formatMoney(loan.paid)} />
            <Stat
              label="Payments"
              value={String(loan.tx_count)}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No payments yet"
            hint="Log an installment from the Today tab — pick this loan's chip and the balance drops."
          />
        ) : (
          <>
            <Card className="py-0">
              <ul className="divide-y">
                {payments.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/day/${p.expense_date}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {formatDayHeading(p.expense_date)}
                        </p>
                        {p.note && (
                          <p className="truncate text-xs text-muted-foreground">
                            {p.note}
                          </p>
                        )}
                      </div>
                      {p.payment_method && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase"
                        >
                          {p.payment_method}
                        </Badge>
                      )}
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(Number(p.amount))}
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

      <LoanDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={loan}
        onSaved={(updated) => {
          setLoan(updated);
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
      <Link href="/categories#loans">
        <ArrowLeft />
        Back to loans
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
