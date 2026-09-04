/** A category's side of the ledger. Loans are expense-side, but tracked. */
export type CategoryKind = "expense" | "income" | "loan";

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
