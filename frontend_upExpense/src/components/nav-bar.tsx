"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, ChartColumn, Tags } from "lucide-react";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

// Link straight to /day/<today> — going through "/" (a server redirect
// outside this layout group) would unmount and remount the whole shell.
function getLinks() {
  return [
    {
      href: `/day/${todayISO()}`,
      label: "Today",
      match: "/day",
      Icon: CalendarDays,
    },
    { href: "/reports", label: "Stats", match: "/reports", Icon: ChartColumn },
    {
      href: "/categories",
      label: "Categories",
      match: "/categories",
      Icon: Tags,
    },
  ];
}

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link href={`/day/${todayISO()}`} aria-label="upExpense — today">
          <Logo markClassName="size-7" textClassName="text-base" />
        </Link>

        <div className="flex items-center gap-1">
          {/* Page links live in the bottom tab bar on mobile. */}
          <div className="hidden items-center gap-1 sm:flex">
            {getLinks().map((l) => {
              const active = pathname.startsWith(l.match);
              return (
                <Button
                  key={l.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    active &&
                      "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                >
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              );
            })}
          </div>
          <ThemeToggle />
          <div className="ml-1">
            <UserMenu />
          </div>
        </div>
      </nav>
    </header>
  );
}

/** Mobile-only bottom tab bar — thumb-reachable navigation. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-3">
        {getLinks().map((l) => {
          const active = pathname.startsWith(l.match);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <l.Icon className="size-5" />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
