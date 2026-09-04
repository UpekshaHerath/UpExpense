import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoanSummary } from "@/lib/types";

/**
 * A loan is a `categories` row (kind: "loan") plus a `loans` row holding the
 * principal and description. Installments are ordinary expenses pointing at
 * that category, so "paid" is always derived — never a column that can drift.
 */

export type LoanDraft = {
  name: string;
  principal: number;
  description: string | null;
  icon: string | null;
  color: string;
};

/** Every loan with its repayment progress, aggregated in Postgres. */
export async function fetchLoanSummaries(
  supabase: SupabaseClient
): Promise<LoanSummary[]> {
  const { data, error } = await supabase.rpc("loan_summaries");
  if (error) throw error;
  return (data ?? []).map(normaliseSummary);
}

/** Postgres numerics arrive as strings over PostgREST — coerce once, here. */
export function normaliseSummary(row: LoanSummary): LoanSummary {
  return {
    ...row,
    principal: Number(row.principal),
    paid: Number(row.paid),
    remaining: Number(row.remaining),
    tx_count: Number(row.tx_count),
  };
}

/**
 * Creates the category and its loan row. The category insert can fail on the
 * unique (user, kind, name) index, so it goes first and the loan row follows;
 * if the second insert fails we roll the category back rather than leaving a
 * loan category with no loan behind it.
 */
export async function createLoan(
  supabase: SupabaseClient,
  draft: LoanDraft
): Promise<LoanSummary> {
  const { data: category, error: catError } = await supabase
    .from("categories")
    .insert({
      name: draft.name,
      color: draft.color,
      icon: draft.icon,
      kind: "loan",
    })
    .select()
    .single();

  if (catError) throw catError;

  const { error: loanError } = await supabase.from("loans").insert({
    category_id: category.id,
    principal: draft.principal,
    description: draft.description,
  });

  if (loanError) {
    await supabase.from("categories").delete().eq("id", category.id);
    throw loanError;
  }

  return {
    category_id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    principal: draft.principal,
    description: draft.description,
    paid: 0,
    remaining: draft.principal,
    tx_count: 0,
    last_paid_on: null,
    created_at: category.created_at,
  };
}

/** Updates both halves of a loan. Name/icon/colour live on the category. */
export async function updateLoan(
  supabase: SupabaseClient,
  categoryId: string,
  draft: LoanDraft
): Promise<void> {
  const { error: catError } = await supabase
    .from("categories")
    .update({ name: draft.name, color: draft.color, icon: draft.icon })
    .eq("id", categoryId);
  if (catError) throw catError;

  const { error: loanError } = await supabase
    .from("loans")
    .update({ principal: draft.principal, description: draft.description })
    .eq("category_id", categoryId);
  if (loanError) throw loanError;
}

/**
 * Applies a payment delta to a summary without a refetch — saving an
 * installment should move the numbers instantly, not after a round trip.
 */
export function applyPayment(
  loan: LoanSummary,
  delta: number,
  txDelta = 0
): LoanSummary {
  const paid = Math.max(loan.paid + delta, 0);
  return {
    ...loan,
    paid,
    remaining: Math.max(loan.principal - paid, 0),
    tx_count: Math.max(loan.tx_count + txDelta, 0),
  };
}

/** Repayment progress as a 0–100 percentage, clamped for over-payments. */
export function loanProgress(loan: LoanSummary): number {
  if (loan.principal <= 0) return 100;
  return Math.min(Math.round((loan.paid / loan.principal) * 100), 100);
}

export function isCleared(loan: LoanSummary): boolean {
  return loan.remaining <= 0;
}
