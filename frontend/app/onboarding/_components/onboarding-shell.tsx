"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SCRIPT_FAMILY, SCRIPT_GREEN, caveat, inter } from "@/lib/fonts";
import { ProgressSegments } from "./progress-segments";
import { CalculatorButton } from "./calculator";

type SaveState = "idle" | "saving" | "saved";

type OnboardingShellProps = {
  sections: { id: string; label: string }[];
  activeSectionIndex: number;
  sectionLabel: string;
  saveState: SaveState;
  draftLabel?: string;
  onSaveDraft?: () => void;
  onBack?: () => void;
  onNext: () => void;
  onExit?: () => void;
  isFirst: boolean;
  isLast: boolean;
  submitting: boolean;
  nextLabel?: string;
  children: ReactNode;
};

export function OnboardingShell({
  sections,
  activeSectionIndex,
  sectionLabel,
  saveState,
  draftLabel,
  onSaveDraft,
  onBack,
  onNext,
  onExit,
  isFirst,
  isLast,
  submitting,
  nextLabel,
  children
}: OnboardingShellProps) {
  return (
    <main
      className={`${inter.variable} ${caveat.variable} min-h-screen bg-white text-[#0F172A]`}
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-3 sm:px-10 sm:py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/papa-avatar.png" alt="" aria-hidden className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-sm" />
            <span className="text-xl font-semibold text-[#0F172A]">AskPapa</span>
          </Link>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {saveState !== "idle" ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#138A3C] shadow-sm"
                >
                  {saveState === "saving" ? (
                    <>
                      <Save className="h-4 w-4 animate-pulse" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> {draftLabel || "Papa saved your answers"}
                    </>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
            {onExit ? (
              <Button variant="outline" size="lg" onClick={onExit}>
                Exit
              </Button>
            ) : null}
            {onSaveDraft ? (
              <Button variant="outline" size="lg" onClick={onSaveDraft}>
                <Save className="h-5 w-5" /> Save
              </Button>
            ) : null}
            <CalculatorButton />
          </div>
        </header>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#0F172A]">
              Section {Math.min(activeSectionIndex + 1, sections.length)} of {sections.length} · {sectionLabel}
            </p>
            <p className="text-2xl font-semibold sm:text-[28px]" style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}>
              {(() => {
                const totalSteps = Math.max(sections.length - 1, 1);
                const remaining = Math.max(1, Math.ceil(5 * (1 - activeSectionIndex / totalSteps)));
                return remaining === 1 ? "~ 1 minute" : `~ ${remaining} minutes`;
              })()}
            </p>
          </div>
          <ProgressSegments sections={sections} activeIndex={activeSectionIndex} />
        </div>

        <section className="mt-4 flex flex-1 flex-col">
          <div className="flex flex-1 flex-col rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-md sm:p-7">
            {children}
          </div>
        </section>

        <footer className="mt-4 mb-10 flex items-center justify-between sm:mb-14">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isFirst || submitting}
            onClick={onBack}
            className="rounded-full px-7 text-base"
          >
            <ArrowLeft className="h-5 w-5" /> Back
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onNext}
            disabled={submitting}
            className="rounded-full bg-[#138A3C] px-9 text-base text-white hover:bg-[#107132]"
          >
            {submitting ? "Saving…" : nextLabel || (isLast ? "Open my dashboard" : "Continue")} <ArrowRight className="h-5 w-5" />
          </Button>
        </footer>
      </div>
    </main>
  );
}
