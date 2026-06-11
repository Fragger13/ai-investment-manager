"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";

type ScreenFrameProps = {
  screenKey: string;
  direction: 1 | -1;
  children: ReactNode;
};

export function ScreenFrame({ screenKey, direction, children }: ScreenFrameProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={screenKey}
        initial={{ opacity: 0, x: direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -24 }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0.4, 1] }}
        className="flex w-full flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
