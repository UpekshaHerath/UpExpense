"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/logo";

/**
 * Custom title bar for the installed desktop PWA (Window Controls Overlay).
 * Hidden everywhere except `display-mode: window-controls-overlay` — layout,
 * sizing and the drag region live in globals.css under `.pwa-titlebar`.
 *
 * The OS close/minimize/maximize buttons are drawn by the browser on top of
 * this bar; their strip is painted with <meta name="theme-color">, so the
 * effect below keeps that meta in sync with the app theme (class-based, not
 * prefers-color-scheme) to make the bar read as one seamless surface.
 */
export function PwaTitlebar() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      let meta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]'
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      // Hex twins of --background in globals.css (oklch(1 0 0) / oklch(.145 0 0)).
      meta.content = root.classList.contains("dark") ? "#0a0a0a" : "#ffffff";
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pwa-titlebar border-b bg-background">
      <LogoMark className="size-4.5" />
      <span className="text-[13px] font-semibold tracking-tight text-foreground">
        <span className="text-primary">up</span>Expense
      </span>
    </div>
  );
}
