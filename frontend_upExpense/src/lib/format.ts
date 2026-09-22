import { DEFAULT_CURRENCY } from "@/lib/currency";

/**
 * The signed-in user's currency. Held at module level so every formatter —
 * including ones called from toasts and callbacks — reads the same value
 * without threading it through props. <CurrencyProvider> keeps it in sync
 * with profiles.currency and remounts the page when it changes.
 */
let activeCurrency = DEFAULT_CURRENCY;
let currencyFormatter: Intl.NumberFormat;
let compactFormatter: Intl.NumberFormat;

export function setActiveCurrency(code: string) {
  activeCurrency = code;
  // Amounts are numeric(12, 2): never show more decimals than we store, and
  // fewer when the currency has none (JPY, KRW…).
  const digits = Math.min(
    new Intl.NumberFormat("en", { style: "currency", currency: code })
      .resolvedOptions().maximumFractionDigits ?? 2,
    2
  );
  currencyFormatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  compactFormatter = new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

setActiveCurrency(DEFAULT_CURRENCY);

export function getActiveCurrency(): string {
  return activeCurrency;
}

export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount);
}

/** Short money for tight spots (chips, badges): "Rs 1.2M", "$45K". */
export function formatMoneyCompact(amount: number): string {
  return compactFormatter.format(amount);
}

/** Money with an explicit +/− sign — for net balances (income − expense). */
export function formatSignedMoney(amount: number): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${sign}${currencyFormatter.format(Math.abs(amount))}`;
}

/** Tailwind text tone for a net balance: green up, red down, muted flat. */
export function netToneClass(amount: number): string {
  if (amount > 0) return "text-emerald-600 dark:text-emerald-400";
  if (amount < 0) return "text-destructive";
  return "text-muted-foreground";
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Format a Date as YYYY-MM-DD in local time (no timezone shifts). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local Date (avoids UTC off-by-one). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime()) && toISODate(d) === iso;
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatDayHeading(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
