export type Category = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  is_default: boolean;
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
