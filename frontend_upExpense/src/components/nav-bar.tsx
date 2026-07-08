"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export function NavBar() {
  const pathname = usePathname();

  // Link straight to /day/<today> — going through "/" (a server redirect
  // outside this layout group) would unmount and remount the whole shell.
  const links = [
    { href: `/day/${todayISO()}`, label: "Today", match: "/day" },
    { href: "/reports", label: "Reports", match: "/reports" },
    { href: "/categories", label: "Categories", match: "/categories" },
  ];

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <Link href={`/day/${todayISO()}`} aria-label="upExpense — today">
          <Logo
            markClassName="size-7"
            textClassName="max-[380px]:hidden text-base"
          />
        </Link>

        <div className="flex items-center gap-1">
          {links.map((l) => {
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
          <ThemeToggle />
          <div className="ml-1">
            <UserMenu />
          </div>
        </div>
      </nav>
    </header>
  );
}
