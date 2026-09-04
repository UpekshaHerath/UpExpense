"use client";

import { useMemo } from "react";

/**
 * Touch feedback: a wave spreading from the point of contact.
 *
 * The handlers write three custom properties straight onto the DOM node and
 * toggle one attribute — no React state, so tapping one chip in a list of
 * twenty re-renders nothing. The animation itself lives in globals.css
 * (`.ripple`), which keeps it on the compositor and off the main thread.
 */

/** Must match the @keyframes name in globals.css. */
const ANIMATION_NAME = "ripple";

/**
 * The box the wave is drawn in. Usually the element itself; an element that
 * cannot clip its own overflow (a nav link with an indicator that animates
 * outside it) marks an inner overlay with `data-ripple-surface` instead.
 */
function surfaceOf(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>("[data-ripple-surface]") ?? el;
}

function start(host: HTMLElement, clientX: number, clientY: number) {
  const el = surfaceOf(host);
  const rect = el.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  // A circle centred on the touch point still has to reach the far corner,
  // so measure to the furthest edge on each axis rather than to the middle.
  const size =
    Math.hypot(
      Math.max(x, rect.width - x),
      Math.max(y, rect.height - y)
    ) * 2;

  el.style.setProperty("--ripple-x", `${x}px`);
  el.style.setProperty("--ripple-y", `${y}px`);
  el.style.setProperty("--ripple-size", `${size}px`);

  // Drop the attribute and force a reflow before re-adding it: a second tap
  // during the first wave restarts the animation instead of being swallowed.
  el.removeAttribute("data-ripple");
  void el.offsetWidth;
  el.setAttribute("data-ripple", "");
}

export type RippleHandlers<T extends HTMLElement> = {
  onPointerDown: (event: React.PointerEvent<T>) => void;
  onKeyDown: (event: React.KeyboardEvent<T>) => void;
  onAnimationEnd: (event: React.AnimationEvent<T>) => void;
};

/**
 * Spread onto any element that also carries the `ripple` class. Handlers are
 * stable across renders, so they never invalidate a memoised child.
 */
export function useRipple<
  T extends HTMLElement = HTMLElement,
>(): RippleHandlers<T> {
  return useMemo(
    () => ({
      onPointerDown(event) {
        start(event.currentTarget, event.clientX, event.clientY);
      },

      // Keyboard activation fires no pointer event, so those presses would
      // otherwise be the only ones with no feedback. Ripple from the centre.
      onKeyDown(event) {
        if (event.repeat) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        const rect = surfaceOf(event.currentTarget).getBoundingClientRect();
        start(
          event.currentTarget,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
      },

      onAnimationEnd(event) {
        // animationend bubbles: the keyframes name identifies ours, and the
        // target is whichever node ran it (the element, or its overlay).
        if (event.animationName !== ANIMATION_NAME) return;
        (event.target as HTMLElement).removeAttribute("data-ripple");
      },
    }),
    []
  );
}

/** Merges a caller's handler with the ripple's own. */
export function composeHandlers<E>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void
) {
  return (event: E) => {
    theirs?.(event);
    ours(event);
  };
}
