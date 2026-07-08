"use client";

import { MotionConfig } from "framer-motion";

/** Honors the OS "reduce motion" setting for every animation below it. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
