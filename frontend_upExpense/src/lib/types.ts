/**
 * A category's side of the ledger. Loans and savings are both expense-side
 * (money leaves the spendable pile) but carry their own progress tracking.
 */
export type CategoryKind = "expense" | "income" | "loan" | "saving";

/** The two kinds that have a transaction table of their own. */
export type EntryKind = "expense" | "income";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: boolean;
  kind: CategoryKind;
};

export type PaymentMethod = "cash" | "card";

export type Expense = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  note: string | null;
  payment_method: PaymentMethod | null;
  expense_date: string; // YYYY-MM-DD
  created_at: string;
  categories?: Category | null;
};

export type Income = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  note: string | null;
  income_date: string; // YYYY-MM-DD
  created_at: string;
  categories?: Category | null;
};

export type CategoryTotal = {
  category_id: string;
  name: string;
  color: string;
  icon: string | null;
  total: number;
  tx_count: number;
};

export type DailyTotal = {
  day: string; // YYYY-MM-DD
  total: number;
};

export type MonthlyTotal = {
  month: number; // 1-12
  total: number;
};

/** The extra fields a `kind: "loan"` category carries. */
export type Loan = {
  category_id: string;
  user_id: string;
  principal: number;
  description: string | null;
  created_at: string;
};

/** One row of `loan_summaries()` — a loan plus its repayment progress. */
export type LoanSummary = {
  category_id: string;
  name: string;
  color: string;
  icon: string | null;
  principal: number;
  description: string | null;
  paid: number;
  remaining: number;
  tx_count: number;
  last_paid_on: string | null;
  created_at: string;
};

/** The extra fields a `kind: "saving"` category carries. */
export type Saving = {
  category_id: string;
  user_id: string;
  /** null = open-ended pot, no goal to reach. */
  target: number | null;
  description: string | null;
  closed_at: string | null;
  created_at: string;
};

/** One row of `saving_summaries()` — a pot plus its balance. */
export type SavingSummary = {
  category_id: string;
  name: string;
  color: string;
  icon: string | null;
  target: number | null;
  description: string | null;
  /** Sum of expenses on this category — money put in. */
  deposited: number;
  /** Sum of incomes on this category — money taken back out. */
  withdrawn: number;
  /** deposited − withdrawn, floored at 0. */
  balance: number;
  tx_count: number;
  last_activity_on: string | null;
  closed_at: string | null;
  created_at: string;
};
