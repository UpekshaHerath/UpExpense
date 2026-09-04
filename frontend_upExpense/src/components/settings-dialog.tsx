"use client";

import { useSyncExternalStore } from "react";
import { Check, Compass, Palette, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogSection,
  DialogSectionHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOUR_START_EVENT } from "@/components/tour/tour";

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogMedia>
            <Settings2 />
          </DialogMedia>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Personalize how upExpense looks for you.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <DialogSection>
            <DialogSectionHeader
              icon={<Palette />}
              title="Accent color"
              hint="Buttons, charts and highlights"
              action={
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                  {current.label}
                </Badge>
              }
            />

            <div className="mt-3 flex flex-wrap gap-2.5">
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
                      "ripple flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover focus-visible:outline-none",
                      selected &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-popover"
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
          </DialogSection>

          <DialogSection>
            <DialogSectionHeader
              icon={<Compass />}
              title="Guided tour"
              hint="Categories, expenses and stats"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Close first — the tour needs an unobstructed page to
                    // point at, and Radix only releases the body once the
                    // dialog has unmounted.
                    onOpenChange(false);
                    setTimeout(
                      () => window.dispatchEvent(new Event(TOUR_START_EVENT)),
                      250
                    );
                  }}
                >
                  Replay
                </Button>
              }
            />
          </DialogSection>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button size="lg">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
