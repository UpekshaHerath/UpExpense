"use client";

import { useEffect } from "react";
import { installRipple } from "@/lib/ripple";

/**
 * Mounts the app-wide ripple delegation. Renders nothing — it exists so the
 * document listeners live for exactly as long as the app does.
 */
export function RippleRoot() {
  useEffect(() => installRipple(), []);
  return null;
}
