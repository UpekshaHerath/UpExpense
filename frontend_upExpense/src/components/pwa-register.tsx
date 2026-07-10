"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js). Production only — a caching
 * SW during `next dev` serves stale chunks and breaks hot reload.
 */
export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  }, []);

  return null;
}
