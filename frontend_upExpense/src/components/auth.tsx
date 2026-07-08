"use client";

import { useState } from "react";
import { CalendarRange, Check, Eye, EyeOff, PieChart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const HIGHLIGHTS = [
  {
    icon: CalendarRange,
    title: "Log in seconds",
    body: "Capture every expense the moment it happens, one tap away.",
  },
  {
    icon: PieChart,
    title: "See where it goes",
    body: "Categories and breakdowns that make spending obvious.",
  },
  {
    icon: TrendingUp,
    title: "Understand your year",
    body: "Trends and reports that turn daily habits into insight.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Decorative wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 120% at 100% 0%, color-mix(in oklab, var(--primary) 60%, black) 0%, transparent 55%), radial-gradient(90% 90% at 0% 100%, color-mix(in oklab, var(--primary) 55%, white) 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--primary-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--primary-foreground) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative z-10 flex items-center gap-2.5 text-primary-foreground">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/95 shadow-sm">
            <LogoMark className="size-7" />
          </span>
          <span className="text-xl font-bold tracking-tight">
            up<span className="text-primary-foreground/70">Expense</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold leading-tight text-primary-foreground xl:text-4xl">
            Track daily expenses.
            <br />
            Understand your year.
          </h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground ring-1 ring-inset ring-primary-foreground/20">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold text-primary-foreground">
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm text-primary-foreground/70">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-primary-foreground/60">
          Your money, organized.
        </p>
      </aside>

      {/* Form panel */}
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Compact logo — mobile only, brand panel carries it on desktop */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo markClassName="size-9" textClassName="text-xl" />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-10" {...props} />
    </div>
  );
}

export function PasswordInput({
  value,
  onChange,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-1 my-auto text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {hint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="size-3" />
          {hint}
        </p>
      )}
    </div>
  );
}
