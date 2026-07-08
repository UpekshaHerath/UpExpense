"use client";

import { useSyncExternalStore } from "react";
import { Check, Palette, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACCENTS = [
  { id: "emerald", label: "Emerald", swatch: "oklch(0.596 0.145 163.23)" },
  { id: "blue", label: "Blue", swatch: "oklch(0.546 0.245 262.881)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.541 0.281 293.009)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.586 0.253 17.585)" },
  { id: "orange", label: "Orange", swatch: "oklch(0.646 0.222 41.116)" },
  { id: "teal", label: "Teal", swatch: "oklch(0.6 0.118 184.704)" },
] as const;

type Accent = (typeof ACCENTS)[number]["id"];

const DEFAULT_ACCENT: Accent = "emerald";

// localStorage is external state — same useSyncExternalStore pattern as
// theme-toggle, so hydration stays consistent (default on server).
function subscribe(cb: () => void) {
  window.addEventListener("accentchange", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("accentchange", cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Accent {
  const s = localStorage.getItem("accent");
  return ACCENTS.some((a) => a.id === s) ? (s as Accent) : DEFAULT_ACCENT;
}

function setAccent(accent: Accent) {
  if (accent === DEFAULT_ACCENT) {
    localStorage.removeItem("accent");
    document.documentElement.removeAttribute("data-accent");
  } else {
    localStorage.setItem("accent", accent);
    document.documentElement.setAttribute("data-accent", accent);
  }
  window.dispatchEvent(new Event("accentchange"));
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): Accent => DEFAULT_ACCENT
  );

  const current = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 text-left">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Settings2 className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Personalize how upExpense looks for you.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <section className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
                <Palette className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium leading-tight">
                  Accent color
                </h3>
                <p className="text-xs text-muted-foreground">
                  Buttons, charts and highlights
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {current.label}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {ACCENTS.map((a) => {
              const selected = a.id === accent;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id)}
                  aria-pressed={selected}
                  aria-label={`${a.label} accent`}
                  title={a.label}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: a.swatch }}
                >
                  {selected && (
                    <Check className="size-4 text-white drop-shadow" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
