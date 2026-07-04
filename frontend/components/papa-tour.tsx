"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTourStore } from "@/store/tour-store";
import type { PapaMood } from "@/app/onboarding/_components/papa-bubble";

// Reuse the same Papa mood artwork the onboarding bubble uses.
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

type Step = {
  route: string;
  target?: string; // primary [data-tour="..."] the card points at; omitted → big centered card
  navTarget?: string; // a sidebar/bottom-bar tab spotlit alongside, so users learn to navigate
  title: string;
  body: string;
  mood: PapaMood;
  hero?: boolean; // large, centered "moment" card (welcome / finale)
};

// One step per tab: the side-panel tab is spotlit together with that tab's
// content, so navigation and the tour of the tab happen in the same beat.
const STEPS: Step[] = [
  { route: "/dashboard", hero: true, title: "Welcome to the family, beta 👋", body: "Your profile is done, shabaash! Give me a minute and I'll walk you around the whole place. No finance degree needed, I promise.", mood: "celebrate" },
  { route: "/dashboard", target: "[data-tour='available']", title: "What you can invest", body: "This number is what you've got to put to work this month. Everything we do is built around it.", mood: "warm" },
  { route: "/dashboard", target: "[data-tour='health']", title: "Your money health", body: "A quick read on how you're doing: savings, safety net, debt. If something slips, I'll tap you on the shoulder.", mood: "thoughtful" },
  { route: "/recommendations", target: "[data-tour='plan-item']", navTarget: "[data-tour='nav-plan']", title: "Your plan lives here", body: "Tap Plan in the menu and you land here, your top money moves for the month. Here's one I've picked for you.", mood: "proud" },
  { route: "/recommendations", target: "[data-tour='plan-action']", title: "How you actually do it", body: "Like a pick? Hit Take Action, set the amount, a monthly SIP or a one-time lump sum, and it's logged. That's you, moving forward.", mood: "caring" },
  { route: "/goals", target: "[data-tour='goal-link']", navTarget: "[data-tour='nav-goals']", title: "Connect money to your dreams", body: "Tap Goals to see what you're saving for. The clever bit, beta: link an investment you already own to a goal, and it fills up on its own as that money grows. Hit Link holdings to connect one.", mood: "loving" },
  { route: "/portfolio", target: "[data-tour='networth']", navTarget: "[data-tour='nav-portfolio']", title: "Everything you own", body: "Tap Portfolio in the menu for your full net worth in one place, plus what your plan is quietly building over time.", mood: "blessed" },
  { route: "/asset-intelligence", target: "[data-tour='discover-pick']", navTarget: "[data-tour='nav-discover']", title: "Discover, for when you're ready", body: "Tap Discover for hand-picked fund and stock ideas like this one. Save the ones you like. It's for when you want to go a little deeper.", mood: "curious" },
  { route: "/chat", target: "[data-tour='nav-papa']", title: "And me, Ask Papa", body: "This opens a chat with me. A goal, a big purchase, a 'should I?', ask anything, day or night. That's what I'm here for.", mood: "loving" },
  { route: "/chat", hero: true, title: "That's a wrap, shabaash! 🎉", body: "Arre, I don't trust this generation's memory. One scroll and poof. So if any of this slips, the whole tour is waiting for you in Help. Now go, beta. Let compound interest be the only thing growing behind your back. 💚", mood: "celebrate" },
];

const CARD_W = 420;
const PAD = 8; // spotlight padding around a target

