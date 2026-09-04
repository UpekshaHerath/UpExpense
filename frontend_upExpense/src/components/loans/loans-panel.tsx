"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LoanSummary } from "@/lib/types";
import { fetchLoanSummaries, isCleared, loanProgress } from "@/lib/loans";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { LoanDialog } from "@/components/loans/loan-dialog";
import { LoanProgress } from "@/components/loans/loan-progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useReward } from "@/components/rewards/rewards";

/**
 * The "Loans" side of the categories page: every loan with its progress, plus
 * add / edit / delete. Summaries come from one RPC — the per-loan totals are
 * aggregated in Postgres rather than fetched row by row.
 */
export function LoansPanel({
  fallbackCategoryId,
  onChanged,
}: {
  /** Where a deleted loan's payments get reassigned ("Other" expense). */
  fallbackCategoryId: string | null;
  /** Lets the parent refresh its category list after add/delete. */
  onChanged?: () => void;
}) {
  const supabase = createClient();
  const claim = useReward();

  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LoanSummary | null>(null);
  const [deleting, setDeleting] = useState<LoanSummary | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchLoanSummaries(supabase);
        if (!ignore) setLoans(data);
      } catch (err) {
        if (!ignore) setError((err as Error).message);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSaved(loan: LoanSummary, isEdit: boolean) {
    setLoans((prev) =>
      isEdit
        ? prev.map((l) => (l.category_id === loan.category_id ? loan : l))
        : [...prev, loan]
    );
    if (!isEdit) claim("first_loan");
    onChanged?.();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const loan = deleting;
    setDeleting(null);
    setError(null);

    if (loan.tx_count > 0 && !fallbackCategoryId) {
      setError('Cannot delete: no "Other" category to move the payments to.');
      return;
    }

    // Payments move to "Other" first — expenses.category_id is ON DELETE
    // RESTRICT, and a paid installment is real spend that must not vanish.
    if (loan.tx_count > 0) {
      const { error: moveError } = await supabase
        .from("expenses")
        .update({ category_id: fallbackCategoryId })
        .eq("category_id", loan.category_id);
      if (moveError) {
        setError(moveError.message);
        return;
      }
    }

    // The loans row goes with it (ON DELETE CASCADE).
    const { error: delError } = await supabase
      .from("categories")
      .delete()
      .eq("id", loan.category_id);
    if (delError) {
      setError(delError.message);
      return;
    }
    setLoans((prev) => prev.filter((l) => l.category_id !== loan.category_id));
    onChanged?.();
  }

  const owed = loans.reduce((sum, l) => sum + l.remaining, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Still owed
            </p>
            <p className="truncate text-xl font-bold tabular-nums">
              {formatMoney(owed)}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Add loan
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : loans.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="No loans tracked"
          hint="Add one and it shows up as a chip on the expenses tab — every installment you log counts it down."
        />
      ) : (
        <ul className="space-y-3">
          {loans.map((loan) => (
            <LoanRow
              key={loan.category_id}
              loan={loan}
              onEdit={() => {
                setEditing(loan);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleting(loan)}
            />
          ))}
        </ul>
      )}

      <LoanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleting?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.tx_count > 0
                ? `Its ${deleting.tx_count} logged payment${
                    deleting.tx_count === 1 ? "" : "s"
                  } move to the "Other" category and stay in your expense history. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LoanRow({
  loan,
  onEdit,
  onDelete,
}: {
  loan: LoanSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cleared = isCleared(loan);

  return (
    <li>
      <Card className="py-0">
        <CardContent className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
              style={{ backgroundColor: `${loan.color}22` }}
            >
              {loan.icon ?? "🏦"}
            </span>
            <Link
              href={`/loans/${loan.category_id}`}
              className="ripple min-w-0 flex-1 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {loan.name}
                {cleared && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
                    Cleared
                  </Badge>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {loan.description ??
                  `${loan.tx_count} payment${loan.tx_count === 1 ? "" : "s"}`}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label={`Edit ${loan.name}`}
              className="text-muted-foreground"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label={`Delete ${loan.name}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>

          <LoanProgress loan={loan} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <p className="text-muted-foreground">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  cleared
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                )}
              >
                {formatMoney(loan.remaining)}
              </span>{" "}
              left of {formatMoney(loan.principal)}
            </p>
            <Link
              href={`/loans/${loan.category_id}`}
              className="flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              {loanProgress(loan)}% paid
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
