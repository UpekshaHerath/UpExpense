const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return currencyFormatter.format(amount);
}

const compactNumberFormatter = new Intl.NumberFormat("en-LK", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Short money for tight spots (chips, badges): "Rs 1.2M", "Rs 45K". */
export function formatMoneyCompact(amount: number): string {
  return `Rs ${compactNumberFormatter.format(amount)}`;
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
