"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Compass, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTourStore } from "@/store/tour-store";
import { ASSET_DETAIL_TOUR_FLAG, PAGE_TOURS, type PageTourStep } from "@/lib/page-tours";
import type { PapaMood } from "@/app/onboarding/_components/papa-bubble";

// Same Papa mood artwork the onboarding bubble + PapaTour use.
const MOOD_IMAGE: Partial<Record<PapaMood, string>> = {
  celebrate: "/landing/papa-celebrate.png",
  warm: "/landing/papa-warm.png",
  thoughtful: "/landing/papa-thoughtful.png",
  proud: "/landing/papa-proud.png",
  caring: "/landing/papa-caring.png",
  blessed: "/landing/papa-blessed.png",
  curious: "/landing/papa-curious.png",
  loving: "/landing/papa-loving.png",
};

const CARD_W = 420;
const PAD = 8; // spotlight padding around a target

function visibleTarget(selector: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return nodes.find((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
}

// How long a step stays on screen before auto-advancing — scaled to how much
// there is to read, with a comfortable floor and ceiling. Kept snappy so the
// walkthrough feels like a brisk video; pause/prev/next give full control.
function stepDuration(step: PageTourStep): number {
  const words = `${step.title} ${step.body}`.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(5600, Math.max(2600, 900 + words * 160));
}

// Resolve the tour for a route. Detail pages (/asset-intelligence/<slug>) share
// one "asset-detail" walkthrough rather than a per-slug entry.
function resolveTour(pathname: string): { key: string; steps: PageTourStep[] } | null {
  if (pathname.startsWith("/asset-intelligence/") && pathname !== "/asset-intelligence") {
    return { key: "asset-detail", steps: PAGE_TOURS["asset-detail"] };
  }
  const steps = PAGE_TOURS[pathname];
  return steps ? { key: pathname, steps } : null;
}

/**
 * A single-page spotlight walkthrough that plays like a short video: Papa moves
 * himself from one part of the page to the next, no clicking required. A scrubber
 * shows time-to-next; play/pause, prev/next and replay give full manual control.
 * Modeled on PapaTour's overlay, minus the cross-route navigation.
 */
function PageTourOverlay({ steps, onClose, numberOffset = 0, numberTotal }: { steps: PageTourStep[]; onClose: () => void; numberOffset?: number; numberTotal?: number }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [primaryRect, setPrimaryRect] = useState<DOMRect | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const elapsedRef = useRef(0);          // ms watched on the current step (survives pause)
  const lastTickRef = useRef(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const total = steps.length;
  // Displayed counter can span a multi-page journey (Discover → detail card):
  // numberOffset shifts the shown number, numberTotal is the grand total.
  const shownTotal = numberTotal ?? total;
  const shownIndex = numberOffset + stepIndex + 1;
  const duration = step ? stepDuration(step) : 0;

  const anchored = Boolean(step?.target) && primaryRect != null;
  const showCard = Boolean(step) && (!step!.target || anchored || timedOut);
  const running = mounted && playing && showCard && !finished;

  useEffect(() => { setMounted(true); }, []);

  // Follow a selector's action. If it (or its ancestor) is an internal link, use
  // the router for a client-side transition; otherwise just click it.
  const fireClick = useCallback((selector: string) => {
    const el = visibleTarget(selector);
    if (!el) return;
    const link = el.closest("a[href]") as HTMLAnchorElement | null;
    const href = link?.getAttribute("href");
    if (href && href.startsWith("/") && !href.startsWith("//")) { router.push(href); return; }
    el.click();
  }, [router]);

  // Reaching the end: a step may hand off to another page (endClick) and flag
  // that page to auto-start its own tour, so the walkthrough flows across the
  // route change like one continuous video. Otherwise stop on a replay card.
  const finishTour = useCallback(() => {
    const last = steps[steps.length - 1];
    if (last?.endClick) {
      if (last.flagOnEnd) { try { window.sessionStorage.setItem(last.flagOnEnd, "1"); } catch { /* ignore */ } }
      onClose();
      fireClick(last.endClick);
      return;
    }
    setFinished(true);
    setPlaying(false);
  }, [steps, onClose, fireClick]);

  // Interactive steps: open a dialog/panel when the step begins so the spotlight
  // can land on live content, and close it again when the step ends.
  useEffect(() => {
    if (step?.openClick) visibleTarget(step.openClick)?.click();
    return () => { if (step?.closeClick) visibleTarget(step.closeClick)?.click(); };
  }, [step]);

  // Acquire the target on the page. The card stays hidden until the target is
  // found (so it never jumps from centered to anchored), and we wait for the
  // smooth-scroll to settle before locking the spotlight.
  useEffect(() => {
    setTimedOut(false);
    if (!step?.target) { setPrimaryRect(null); return; } // centered step
    setPrimaryRect(null);

    let cancelled = false;
    let tries = 0;
    const settleAndSet = (el: HTMLElement) => {
      let last = NaN;
      let stable = 0;
      let frames = 0;
      const settle = () => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        frames += 1;
        if (Math.abs(r.top - last) < 0.5) stable += 1; else stable = 0;
        last = r.top;
        if (stable >= 2 || frames > 40) { setPrimaryRect(r); return; }
        requestAnimationFrame(settle);
      };
      requestAnimationFrame(settle);
    };
    const tick = () => {
      if (cancelled) return;
      const el = visibleTarget(step.target!);
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); settleAndSet(el); return; }
      tries += 1;
      if (tries > 40) { setTimedOut(true); return; } // ~6s → graceful centered fallback
      window.setTimeout(tick, 150);
    };
    tick();
    return () => { cancelled = true; };
  }, [step, stepIndex]);

  // Keep the spotlight glued on scroll/resize and as content streams in.
  useEffect(() => {
    if (!step?.target) return;
    const update = () => { const el = visibleTarget(step.target!); if (el) setPrimaryRect(el.getBoundingClientRect()); };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const iv = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(iv);
    };
  }, [step]);

  // Fresh step → reset the watched-time and the scrubber to empty.
  useEffect(() => {
    elapsedRef.current = 0;
    if (progressBarRef.current) progressBarRef.current.style.width = "0%";
  }, [stepIndex]);

  // The autoplay clock. Advances when the scrubber fills; on the last step it
  // stops on a "replay / done" card instead of closing abruptly. The scrubber is
  // driven imperatively (a ref) so it stays 60fps-smooth without re-rendering the
  // whole overlay each frame. dt is clamped so a backgrounded tab doesn't jump.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    lastTickRef.current = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - lastTickRef.current, 100);
      lastTickRef.current = now;
      elapsedRef.current += dt;
      const p = Math.min(1, elapsedRef.current / duration);
      if (progressBarRef.current) progressBarRef.current.style.width = `${p * 100}%`;
      if (p >= 1) {
        if (stepIndex >= total - 1) finishTour();
        else setStepIndex(stepIndex + 1);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, stepIndex, total, duration, finishTour]);

  const goNext = useCallback(() => {
    if (stepIndex >= total - 1) finishTour();
    else setStepIndex(stepIndex + 1);
  }, [stepIndex, total, finishTour]);
  const goBack = useCallback(() => { setFinished(false); setStepIndex((i) => Math.max(0, i - 1)); }, []);
  const replay = useCallback(() => { setFinished(false); setStepIndex(0); setPlaying(true); }, []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  // Keyboard: space play/pause (or replay when finished), arrows to step, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " " || e.code === "Space") { e.preventDefault(); if (finished) replay(); else togglePlay(); }
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goBack, replay, togglePlay, finished]);

  if (!mounted || !step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: React.CSSProperties | undefined;
  if (anchored && primaryRect) {
    const r = primaryRect;
    const placeBelow = r.bottom + 300 < vh;
    const top = placeBelow ? r.bottom + 16 : Math.max(16, r.top - 300);
    const left = Math.min(Math.max(16, r.left + r.width / 2 - CARD_W / 2), vw - CARD_W - 16);
    cardStyle = { position: "fixed", top, left, width: Math.min(CARD_W, vw - 32) };
  }

  // Animate the native SVG x/y attributes (not a CSS transform) so the hole
  // masks correctly in every browser while still springing smoothly.
  const holeAnim = (r: DOMRect) => ({ attrX: r.left - PAD, attrY: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  const holeSpring = { type: "spring" as const, stiffness: 320, damping: 34 };

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="pointer-events-auto absolute inset-0">
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id="page-tour-mask">
              <rect x={0} y={0} width="100%" height="100%" fill="white" />
              {primaryRect ? <motion.rect initial={false} animate={holeAnim(primaryRect)} transition={holeSpring} rx={16} ry={16} fill="black" /> : null}
            </mask>
          </defs>
          <rect x={0} y={0} width="100%" height="100%" fill="rgba(15,23,42,0.66)" mask="url(#page-tour-mask)" />
          {primaryRect ? <motion.rect initial={false} animate={holeAnim(primaryRect)} transition={holeSpring} rx={16} ry={16} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2} /> : null}
        </svg>
      </div>

      <div className={cn("pointer-events-none absolute inset-0", !anchored && "flex items-center justify-center p-4")}>
        <AnimatePresence mode="wait">
          {showCard ? (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              style={cardStyle}
              className={cn("pointer-events-auto z-[101]", !anchored && "w-full max-w-[440px]")}
            >
              <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-2xl">
                <div className="flex items-start gap-4">
                  <motion.div
                    key={`${stepIndex}-img`}
                    className="shrink-0"
                    initial={{ scale: 0.9, rotate: -4 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={MOOD_IMAGE[step.mood || "warm"] || "/landing/papa-warm.png"}
                      alt=""
                      aria-hidden
                      className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/30"
                    />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold tracking-tight text-foreground">{step.title}</p>
                    <p className="mt-1.5 text-base leading-relaxed text-foreground/80">{step.body}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  {finished ? (
                    <>
                      <button type="button" onClick={replay} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
                        <RotateCcw className="h-4 w-4" /> Replay
                      </button>
                      <Button onClick={onClose}>Got it 👍</Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={togglePlay}
                          aria-label={playing ? "Pause" : "Play"}
                          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90"
                        >
                          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
                        </button>
                        <button
                          type="button"
                          onClick={goBack}
                          disabled={stepIndex === 0}
                          aria-label="Previous"
                          className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          aria-label="Next"
                          className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground tnum">{shownIndex} / {shownTotal}</span>
                        <button type="button" onClick={onClose} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">Skip</button>
                      </div>
                    </>
                  )}
                </div>

                {/* Video-style scrubber: fills as the step plays (driven imperatively). */}
                {!finished ? (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-border/60">
                    <div ref={progressBarRef} className="h-full w-0 bg-primary" />
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Route-aware launcher: shows a floating "Guide me" button on any page that has
 * a tour defined, and plays the walkthrough when tapped. Dropped once into
 * AppShell so every app page gets it for free.
 */
// The Discover walkthrough always ends by opening a detail card, so "Guide me"
// on Discover is really one journey spanning both pages. These lengths let the
// step counter run continuously (1/9 … 9/9) instead of restarting at the hop.
const DISCOVER_LEN = PAGE_TOURS["/asset-intelligence"]?.length ?? 0;
const DETAIL_LEN = PAGE_TOURS["asset-detail"]?.length ?? 0;
const DISCOVER_JOURNEY_TOTAL = DISCOVER_LEN + DETAIL_LEN;

export function PageGuide() {
  const pathname = usePathname();
  const onboardingTourActive = useTourStore((s) => s.active);
  const [open, setOpen] = useState(false);
  // True when the detail-page tour was auto-started as a continuation of the
  // Discover walkthrough (vs. opened standalone from the detail page's button).
  const [continuing, setContinuing] = useState(false);
  const resolved = resolveTour(pathname);
  const handleClose = useCallback(() => setOpen(false), []);

  // On navigation: close any running guide, but auto-start the detail-page tour
  // when the Discover walkthrough handed off to it (flag set), so it plays like
  // one continuous video. We only read the flag here (not clear it) so the
  // decision is identical across React Strict Mode's double-invoked effects.
  useEffect(() => {
    let auto = false;
    if (resolved?.key === "asset-detail") {
      try { auto = window.sessionStorage.getItem(ASSET_DETAIL_TOUR_FLAG) === "1"; } catch { /* ignore */ }
    }
    setContinuing(auto);
    setOpen(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Consume the hand-off flag once the tour is showing, so a later visit to a
  // detail page (not coming from Discover) doesn't auto-play it again.
  useEffect(() => {
    if (open) { try { window.sessionStorage.removeItem(ASSET_DETAIL_TOUR_FLAG); } catch { /* ignore */ } }
  }, [open]);

  if (!resolved) return null;

  // Continuous numbering across the Discover → detail-card journey.
  let numberOffset = 0;
  let numberTotal: number | undefined;
  if (resolved.key === "/asset-intelligence") {
    numberTotal = DISCOVER_JOURNEY_TOTAL;
  } else if (resolved.key === "asset-detail" && continuing) {
    numberOffset = DISCOVER_LEN;
    numberTotal = DISCOVER_JOURNEY_TOTAL;
  }

  return (
    <>
      {/* Don't compete with the one-time onboarding walkthrough. */}
      {!open && !onboardingTourActive ? (
        <button
          type="button"
          onClick={() => { setContinuing(false); setOpen(true); }}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-black/5 transition hover:bg-primary/90 hover:shadow-xl lg:bottom-6 lg:right-6"
          aria-label="Guide me through this page"
        >
          <Compass className="h-4 w-4" /> Guide me
        </button>
      ) : null}
      {open ? <PageTourOverlay key={resolved.key} steps={resolved.steps} onClose={handleClose} numberOffset={numberOffset} numberTotal={numberTotal} /> : null}
    </>
  );
}
