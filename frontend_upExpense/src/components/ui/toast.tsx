"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Small non-blocking notice, bottom of the screen. Used for the reward tiers
 * that must never interrupt entry — streaks, daily nudges, degraded
 * milestones. Anything that stops the user gets a Dialog instead.
 */
type Toast = {
  id: number;
  text: string;
  icon?: string;
};

type ToastOptions = {
  icon?: string;
  /** Milliseconds on screen. */
  duration?: number;
};

const ToastContext = createContext<
  ((text: string, options?: ToastOptions) => void) | null
>(null);

/** Older toasts drop off rather than filling the screen on a burst. */
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (text: string, options?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, text, icon: options?.icon }].slice(-MAX_VISIBLE));
      window.setTimeout(
        () => dismiss(id),
        options?.duration ?? DEFAULT_DURATION
      );
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Clears the mobile tab bar; drops to the corner once it's gone. */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4",
          "sm:bottom-6"
        )}
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.button
              key={t.id}
              type="button"
              layout
              onClick={() => dismiss(t.id)}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full bg-popover px-4 py-2.5 text-sm font-medium text-popover-foreground shadow-lg ring-1 ring-foreground/10"
            >
              {t.icon && <span className="text-base leading-none">{t.icon}</span>}
              <span className="text-left">{t.text}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");
  return toast;
}
