"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = [
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

type Piece = {
  /** Horizontal travel at the top of the arc, in px. */
  driftX: number;
  /** How high the piece pops before gravity wins, in px (negative = up). */
  riseY: number;
  /** How far below the origin it lands, in px. */
  fallY: number;
  spin: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  round: boolean;
  color: string;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => {
    // Fan the burst sideways and up: straight-down pieces read as a leak.
    const angle = (Math.random() - 0.5) * Math.PI * 1.1;
    const power = 120 + Math.random() * 170;
    const round = Math.random() < 0.45;
    const width = round ? 7 + Math.random() * 5 : 5 + Math.random() * 4;
    return {
      driftX: Math.sin(angle) * power,
      riseY: -Math.abs(Math.cos(angle)) * power * 0.9 - 40,
      fallY: 320 + Math.random() * 260,
      spin: (Math.random() - 0.5) * 900,
      delay: Math.random() * 0.18,
      duration: 1.5 + Math.random() * 0.9,
      width,
      height: round ? width : width * 2.2,
      round,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });
}

/** Full-screen burst, purely decorative — never intercepts taps. */
export function Confetti({ count = 44 }: { count?: number }) {
  const pieces = useMemo(() => makePieces(count), [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      <div className="absolute left-1/2 top-[38%]">
        {pieces.map((p, i) => (
          <motion.span
            key={i}
            className={p.round ? "absolute rounded-full" : "absolute rounded-sm"}
            style={{
              width: p.width,
              height: p.height,
              backgroundColor: p.color,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
            animate={{
              x: [0, p.driftX * 0.7, p.driftX],
              y: [0, p.riseY, p.fallY],
              rotate: [0, p.spin * 0.4, p.spin],
              opacity: [0, 1, 0],
              scale: 1,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              times: [0, 0.32, 1],
              ease: ["easeOut", "easeIn"],
            }}
          />
        ))}
      </div>
    </div>
  );
}
