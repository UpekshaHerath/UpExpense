"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SavingSummary } from "@/lib/types";
import {
  fetchSavingSummaries,
  hasTarget,
  isClosed,
  isReached,
  savingProgress,
  setSavingClosed,
} from "@/lib/savings";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/skeletons";
import { SavingDialog } from "@/components/savings/saving-dialog";
import { SavingProgress } from "@/components/savings/saving-progress";
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
 * The "Savings" side of the categories page: every pot with its balance, plus
 * add / edit / close / delete. Summaries come from one RPC — the per-pot
 * totals are aggregated in Postgres rather than fetched row by row.
 */
export function SavingsPanel({
  fallbackExpenseId,
  fallbackIncomeId,
  onChanged,
}: {
  /** Where a deleted pot's deposits get reassigned ("Other" expense). */
  fallbackExpenseId: string | null;
  /** Where its withdrawals go ("Other Income"). */
  fallbackIncomeId: string | null;
  /** Lets the parent refresh its category list after add/delete. */
  onChanged?: () => void;
}) {
  const supabase = createClient();
  const claim = useReward();

  const [pots, setPots] = useState<SavingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingSummary | null>(null);
  const [deleting, setDeleting] = useState<SavingSummary | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchSavingSummaries(supabase);
        if (!ignore) setPots(data);
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

  function handleSaved(pot: SavingSummary, isEdit: boolean) {
    setPots((prev) =>
      isEdit
        ? prev.map((p) => (p.category_id === pot.category_id ? pot : p))
        : [...prev, pot]
    );
    if (!isEdit) claim("first_saving");
    onChanged?.();
  }

  async function toggleClosed(pot: SavingSummary) {
    const closing = !isClosed(pot);
    // Optimistic — the button is a toggle and must not feel like a round trip.
    setPots((prev) =>
      prev.map((p) =>
        p.category_id === pot.category_id
          ? { ...p, closed_at: closing ? new Date().toISOString() : null }
          : p
      )
    );
    try {
      await setSavingClosed(supabase, pot.category_id, closing);
      if (closing && isReached(pot)) claim("saving_reached");
    } catch (err) {
      setPots((prev) =>
        prev.map((p) =>
          p.category_id === pot.category_id
            ? { ...p, closed_at: pot.closed_at }
            : p
        )
      );
      setError((err as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const pot = deleting;
    setDeleting(null);
    setError(null);

    const hasDeposits = pot.deposited > 0;
    const hasWithdrawals = pot.withdrawn > 0;

    if (hasDeposits && !fallbackExpenseId) {
      setError('Cannot delete: no "Other" category to move the deposits to.');
      return;
    }
    if (hasWithdrawals && !fallbackIncomeId) {
      setError(
        'Cannot delete: no "Other Income" category to move the withdrawals to.'
      );
      return;
    }

    // Entries move out first — category_id is ON DELETE RESTRICT on both
    // tables, and money that really moved must not vanish with the pot.
    if (hasDeposits) {
      const { error: moveError } = await supabase
        .from("expenses")
        .update({ category_id: fallbackExpenseId })
        .eq("category_id", pot.category_id);
      if (moveError) {
        setError(moveError.message);
        return;
      }
    }
    if (hasWithdrawals) {
      const { error: moveError } = await supabase
        .from("incomes")
        .update({ category_id: fallbackIncomeId })
        .eq("category_id", pot.category_id);
      if (moveError) {
        setError(moveError.message);
        return;
      }
    }

    // The savings row goes with it (ON DELETE CASCADE).
    const { error: delError } = await supabase
      .from("categories")
      .delete()
      .eq("id", pot.category_id);
    if (delError) {
      setError(delError.message);
      return;
    }
    setPots((prev) => prev.filter((p) => p.category_id !== pot.category_id));
    onChanged?.();
  }

  // The headline number: everything set aside and not yet taken back out,
  // closed pots included — money in a finished pot is still money you have.
  const saved = pots.reduce((sum, p) => sum + p.balance, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total saved
            </p>
            <p className="truncate text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(saved)}
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
            Add pot
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
      ) : pots.length === 0 ? (
        <EmptyState
          icon="🐷"
          title="No savings pots yet"
          hint="Add one and it shows up as a chip on the expenses tab — every amount you log into it fills the pot."
        />
      ) : (
        <ul className="space-y-3">
          {pots.map((pot) => (
            <SavingRow
              key={pot.category_id}
              pot={pot}
              onEdit={() => {
                setEditing(pot);
                setDialogOpen(true);
              }}
              onToggleClosed={() => toggleClosed(pot)}
              onDelete={() => setDeleting(pot)}
            />
          ))}
        </ul>
      )}

      <SavingDialog
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
                ? `Its ${deleting.tx_count} logged entr${
                    deleting.tx_count === 1 ? "y" : "ies"
                  } move to the "Other" categories and stay in your history. This cannot be undone.`
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

function SavingRow({
  pot,
  onEdit,
  onToggleClosed,
  onDelete,
}: {
  pot: SavingSummary;
  onEdit: () => void;
  onToggleClosed: () => void;
  onDelete: () => void;
}) {
  const closed = isClosed(pot);
  const reached = isReached(pot);
  const targeted = hasTarget(pot);

  return (
    <li>
      <Card className={cn("py-0", closed && "opacity-75")}>
        <CardContent className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
              style={{ backgroundColor: `${pot.color}22` }}
            >
              {pot.icon ?? "🐷"}
            </span>
            <Link
              href={`/savings/${pot.category_id}`}
              className="ripple min-w-0 flex-1 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {pot.name}
                {closed ? (
                  <Badge variant="secondary">Done</Badge>
                ) : (
                  reached && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
                      Reached
                    </Badge>
                  )
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {pot.description ??
                  `${pot.tx_count} entr${pot.tx_count === 1 ? "y" : "ies"}`}
              </p>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleClosed}
              aria-label={
                closed ? `Reopen ${pot.name}` : `Mark ${pot.name} done`
              }
              title={closed ? "Reopen" : "Mark done"}
              className={cn(
                "text-muted-foreground",
                !closed && "hover:bg-emerald-500/10 hover:text-emerald-600"
              )}
            >
              {closed ? <RotateCcw /> : <Check />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label={`Edit ${pot.name}`}
              className="text-muted-foreground"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label={`Delete ${pot.name}`}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </div>

          <SavingProgress pot={pot} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
            <p className="text-muted-foreground">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  reached
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                )}
              >
                {formatMoney(pot.balance)}
              </span>{" "}
              {targeted ? `of ${formatMoney(pot.target as number)}` : "saved"}
            </p>
            <Link
              href={`/savings/${pot.category_id}`}
              className="flex items-center gap-0.5 font-medium text-primary hover:underline"
            >
              {targeted ? `${savingProgress(pot)}% there` : "History"}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