function visibleTarget(selector: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return nodes.find((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null;
}

/** Falling confetti for the finale — pure framer-motion, no extra deps. */
function Confetti() {
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 140,
        rotate: (Math.random() - 0.5) * 720,
        color: ["#22c55e", "#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#ec4899"][i % 7],
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -40, x: 0, opacity: 0, rotate: 0 }}
          animate={{ y: vh + 60, x: p.drift, opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: 0.5, ease: "easeIn" }}
          style={{ position: "absolute", top: 0, left: `${p.left}%`, width: p.w, height: p.h, backgroundColor: p.color, borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

export function PapaTour() {
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const active = useTourStore((s) => s.active);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const seen = useTourStore((s) => s.seen);
  const start = useTourStore((s) => s.start);
  const stop = useTourStore((s) => s.stop);
  const setStep = useTourStore((s) => s.setStep);

  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [primaryRect, setPrimaryRect] = useState<DOMRect | null>(null);
  const [navRect, setNavRect] = useState<DOMRect | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const step = active ? STEPS[Math.min(stepIndex, STEPS.length - 1)] : null;
  const total = STEPS.length;
  const isLast = stepIndex >= total - 1;
  const hero = Boolean(step?.hero);
  const onRoute = Boolean(step) && step!.route === pathname;

  useEffect(() => { setMounted(true); }, []);

  // Auto-start once, right after onboarding, on the home screen.
  useEffect(() => {
    if (active || seen) return;
    if (pathname !== "/dashboard" || !onboardingComplete) return;
    const t = window.setTimeout(() => start(), 800);
    return () => window.clearTimeout(t);
  }, [active, seen, pathname, onboardingComplete, start]);

  // Drive cross-route navigation when a step lives on another page.
  useEffect(() => {
    if (!step) return;
    if (step.route !== pathname) router.push(step.route);
  }, [step, pathname, router]);

  // Acquire the target(s) on the current page. The card stays hidden until the
  // primary target is found (so it never jumps from centered to anchored), and
  // we wait for the smooth-scroll to settle before locking the spotlight.
  useEffect(() => {
    if (!step || step.route !== pathname) { setPrimaryRect(null); setNavRect(null); setTimedOut(false); return; }
    setTimedOut(false);
    // Nav tab is in a fixed bar, so its rect is stable — read it immediately.
    setNavRect(step.navTarget ? visibleTarget(step.navTarget)?.getBoundingClientRect() ?? null : null);
    if (!step.target) { setPrimaryRect(null); return; } // hero / centered step
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
  }, [step, pathname, stepIndex]);

  // Keep the spotlight glued on scroll/resize and re-acquire as content streams
  // in (e.g. recommendations finishing loading moves the spotlighted card).
  useEffect(() => {
    if (!step || step.route !== pathname) return;
    const update = () => {
      if (step.target) { const el = visibleTarget(step.target); if (el) setPrimaryRect(el.getBoundingClientRect()); }
      if (step.navTarget) { const el = visibleTarget(step.navTarget); setNavRect(el ? el.getBoundingClientRect() : null); }
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const iv = window.setInterval(update, 500);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(iv);
    };
  }, [step, pathname]);

  // Esc to skip.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") stop(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stop]);

  const next = useCallback(() => {
    if (isLast) { stop(); router.push("/recommendations"); } // end on their Plan, ready to act
    else setStep(stepIndex + 1);
  }, [isLast, stop, setStep, stepIndex, router]);
  const back = useCallback(() => setStep(stepIndex - 1), [setStep, stepIndex]);

  if (!mounted || !active || !step) return null;

  const anchored = !hero && primaryRect != null;
  const showCard = hero || anchored || (timedOut && onRoute);

  const holes: { id: string; rect: DOMRect }[] = [];
  if (primaryRect) holes.push({ id: "primary", rect: primaryRect });
  if (navRect) holes.push({ id: "nav", rect: navRect });

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

  // attrX/attrY animate the native SVG x/y attributes (not a CSS transform), so the
  // holes mask correctly in every browser while still springing smoothly.
  const holeAnim = (r: DOMRect) => ({ attrX: r.left - PAD, attrY: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  const holeSpring = { type: "spring" as const, stiffness: 320, damping: 34 };

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Dimmed overlay with one or two spotlight holes punched via an SVG mask. */}
      <div className="pointer-events-auto absolute inset-0">
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id="papa-tour-mask">
              <rect x={0} y={0} width="100%" height="100%" fill="white" />
              {holes.map((h) => (
                <motion.rect key={h.id} initial={false} animate={holeAnim(h.rect)} transition={holeSpring} rx={16} ry={16} fill="black" />
              ))}
            </mask>
          </defs>
          <rect x={0} y={0} width="100%" height="100%" fill="rgba(15,23,42,0.66)" mask="url(#papa-tour-mask)" />
          {holes.map((h) => (
            <motion.rect key={`${h.id}-ring`} initial={false} animate={holeAnim(h.rect)} transition={holeSpring} rx={16} ry={16} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
          ))}
        </svg>
      </div>

      {hero && isLast ? <Confetti /> : null}

      {/* Papa card — anchored beside the spotlight, or centered for hero / fallback.
          AnimatePresence stays mounted so the card fades out smoothly between steps. */}
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
              className={cn("pointer-events-auto z-[101]", !anchored && (hero ? "w-full max-w-[560px]" : "w-full max-w-[420px]"))}
            >
              <div className={cn("rounded-3xl border border-border bg-surface shadow-2xl", hero ? "p-8 text-center md:p-10" : "p-6")}>
                <div className={cn("flex gap-4", hero ? "flex-col items-center" : "items-start")}>
                  <motion.div
                    className="shrink-0"
                    animate={hero ? { scale: [1, 1.06, 1] } : undefined}
                    transition={hero ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={MOOD_IMAGE[step.mood] || "/landing/papa-warm.png"}
                      alt=""
                      aria-hidden
                      className={cn("rounded-full object-cover ring-2 ring-primary/30", hero ? "h-24 w-24" : "h-14 w-14")}
                    />
                  </motion.div>
                  <div className={hero ? "" : "min-w-0"}>
                    <p className={cn("font-bold tracking-tight text-foreground", hero ? "text-2xl md:text-3xl" : "text-lg")}>{step.title}</p>
                    <p className={cn("leading-relaxed text-foreground/80", hero ? "mt-2.5 text-lg" : "mt-1.5 text-base")}>{step.body}</p>
                  </div>
                </div>

                {hero ? (
                  <div className="mt-7 flex flex-col items-center gap-3">
                    <div className="flex items-center justify-center gap-2">
                      {stepIndex > 0 ? <Button variant="outline" size="lg" onClick={back}>Back</Button> : null}
                      <Button size="lg" onClick={next}>{isLast ? "Let's go! 🎉" : "Show me around 👀"}</Button>
                    </div>
                    <button type="button" onClick={stop} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
                      {isLast ? "Close" : "Skip the tour"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button type="button" onClick={stop} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">Skip</button>
                    <div className="flex items-center gap-2">
                      <span className="mr-1 text-sm font-medium text-muted-foreground tnum">{stepIndex + 1} / {total}</span>
                      {stepIndex > 0 ? <Button variant="outline" onClick={back}>Back</Button> : null}
                      <Button onClick={next}>{isLast ? "Finish" : "Next"}</Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
}
