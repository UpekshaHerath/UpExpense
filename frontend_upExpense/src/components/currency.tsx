"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Coins, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  currencyInfo,
  guessCurrency,
  isCurrencyCode,
  listCurrencies,
  type CurrencyInfo,
} from "@/lib/currency";
import { getActiveCurrency, setActiveCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Mirrors profiles.currency so a returning user sees their own symbol on the
 * first paint instead of flashing the default. The column stays the source of
 * truth — a change on another device wins on the next load.
 */
const STORAGE_KEY = "upexpense.currency.v1";

type CurrencyContextValue = {
  currency: CurrencyInfo;
  /**
   * Whether the user has picked a currency. null while loading; false shows
   * the first-run picker and holds back anything else that wants the screen.
   */
  confirmed: boolean | null;
  /** Bumped when the currency changes under a mounted page; see the boundary. */
  version: number;
  /** Saves to the profile. Resolves false if the write failed. */
  setCurrency: (code: string) => Promise<boolean>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [code, setCode] = useState(getActiveCurrency);
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);
  // Read inside async callbacks, where `code` would be a stale closure.
  const current = useRef(code);

  const apply = useCallback((next: string, remount: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    if (next === current.current) return;
    current.current = next;
    setActiveCurrency(next);
    setCode(next);
    if (remount) setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      // The cached value lands before any page has fetched its numbers, so no
      // remount is needed — only components that render a symbol up front
      // (amount inputs) read it, and they re-render through context.
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (isCurrencyCode(cached)) apply(cached, false);
      } catch {}

      // RLS scopes this to the caller's own row.
      const { data, error } = await supabase
        .from("profiles")
        .select("currency, currency_confirmed_at")
        .maybeSingle();
      if (ignore) return;

      // No row, or the migration hasn't been applied yet: stay out of the way
      // rather than asking on every load.
      if (error || !data) {
        setConfirmed(true);
        return;
      }
      // Pages may already be showing amounts in the cached currency.
      if (isCurrencyCode(data.currency)) apply(data.currency, true);
      setConfirmed(!!data.currency_confirmed_at);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrency = useCallback(
    async (next: string) => {
      if (!isCurrencyCode(next)) return false;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("profiles")
        .update({
          currency: next,
          currency_confirmed_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) return false;

      apply(next, true);
      setConfirmed(true);
      return true;
    },
    [supabase, apply]
  );

  const currency = useMemo(() => currencyInfo(code), [code]);

  return (
    <CurrencyContext.Provider
      value={{ currency, confirmed, version, setCurrency }}
    >
      {children}
      <CurrencyDialog
        mode="setup"
        open={confirmed === false}
        onOpenChange={() => {}}
      />
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}

/**
 * Remounts the page when the currency changes. Formatters read a module-level
 * currency, so already-rendered amounts would otherwise keep the old symbol.
 */
export function CurrencyBoundary({ children }: { children: React.ReactNode }) {
  const { version } = useCurrency();
  return <Fragment key={version}>{children}</Fragment>;
}

/** Left padding that clears a <MoneyPrefix> of any width. */
export function moneyInputPadding(symbol: string): string {
  return `${1.25 + symbol.length * 0.5}rem`;
}

/** The currency mark pinned inside an amount input. */
export function MoneyPrefix({ symbol }: { symbol: string }) {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">
      {symbol}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Picker                                                                   */
/* ------------------------------------------------------------------------ */

export function CurrencyDialog({
  mode,
  open,
  onOpenChange,
}: {
  /** setup: first run, can't be dismissed. change: from Settings. */
  mode: "setup" | "change";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setup = mode === "setup";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!setup}
        onEscapeKeyDown={(e) => setup && e.preventDefault()}
        onInteractOutside={(e) => setup && e.preventDefault()}
      >
        {/* Mounted only while open, so every opening starts fresh. */}
        <CurrencyForm setup={setup} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CurrencyForm({
  setup,
  onDone,
}: {
  setup: boolean;
  onDone: () => void;
}) {
  const { currency, setCurrency } = useCurrency();
  const [selected, setSelected] = useState(() =>
    setup ? guessCurrency() : currency.code
  );
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const all = listCurrencies();
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? all.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.symbol.toLowerCase() === q
        )
      : all;
    // Keep the current pick on top so it's never lost below the fold.
    const pick = matches.find((c) => c.code === selected);
    return pick ? [pick, ...matches.filter((c) => c !== pick)] : matches;
    // `selected` deliberately left out: re-sorting under the finger as you
    // tap would move the row you just pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query]);

  const unchanged = !setup && selected === currency.code;
  const choice = currencyInfo(selected);

  async function save() {
    if (unchanged) return onDone();
    setSaving(true);
    setFailed(false);
    const ok = await setCurrency(selected);
    setSaving(false);
    if (ok) onDone();
    else setFailed(true);
  }

  return (
    <>
      <DialogHeader>
        <DialogMedia>
          <Coins />
        </DialogMedia>
        <DialogTitle>
          {setup ? "Choose your currency" : "Change currency"}
        </DialogTitle>
        <DialogDescription>
          {setup
            ? "Every amount in upExpense is shown in it. You can change it later in Settings."
            : "Amounts you've logged keep their numbers — they aren't converted."}
        </DialogDescription>
      </DialogHeader>

      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or code"
          aria-label="Search currencies"
          className="h-10 pl-9"
        />
      </div>

      <DialogBody className="max-h-80 space-y-0">
        <div role="listbox" aria-label="Currencies" className="space-y-1 pb-1">
          {shown.map((c) => {
            const active = c.code === selected;
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setSelected(c.code)}
                className={cn(
                  "ripple flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active && "bg-primary/10 hover:bg-primary/15"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md bg-muted px-1.5 text-sm font-semibold",
                    active && "bg-primary text-primary-foreground"
                  )}
                >
                  {c.symbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {c.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {c.code}
                  </span>
                </span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No currency matches &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      </DialogBody>

      {failed && (
        <p className="shrink-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn&apos;t save your currency. Check your connection and try again.
        </p>
      )}

      <DialogFooter>
        {!setup && (
          <DialogClose asChild>
            <Button variant="outline" size="lg">
              Cancel
            </Button>
          </DialogClose>
        )}
        <Button size="lg" onClick={save} disabled={saving}>
          {saving
            ? "Saving…"
            : setup
              ? `Continue with ${choice.code}`
              : unchanged
                ? "Done"
                : `Switch to ${choice.code}`}
        </Button>
      </DialogFooter>
    </>
  );
}
