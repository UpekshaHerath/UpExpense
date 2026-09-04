"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The current URL hash without its "#", kept in sync without an effect.
 * Empty on the server, so the first client render can differ safely — that is
 * exactly the case `useSyncExternalStore` exists to handle.
 */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => ""
  );
}
