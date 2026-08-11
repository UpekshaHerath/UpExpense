"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS } from "@/components/tour/steps";

/**
 * Mirrors profiles.tour_completed_at so a returning user costs no round-trip
 * before we know the tour is done. The database column stays the source of
 * truth — clearing site data must not replay the tour on another device.
 */
const STORAGE_KEY = "upexpense.tour.v1";

/** Dispatched on window by Settings to replay the tour on demand. */
export const TOUR_START_EVENT = "tourstart";

type Box = { top: number; left: number; width: number; height: number };
type CardPos = { top: number; left: number; width: number };
type Track = { stepId: string; spot: Box; pos: CardPos };

/** Breathing room between the spotlight and the element it frames. */
const HALO = 6;
/** Gap between the spotlight and the card. */
const GAP = 12;
/** Minimum distance the card keeps from the viewport edges. */
const EDGE = 16;
const CARD_W = 340;

/**
 * Nav items exist twice — once in the top bar, once in the mobile tab bar —
 * and carry the same marker. Take whichever one the breakpoint renders.
 */
function findTarget(name: string): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  );
  return (
    nodes.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) ?? null
  );
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function samePos(a: CardPos | null, b: CardPos | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5
  );
}

/** Park the card under the spotlight, flipping above it when there's no room. */
function placeCard(spot: Box, cardH: number): CardPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - EDGE * 2);

  const left = Math.min(
    Math.max(spot.left + spot.width / 2 - width / 2, EDGE),
    vw - width - EDGE
  );

  let top = spot.top + spot.height + GAP;
  if (top + cardH > vh - EDGE) {
    const above = spot.top - GAP - cardH;
    // Neither side fits (target taller than the viewport) — pin to the bottom.
    top = above >= EDGE ? above : Math.max(EDGE, vh - EDGE - cardH);
  }
  return { top, left, width };
}

export function Tour() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [index, setIndex] = useState<number | null>(null);
  // Tagged with the step it was measured for, so a stale spotlight can never
  // outlive its step while the next target is still being located.
  const [track, setTrack] = useState<Track | null>(null);

  // Read by the measuring loop every frame, so it never needs to re-render.
  const cardH = useRef(200);
  const observer = useRef<ResizeObserver | null>(null);

  const active = index !== null;
  const step = index === null ? null : TOUR_STEPS[index];

  /* ------------------------------------------------------------------ */
  /* Should it run at all?                                               */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === "done") return;
      } catch {
        // Storage blocked — fall through to the database check.
      }

      // RLS scopes this to the caller's own row.
      const { data, error } = await supabase
        .from("profiles")
        .select("tour_completed_at")
        .maybeSingle();

      // No row, or the migration hasn't been applied yet: stay out of the way
      // rather than replaying the tour on every load.
      if (ignore || error || !data) return;

      if (data.tour_completed_at) {
        try {
          localStorage.setItem(STORAGE_KEY, "done");
        } catch {}
        return;
      }
      setIndex(0);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Replay, triggered from Settings. */
  useEffect(() => {
    const start = () => setIndex(0);
    window.addEventListener(TOUR_START_EVENT, start);
    return () => window.removeEventListener(TOUR_START_EVENT, start);
  }, []);

  const finish = useCallback(async () => {
    setIndex(null);
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {}

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ tour_completed_at: new Date().toISOString() })
      .eq("id", user.id);
  }, [supabase]);

  /* ------------------------------------------------------------------ */
  /* Drive the route the step lives on                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!step) return;
    const want = step.path?.();
    if (want && want !== pathname) router.push(want);
  }, [step, pathname, router]);

  /* ------------------------------------------------------------------ */
  /* Track the target                                                    */
  /*                                                                     */
  /* One rAF loop per step: it waits for the element to mount (pages load */
  /* their data first), scrolls it into view, and then keeps the spotlight*/
  /* glued to it through scrolling, resizing and layout shifts.           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    // Untargeted steps (welcome, sign-off) render a centered card — nothing
    // to measure, and `track` stays tagged to some other step so it's ignored.
    if (!step?.target) return;

    const name = step.target;
    const stepId = step.id;
    let raf = 0;
    let scrolled = false;
    // Generous: a cold page load has to fetch before the anchor exists.
    const deadline = Date.now() + 8000;

    const tick = () => {
      const el = findTarget(name);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const r = el.getBoundingClientRect();
        const spot: Box = {
          top: r.top - HALO,
          left: r.left - HALO,
          width: r.width + HALO * 2,
          height: r.height + HALO * 2,
        };
        const pos = placeCard(spot, cardH.current);
        setTrack((prev) =>
          prev &&
          prev.stepId === stepId &&
          sameBox(prev.spot, spot) &&
          samePos(prev.pos, pos)
            ? prev
            : { stepId, spot, pos }
        );
      } else if (!scrolled && Date.now() > deadline) {
        // Never showed up — stop looking and let the centered card carry the
        // step, rather than stalling on something we can't point at.
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  /* Card height feeds the placement maths; re-measure whenever it changes. */
  const setCardRef = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    cardH.current = node.offsetHeight;
    const ro = new ResizeObserver(() => {
      cardH.current = node.offsetHeight;
    });
    ro.observe(node);
    observer.current = ro;
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  /* Escape skips, like any other overlay. */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!step || index === null) return null;

  const last = index === TOUR_STEPS.length - 1;
  // Only honour a measurement taken for the step on screen right now.
  const current = track?.stepId === step.id ? track : null;
  const spot = current?.spot ?? null;
  const pos = current?.pos ?? null;

  const card = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      className="pointer-events-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Step {index + 1} of {TOUR_STEPS.length}
      </p>
      <h2 id="tour-title" className="mt-1 text-base font-bold">
        {step.title}
      </h2>
      <p id="tour-body" className="mt-1.5 text-sm text-muted-foreground">
        {step.body}
      </p>

      {/* Progress */}
      <div className="mt-3 flex gap-1" aria-hidden>
        {TOUR_STEPS.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= index ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={finish}
          className="text-muted-foreground"
        >
          Skip tour
        </Button>
        <div className="ml-auto flex gap-2">
          {index > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIndex(index - 1)}
            >
              Back
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => (last ? finish() : setIndex(index + 1))}
          >
            {last ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );

  // The measuring loop rewrites these every frame while the page scrolls, so
  // position is applied straight to `style` — animating it would lag behind.
  return (
    <div className="fixed inset-0 z-[60]">
      {/* Swallows clicks on the app underneath — Next/Back drive the tour. */}
      <div className={cn("absolute inset-0", !spot && "bg-black/60")} />

      {spot && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "absolute",
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
          className="pointer-events-none rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-primary"
        />
      )}

      {pos ? (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            width: pos.width,
          }}
          ref={setCardRef}
        >
          {card}
        </motion.div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-sm"
            ref={setCardRef}
          >
            {card}
          </motion.div>
        </div>
      )}
    </div>
  );
}
