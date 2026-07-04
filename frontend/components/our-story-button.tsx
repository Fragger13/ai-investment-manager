"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";

/**
 * Landing-page "Our Story" button — opens AskPapa's story video in a modal.
 * Styled to match the previous "Explore Demo" pill so the header is unchanged
 * visually; clicking plays /AskPapa_final.mp4 in a centered overlay.
 */
export function OurStoryButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-bold text-[#0F172A] shadow-md ring-1 ring-black/[0.04] transition hover:bg-[#FAFAFA] hover:shadow-lg"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#138A3C] text-[#138A3C]">
          <Play className="h-3 w-3 fill-current" />
        </span>
        Our Story
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="AskPapa — Our Story"
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0F172A] shadow-lg ring-1 ring-black/10 transition hover:bg-[#F3F4F6]"
            >
              <X className="h-5 w-5" />
            </button>
            <video
              src="/AskPapa_final.mp4"
              controls
              autoPlay
              playsInline
              className="max-h-[88vh] max-w-[92vw] rounded-2xl bg-black shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
