"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "system" | "light" | "dark";

const CYCLE: Theme[] = ["system", "light", "dark"];
const META: Record<Theme, { Icon: typeof Sun; label: string }> = {
  system: { Icon: Monitor, label: "System theme" },
  light: { Icon: Sun, label: "Light theme" },
  dark: { Icon: Moon, label: "Dark theme" },
};

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// localStorage is external state — read it via useSyncExternalStore so
// hydration stays consistent ("system" on the server, real value after).
function subscribe(cb: () => void) {
  window.addEventListener("themechange", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("themechange", cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Theme {
  const s = localStorage.getItem("theme");
  return s === "light" || s === "dark" ? s : "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): Theme => "system"
  );

  // Follow OS changes while in system mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
    apply(next);
    window.dispatchEvent(new Event("themechange"));
  }

  const { Icon, label } = META[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      title={label}
      aria-label={`${label} — click to change`}
    >
      <Icon className="size-4" />
    </Button>
  );
}
