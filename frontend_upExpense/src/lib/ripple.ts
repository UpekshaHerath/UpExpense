"use client";

/**
 * Touch feedback: a wave spreading from the point of contact.
 *
 * One delegated listener on the document drives every tappable surface in the
 * app. That beats per-component handlers on three counts: nothing has to be
 * wired up (a new button ripples the moment it carries the class), Radix
 * primitives need no prop plumbing, and the whole app costs three listeners
 * instead of one closure per rendered control.
 *
 * The handler writes three custom properties straight onto the DOM node and
 * toggles one attribute — no React state, so tapping a chip in a list of
 * twenty re-renders nothing. The animation lives in globals.css (`.ripple`),
 * transform-only, so it stays on the compositor.
 *
 * Two ways to opt in:
 *   - `class="ripple"` on the control itself — the usual case.
 *   - `data-ripple-host` on the control plus an inner
 *     `<span data-ripple-surface class="ripple …">` — for controls that
 *     cannot hide their own overflow because something (an active underline,
 *     a badge) is drawn outside their box.
 */

/** Must match the @keyframes name in globals.css. */
const ANIMATION_NAME = "ripple";

/** Anything that opts in, either directly or through an inner surface. */
const HOST_SELECTOR = "[data-ripple-host], .ripple";

function surfaceOf(host: Element): HTMLElement {
  return (
    host.querySelector<HTMLElement>("[data-ripple-surface]") ??
    (host as HTMLElement)
  );
}

function isDisabled(host: Element): boolean {
  return (
    host.hasAttribute("disabled") ||
    host.hasAttribute("data-disabled") ||
    host.getAttribute("aria-disabled") === "true"
  );
}

function start(host: Element, clientX: number, clientY: number) {
  const el = surfaceOf(host);
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  // A circle centred on the touch point still has to reach the far corner,
  // so measure to the furthest edge on each axis rather than to the middle.
  const size =
    Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) * 2;

  el.style.setProperty("--ripple-x", `${x}px`);
  el.style.setProperty("--ripple-y", `${y}px`);
  el.style.setProperty("--ripple-size", `${size}px`);

  // Drop the attribute and force a reflow before re-adding it: a second tap
  // during the first wave restarts the animation instead of being swallowed.
  el.removeAttribute("data-ripple");
  void el.offsetWidth;
  el.setAttribute("data-ripple", "");
}

function onPointerDown(event: PointerEvent) {
  // Left button / touch / pen only — a right-click opens a menu, it doesn't
  // press anything.
  if (event.button !== 0) return;
  const host = (event.target as Element | null)?.closest?.(HOST_SELECTOR);
  if (!host || isDisabled(host)) return;
  start(host, event.clientX, event.clientY);
}

function onKeyDown(event: KeyboardEvent) {
  // Keyboard activation fires no pointer event, so those presses would
  // otherwise be the only ones with no feedback. Ripple from the centre.
  if (event.repeat) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  const host = document.activeElement?.closest?.(HOST_SELECTOR);
  if (!host || isDisabled(host)) return;
  const rect = surfaceOf(host).getBoundingClientRect();
  start(host, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function onAnimationEnd(event: AnimationEvent) {
  if (event.animationName !== ANIMATION_NAME) return;
  (event.target as HTMLElement | null)?.removeAttribute?.("data-ripple");
}

/** Starts the delegation. Returns the teardown. Mounted once, app-wide. */
export function installRipple(): () => void {
  // Capture phase: a control that stops propagation on pointerdown still
  // gets its wave.
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("animationend", onAnimationEnd, true);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("animationend", onAnimationEnd, true);
  };
}
