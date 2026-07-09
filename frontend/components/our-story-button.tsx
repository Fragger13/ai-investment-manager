"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, Play, X } from "lucide-react";

/**
 * Landing-page "Our Story" control. A single header pill that opens a small
 * dropdown with the two ways to hear the story: watch the film (plays
 * /AskPapa_final.mp4 in a centered overlay) or read the launch article on
 * Medium. Keeps the header to one button so it does not crowd the sign-in CTA.
 */
const ARTICLE_URL =
  "https://medium.com/@ltanishq13/the-accidental-product-how-askpapa-came-to-life-94bda3483cf0?sharedUserId=ltanishq13";

export function OurStoryButton() {
  const [videoOpen, setVideoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Lock scroll and wire Escape while the video overlay is open.
  useEffect(() => {
    if (!videoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVideoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [videoOpen]);

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-bold text-[#0F172A] shadow-md ring-1 ring-black/[0.04] transition hover:bg-[#FAFAFA] hover:shadow-lg"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#138A3C] text-[#138A3C]">
            <Play className="h-3 w-3 fill-current" />
          </span>
          Our Story
          <ChevronDown className={`h-4 w-4 text-[#6B7280] transition ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-1.5 shadow-xl ring-1 ring-black/[0.05]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setVideoOpen(true);
              }}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#F1F8F0]"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F4EC] text-[#138A3C]">
                <Play className="h-3.5 w-3.5 fill-current" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#0F172A]">Watch the film</span>
                <span className="block text-xs font-medium text-[#6B7280]">A short look at why we built it</span>
              </span>
            </button>
            <a
              href={ARTICLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#F1F8F0]"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9F4EC] text-[#138A3C]">
                <BookOpen className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#0F172A]">Read the article</span>
                <span className="block text-xs font-medium text-[#6B7280]">The full story on Medium</span>
              </span>
            </a>
          </div>
        )}
      </div>

      {videoOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setVideoOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="AskPapa — Our Story"
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
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
