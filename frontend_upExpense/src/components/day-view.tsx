"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  Category,
  CategoryKind,
  Expense,
  Income,
  PaymentMethod,
} from "@/lib/types";
import {
  addDays,
  formatDayHeading,
  formatMoney,
  formatSignedMoney,
  netToneClass,
  todayISO,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/date-picker";
import { DaySkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/empty-state";
import { useReward } from "@/components/rewards/rewards";
import { useStreak } from "@/components/streak/streak";
import { tapHaptic } from "@/lib/haptics";

/** A day entry, normalised so expense and income rows render the same way. */
type Entry = {
  kind: CategoryKind;
  item: Expense | Income;
};

export function DayView({ date }: { date: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CategoryKind>("expense");
  const [editing, setEditing] = useState<Entry | null>(null);
  // Newest row, flashed in its category colour for a beat after it lands.
  const [flashId, setFlashId] = useState<string | null>(null);
  // Explicit "spent nothing" marker for this date — keeps the streak alive.
  const [noSpend, setNoSpend] = useState(false);
  const claim = useReward();
  const { refresh: refreshStreak } = useStreak();

  // Component is keyed by date (see day/[date]/page.tsx), so this runs
  // once per date and initial state is always fresh.
  useEffect(() => {
    let ignore = false;
    (async () => {
      const [catRes, expRes, incRes, noSpendRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("expenses")
          .select("*, categories(*)")
          .eq("expense_date", date)
          .order("created_at"),
        supabase
          .from("incomes")
          .select("*, categories(*)")
          .eq("income_date", date)
          .order("created_at"),
        supabase.from("no_spend_days").select("day").eq("day", date).maybeSingle(),
      ]);
      if (ignore) return;
      if (catRes.data) setCategories(catRes.data);
      if (expRes.data) setExpenses(expRes.data);
      if (incRes.data) setIncomes(incRes.data);
      setNoSpend(!!noSpendRes.data);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const earned = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const net = earned - spent;

  const modeCategories = categories.filter((c) => c.kind === mode);
  const entries: Entry[] =
    mode === "expense"
      ? expenses.map((item) => ({ kind: "expense", item }))
      : incomes.map((item) => ({ kind: "income", item }));

  async function handleDelete(entry: Entry) {
    const { kind, item } = entry;
    // Optimistic: remove now, restore on failure.
    if (kind === "expense") {
      setExpenses((prev) => prev.filter((e) => e.id !== item.id));
    } else {
      setIncomes((prev) => prev.filter((e) => e.id !== item.id));
    }
    const table = kind === "expense" ? "expenses" : "incomes";
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) {
      if (kind === "expense") {
        setExpenses((prev) => [...prev, item as Expense]);
      } else {
        setIncomes((prev) => [...prev, item as Income]);
      }
      alert(`Delete failed: ${error.message}`);
    }
  }

  async function markNoSpend() {
    setNoSpend(true);
    tapHaptic();
    const { error } = await supabase.from("no_spend_days").insert({ day: date });
    if (error) {
      setNoSpend(false);
      alert(`Could not save: ${error.message}`);
      return;
    }
    claim("first_no_spend");
    void refreshStreak({ celebrate: true });
  }

  async function undoNoSpend() {
    setNoSpend(false);
    await supabase.from("no_spend_days").delete().eq("day", date);
    void refreshStreak();
  }

  function handleSaved(saved: Expense | Income, isEdit: boolean) {
    setEditing(null);
    if (!isEdit) setFlashId(saved.id);

    // A day with money moving through it is not a no-spend day any more.
    if (noSpend) void undoNoSpend();
    if (!isEdit) void refreshStreak({ celebrate: true });

    if (mode === "expense") {
      const e = saved as Expense;
      setExpenses((prev) =>
        isEdit ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e]
      );
      // Brand-new entries only — editing an old one is not a first.
      if (!isEdit) claim("first_expense");
    } else {
      const i = saved as Income;
      setIncomes((prev) =>
        isEdit ? prev.map((x) => (x.id === i.id ? i : x)) : [...prev, i]
      );
      if (!isEdit) claim("first_income");
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
          {/* Day summary — earned, spent, net */}
          <Card className="py-0">
            <CardContent className="grid grid-cols-3 divide-x p-0">
              <DaySummaryCell label="Earned" value={earned} />
              <DaySummaryCell label="Spent" value={spent} />
              <DaySummaryCell label="Net" value={net} signed tone={netToneClass(net)} />
            </CardContent>
          </Card>

          {/* Expense / Income switch */}
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setEditing(null);
              setMode(v as CategoryKind);
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">
                Expense
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                Income
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Entry form (keyed by mode + edit target for fresh state) */}
          <EntryForm
            key={`${mode}-${editing?.item.id ?? "new"}`}
            kind={mode}
            date={date}
            categories={modeCategories}
            editing={editing && editing.kind === mode ? editing.item : null}
            onSaved={handleSaved}
            onCancelEdit={() => setEditing(null)}
          />

          {/* A blank day is ambiguous — spent nothing, or forgot to log? Let
              the user say so, and the streak survives either way. */}
          {expenses.length === 0 && incomes.length === 0 && (
            <NoSpendCard
              marked={noSpend}
              onMark={markNoSpend}
              onUndo={undoNoSpend}
            />
          )}

          {/* Entry list */}
          {entries.length === 0 ? (
            <EmptyState
              icon={mode === "expense" ? "🌱" : "💰"}
              title={
                mode === "expense"
                  ? "No expenses on this day"
                  : "No income on this day"
              }
              hint={
                mode === "expense"
                  ? "Add one above — amount, tap a category, done."
                  : "Add salary, business, or any money in."
              }
            />
          ) : (
            <Card className="py-0">
              <ul className="divide-y">
                <AnimatePresence initial={false}>
                  {entries.map((entry) => (
                    <EntryRow
                      key={entry.item.id}
                      entry={entry}
                      flash={entry.item.id === flashId}
                      onEdit={() => setEditing(entry)}
                      onDelete={() => handleDelete(entry)}
                    />
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

/**
 * Turns the app's churn moment — "nothing to log today, why open this?" — into
 * a win the streak counts.
 */
function NoSpendCard({
  marked,
  onMark,
  onUndo,
}: {
  marked: boolean;
  onMark: () => void;
  onUndo: () => void;
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl leading-none">🧘</span>
        {marked ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">No-spend day</p>
              <p className="truncate text-xs text-muted-foreground">
                Zero out. Streak keeps burning.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              className="text-muted-foreground"
            >
              Undo
            </Button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Spent nothing today?
            </p>
            <Button variant="outline" size="sm" onClick={onMark}>
              Mark no-spend
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DaySummaryCell({
  label,
  value,
  signed,
  tone,
}: {
  label: string;
  value: number;
  signed?: boolean;
  tone?: string;
}) {
  return (
    <div className="px-2 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-bold tabular-nums sm:text-base",
          tone
        )}
      >
        <CountUpMoney value={value} signed={signed} />
      </p>
    </div>
  );
}

/**
 * Tweens to the new total instead of snapping to it. Saving an expense should
 * visibly *move* the day's numbers — that half-second is the whole reward for
 * a tier-1 action.
 */
function CountUpMoney({ value, signed }: { value: number; signed?: boolean }) {
  const reduced = useReducedMotion();
  // Seeded with the real value so a page load lands on the number rather than
  // counting up from zero; only later changes animate.
  const amount = useMotionValue(value);
  const text = useTransform(amount, (v) =>
    signed ? formatSignedMoney(v) : formatMoney(v)
  );

  useEffect(() => {
    if (reduced) {
      amount.set(value);
      return;
    }
    const controls = animate(amount, value, {
      duration: 0.5,
      ease: "easeOut",
    });
    return () => controls.stop();
  }, [value, amount, reduced]);

  return <motion.span>{text}</motion.span>;
}

function EntryRow({
  entry,
  flash,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  flash?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { kind, item } = entry;
  const payment = kind === "expense" ? (item as Expense).payment_method : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative isolate flex items-center gap-3 overflow-hidden px-4 py-3"
    >
      {/* A wash of the category colour marks the row that just landed. */}
      {flash && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ backgroundColor: item.categories?.color ?? "var(--primary)" }}
          initial={{ opacity: 0.22 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      )}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: `${item.categories?.color}22` }}
      >
        {item.categories?.icon ?? (kind === "income" ? "💰" : "💸")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {item.categories?.name ?? "—"}
          {payment && (
            <Badge variant="secondary" className="ml-2 text-[10px] uppercase">
              {payment}
            </Badge>
          )}
        </p>
        {item.note && (
          <p className="truncate text-xs text-muted-foreground">{item.note}</p>
        )}
      </div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          kind === "income" && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {kind === "income" ? "+" : ""}
        {formatMoney(Number(item.amount))}
      </p>
      <div className="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={`Edit ${kind}`}
          className="text-muted-foreground"
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Delete ${kind}`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </motion.li>
  );
}

function EntryForm({
  kind,
  date,
  categories,
  editing,
  onSaved,
  onCancelEdit,
}: {
  kind: CategoryKind;
  date: string;
  categories: Category[];
  editing: Expense | Income | null;
  onSaved: (saved: Expense | Income, isEdit: boolean) => void;
  onCancelEdit: () => void;
}) {
  const supabase = createClient();
  const amountRef = useRef<HTMLInputElement>(null);
  const isIncome = kind === "income";

  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [categoryId, setCategoryId] = useState<string | null>(
    editing?.category_id ?? null
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [payment, setPayment] = useState<PaymentMethod | null>(
    editing && "payment_method" in editing
      ? (editing.payment_method ?? null)
      : null
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, [editing]);

  // The form is keyed by mode and edit target, so it unmounts mid-flash often.
  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    if (!categoryId) {
      setError(isIncome ? "Pick a source." : "Pick a category.");
      return;
    }

    setSaving(true);
    const trimmedNote = note.trim() || null;

    // Branch on kind so each table gets its own concretely-typed payload.
    const run = () => {
      if (isIncome) {
        const payload = {
          amount: value,
          category_id: categoryId,
          note: trimmedNote,
          income_date: date,
        };
        return editing
          ? supabase.from("incomes").update(payload).eq("id", editing.id)
          : supabase.from("incomes").insert(payload);
      }
      const payload = {
        amount: value,
        category_id: categoryId,
        note: trimmedNote,
        payment_method: payment,
        expense_date: date,
      };
      return editing
        ? supabase.from("expenses").update(payload).eq("id", editing.id)
        : supabase.from("expenses").insert(payload);
    };

    const { data, error: dbError } = await run()
      .select("*, categories(*)")
      .single();

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }

    // Confirm the save in three registers at once: touch, colour, motion.
    tapHaptic();
    setJustSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 1100);

    onSaved(data as Expense | Income, !!editing);
    setAmount("");
    setNote("");
    setPayment(null);
    amountRef.current?.focus();
  }

  const verb = isIncome ? "income" : "expense";

  return (
    <Card>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-semibold">
            {editing ? `Edit ${verb}` : `Add ${verb}`}
          </p>

          <div className="relative" data-tour="expense-amount">
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

          {/* Category / source chips — tap to select */}
          <div className="flex flex-wrap gap-1.5" data-tour="expense-categories">
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
                style={categoryId === c.id ? { backgroundColor: c.color } : {}}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {/* Grouped so the tour can spotlight "note → payment → save" as one. */}
          <div className="space-y-3" data-tour="expense-submit">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1"
              />
              {/* Payment method applies to expenses only. */}
              {!isIncome &&
                (["cash", "card"] as const).map((m) => (
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
              <Button
                type="submit"
                disabled={saving}
                className={cn(
                  "h-10 flex-1 transition-colors",
                  justSaved &&
                    "bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-500"
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {justSaved ? (
                    <motion.span
                      key="saved"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5"
                    >
                      <Check className="size-4" />
                      Saved
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {saving
                        ? "Saving…"
                        : editing
                          ? "Save changes"
                          : `Add ${verb}`}
                    </motion.span>
                  )}
                </AnimatePresence>
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
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
