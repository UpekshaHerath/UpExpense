import type { SupabaseClient } from "@supabase/supabase-js";
import type { SavingSummary } from "@/lib/types";

/**
 * A savings pot is a `categories` row (kind: "saving") plus a `savings` row
 * holding an optional target and a description.
 *
 * Deposits are ordinary expenses on that category, withdrawals ordinary
 * incomes. The balance is therefore always derived — never a stored number
 * that can drift away from the entries behind it.
 *
 * Mirror of lib/loans.ts: a loan counts down from its principal, a pot counts
 * up towards a target it may not even have.
 */

export type SavingDraft = {
  name: string;
  /** null = open-ended, no goal. */
  target: number | null;
  description: string | null;
  icon: string | null;
  color: string;
};

/** Every pot with its balance, aggregated in Postgres. */
export async function fetchSavingSummaries(
  supabase: SupabaseClient
): Promise<SavingSummary[]> {
  const { data, error } = await supabase.rpc("saving_summaries");
  if (error) throw error;
  return (data ?? []).map(normaliseSummary);
}

/** Postgres numerics arrive as strings over PostgREST — coerce once, here. */
export function normaliseSummary(row: SavingSummary): SavingSummary {
  return {
    ...row,
    target: row.target === null ? null : Number(row.target),
    deposited: Number(row.deposited),
    withdrawn: Number(row.withdrawn),
    balance: Number(row.balance),
    tx_count: Number(row.tx_count),
  };
}

/**
 * Creates the category and its savings row. The category insert can fail on
 * the unique (user, kind, name) index, so it goes first and the savings row
 * follows; if the second insert fails we roll the category back rather than
 * leaving a savings category with no pot behind it.
 */
export async function createSaving(
  supabase: SupabaseClient,
  draft: SavingDraft
): Promise<SavingSummary> {
  const { data: category, error: catError } = await supabase
    .from("categories")
    .insert({
      name: draft.name,
      color: draft.color,
      icon: draft.icon,
      kind: "saving",
    })
    .select()
    .single();

  if (catError) throw catError;

  const { error: savingError } = await supabase.from("savings").insert({
    category_id: category.id,
    target: draft.target,
    description: draft.description,
  });

  if (savingError) {
    await supabase.from("categories").delete().eq("id", category.id);
    throw savingError;
  }

  return {
    category_id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    target: draft.target,
    description: draft.description,
    deposited: 0,
    withdrawn: 0,
    balance: 0,
    tx_count: 0,
    last_activity_on: null,
    closed_at: null,
    created_at: category.created_at,
  };
}

/** Updates both halves of a pot. Name/icon/colour live on the category. */
export async function updateSaving(
  supabase: SupabaseClient,
  categoryId: string,
  draft: SavingDraft
): Promise<void> {
  const { error: catError } = await supabase
    .from("categories")
    .update({ name: draft.name, color: draft.color, icon: draft.icon })
    .eq("id", categoryId);
  if (catError) throw catError;

  const { error: savingError } = await supabase
    .from("savings")
    .update({ target: draft.target, description: draft.description })
    .eq("category_id", categoryId);
  if (savingError) throw savingError;
}

/**
 * Marks a pot done (or reopens it). Closing keeps every entry and the
 * balance — it only retires the pot from the day view's chips, so a finished
 * goal stops competing for attention with the ones still running.
 */
export async function setSavingClosed(
  supabase: SupabaseClient,
  categoryId: string,
  closed: boolean
): Promise<string | null> {
  const closedAt = closed ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("savings")
    .update({ closed_at: closedAt })
    .eq("category_id", categoryId);
  if (error) throw error;
  return closedAt;
}

/**
 * Applies a movement to a summary without a refetch — saving an entry should
 * move the balance instantly, not after a round trip.
 *
 * The two directions are tracked separately because backing an entry out is
 * not the same as moving money the other way: deleting a deposit must shrink
 * `deposited`, not grow `withdrawn`. Pass a negative delta on the side that
 * actually changed.
 */
export function applyContribution(
  pot: SavingSummary,
  {
    depositDelta = 0,
    withdrawDelta = 0,
    txDelta = 0,
  }: { depositDelta?: number; withdrawDelta?: number; txDelta?: number }
): SavingSummary {
  const deposited = Math.max(pot.deposited + depositDelta, 0);
  const withdrawn = Math.max(pot.withdrawn + withdrawDelta, 0);
  return {
    ...pot,
    deposited,
    withdrawn,
    balance: Math.max(deposited - withdrawn, 0),
    tx_count: Math.max(pot.tx_count + txDelta, 0),
  };
}

/**
 * Progress towards the target as 0–100, clamped. An open-ended pot has no
 * meaningful percentage — callers should check `hasTarget` before showing a
 * bar rather than reading 0 as "no progress".
 */
export function savingProgress(pot: SavingSummary): number {
  if (!pot.target || pot.target <= 0) return 0;
  return Math.min(Math.round((pot.balance / pot.target) * 100), 100);
}

export function hasTarget(pot: SavingSummary): boolean {
  return pot.target !== null && pot.target > 0;
}

/** Target met. Open-ended pots are never "reached" — there is no finish line. */
export function isReached(pot: SavingSummary): boolean {
  return hasTarget(pot) && pot.balance >= (pot.target as number);
}

export function isClosed(pot: SavingSummary): boolean {
  return pot.closed_at !== null;
}

/** What is still missing before the target is met. 0 when open-ended or done. */
export function remainingToTarget(pot: SavingSummary): number {
  if (!hasTarget(pot)) return 0;
  return Math.max((pot.target as number) - pot.balance, 0);
}
