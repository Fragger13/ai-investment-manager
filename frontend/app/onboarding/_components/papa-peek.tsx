"use client";

import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";
import { PapaAvatar, PapaMood } from "./papa-bubble";

type PapaPeekProps = {
  open: boolean;
  onClose: () => void;
  mood?: PapaMood;
  autoDismissMs?: number;
  variant?: "toast" | "edge";
  imageSrc?: string;
  children: ReactNode;
};

export function PapaPeek({ open, onClose, mood = "warm", autoDismissMs, variant = "toast", imageSrc = "/landing/papa-peek.png", children }: PapaPeekProps) {
  useEffect(() => {
    if (!open || !autoDismissMs) return;
    const t = window.setTimeout(onClose, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [open, autoDismissMs, onClose]);

  if (variant === "edge") {
    return (
      <AnimatePresence>
        {open ? (
          <motion.div
            key="papa-peek-edge"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
            className="pointer-events-none fixed right-0 top-1/2 z-50 -translate-y-1/2"
          >
            <div className="pointer-events-none relative h-[200px] w-[200px] sm:h-[300px] sm:w-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt=""
                aria-hidden
                className="absolute right-0 top-0 w-full object-contain object-top drop-shadow-2xl"
              />
              <div className="pointer-events-auto absolute -top-20 right-[88px] w-[min(260px,calc(100vw-7.5rem))] sm:-top-24 sm:right-[140px] sm:w-[400px]">
                <div className="relative rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-2xl sm:px-6 sm:py-4">
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#4B5563] shadow-md transition hover:bg-[#F3F4F6] hover:text-[#0F172A]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="text-[19px] leading-snug sm:text-[23px]" style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}>
                    {children}
                  </p>
                  <svg
                    className="absolute right-6 top-full h-5 w-5"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    <path d="M 0,0 L 20,0 L 12,20 Z" fill="white" stroke="#E5E7EB" strokeWidth="1" strokeLinejoin="round" />
                    <line x1="0" y1="0" x2="20" y2="0" stroke="white" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="papa-peek"
          initial={{ x: "110%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "110%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className="fixed bottom-6 right-4 z-50 w-[min(360px,calc(100vw-2rem))] sm:bottom-8 sm:right-6"
        >
          <div className="relative flex items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xl">
            <PapaAvatar avatarClass="h-14 w-14" mood={mood} />
            <div className="flex-1 pr-5">
              <p className="text-[15px] leading-snug" style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}>
                {children}
              </p>
            </div>
            {autoDismissMs ? null : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[#4B5563] transition hover:bg-[#F3F4F6] hover:text-[#0F172A]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
