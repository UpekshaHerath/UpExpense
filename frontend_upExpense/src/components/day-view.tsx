"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Expense, PaymentMethod } from "@/lib/types";
import {
  addDays,
  formatDayHeading,
  formatMoney,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/date-picker";
import { DaySkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";

export function DayView({ date }: { date: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Expense | null>(null);

  // Component is keyed by date (see day/[date]/page.tsx), so this runs
  // once per date and initial state is always fresh.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const [catRes, expRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("expenses")
          .select("*, categories(*)")
          .eq("expense_date", date)
          .order("created_at"),
      ]);
      if (ignore) return;
      if (catRes.data) setCategories(catRes.data);
      if (expRes.data) setExpenses(expRes.data);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const dayTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  async function handleDelete(exp: Expense) {
    // Optimistic: remove now, restore on failure.
    setExpenses((prev) => prev.filter((e) => e.id !== exp.id));
    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) {
      setExpenses((prev) => [...prev, exp]);
      alert(`Delete failed: ${error.message}`);
    }
  }

  function goto(d: string) {
    router.push(`/day/${d}`);
  }

  const today = todayISO();
  const relativeLabel =
    date === today
      ? "Today"
      : date === addDays(today, -1)
        ? "Yesterday"
        : null;

  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goto(addDays(date, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft />
        </Button>

        <div className="min-w-0 text-center">
          <DatePicker
            value={date}
            max={today}
            onChange={goto}
            ariaLabel="Jump to date"
          />
          <p className="mt-1.5 text-sm font-medium text-muted-foreground">
            {relativeLabel && (
              <Badge className="mr-1.5 bg-primary/10 text-primary hover:bg-primary/10">
                {relativeLabel}
              </Badge>
            )}
            {formatDayHeading(date)}
          </p>
          {date !== today && (
            <Button
              variant="link"
              size="sm"
              onClick={() => goto(today)}
              className="h-auto p-0 text-xs"
            >
              Jump to today
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => goto(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Next day"
        >
          <ChevronRight />
        </Button>
      </div>

      {loading ? (
        <DaySkeleton />
      ) : (
        <>
          {/* Day total */}
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Day total
              </p>
              {/* Keyed by value: gentle tick whenever the total changes. */}
              <motion.p
                key={dayTotal}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="mt-1 text-3xl font-bold tabular-nums"
              >
                {formatMoney(dayTotal)}
              </motion.p>
            </CardContent>
          </Card>

          {/* Entry form */}
          <ExpenseForm
            key={editing?.id ?? "new"}
            date={date}
            categories={categories}
            editing={editing}
            onSaved={(saved, isEdit) => {
              setEditing(null);
              setExpenses((prev) =>
                isEdit
                  ? prev.map((e) => (e.id === saved.id ? saved : e))
                  : [...prev, saved]
              );
            }}
            onCancelEdit={() => setEditing(null)}
          />

          {/* Expense list */}
          {expenses.length === 0 ? (
            <EmptyState
              icon="🌱"
              title="No expenses on this day"
              hint="Add one above — amount, tap a category, done."
            />
          ) : (
            <Card className="py-0">
              <ul className="divide-y">
                <AnimatePresence initial={false}>
                  {expenses.map((exp) => (
                    <motion.li
                      key={exp.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: `${exp.categories?.color}22` }}
                    >
                      {exp.categories?.icon ?? "💸"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {exp.categories?.name ?? "—"}
                        {exp.payment_method && (
                          <Badge
                            variant="secondary"
                            className="ml-2 text-[10px] uppercase"
                          >
                            {exp.payment_method}
                          </Badge>
                        )}
                      </p>
                      {exp.note && (
                        <p className="truncate text-xs text-muted-foreground">
                          {exp.note}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(Number(exp.amount))}
                    </p>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(exp)}
                        aria-label="Edit expense"
                        className="text-muted-foreground"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(exp)}
                        aria-label="Delete expense"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ExpenseForm({
  date,
  categories,
  editing,
  onSaved,
  onCancelEdit,
}: {
  date: string;
  categories: Category[];
  editing: Expense | null;
  onSaved: (saved: Expense, isEdit: boolean) => void;
  onCancelEdit: () => void;
}) {
  const supabase = createClient();
  const amountRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [categoryId, setCategoryId] = useState<string | null>(
    editing?.category_id ?? null
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [payment, setPayment] = useState<PaymentMethod | null>(
    editing?.payment_method ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, [editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!categoryId) {
      setError("Pick a category.");
      return;
    }

    setSaving(true);
    const payload = {
      amount: value,
      category_id: categoryId,
      note: note.trim() || null,
      payment_method: payment,
      expense_date: date,
    };

    const query = editing
      ? supabase.from("expenses").update(payload).eq("id", editing.id)
      : supabase.from("expenses").insert(payload);

    const { data, error: dbError } = await query
      .select("*, categories(*)")
      .single();

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }

    onSaved(data as Expense, !!editing);
    setAmount("");
    setNote("");
    setPayment(null);
    amountRef.current?.focus();
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-semibold">
            {editing ? "Edit expense" : "Add expense"}
          </p>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">
              Rs.
            </span>
            <Input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Amount in rupees"
              className="h-11 pl-10 text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>

          {/* Category chips — tap to select (PRD EXP-5) */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  categoryId === c.id
                    ? "border-transparent text-white"
                    : "text-muted-foreground hover:bg-muted"
                )}
                style={
                  categoryId === c.id ? { backgroundColor: c.color } : {}
                }
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1"
            />
            {(["cash", "card"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant={payment === m ? "default" : "outline"}
                size="sm"
                onClick={() => setPayment(payment === m ? null : m)}
                className="h-9 text-xs uppercase"
              >
                {m}
              </Button>
            ))}
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="h-10 flex-1">
              {saving ? "Saving…" : editing ? "Save changes" : "Add expense"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancelEdit}
                className="h-10"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
