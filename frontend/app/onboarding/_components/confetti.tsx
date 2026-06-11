"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["#138A3C", "#F59E0B", "#3B82F6", "#EC4899", "#10B981", "#8B5CF6"];

export function Confetti({ count = 28 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        rotate: Math.random() * 360,
        size: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        drift: -30 + Math.random() * 60
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: piece.rotate }}
          animate={{ y: 480, x: piece.drift, opacity: [0, 1, 1, 0], rotate: piece.rotate + 240 }}
          transition={{ duration: 1.8, delay: piece.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: 0,
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.4,
            backgroundColor: piece.color,
            borderRadius: 2
          }}
        />
      ))}
    </div>
  );
}
