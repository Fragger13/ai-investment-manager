"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

export type HintLink = { href: string; label: string };

const TOOLTIP_WIDTH = 264;

// Pointer events the tooltip must swallow so a Radix modal dialog (used by the
// onboarding bucket dialogs) doesn't treat a click on the portaled tooltip as an
// "outside" interaction and dismiss itself before a link inside can be clicked.
const DISMISS_EVENTS = ["pointerdown", "mousedown", "touchstart"] as const;

/**
 * A small "?" icon that explains a field in plain language. Opens on hover
 * (desktop) and tap/click (mobile), and can carry an external link (e.g. the
 * EPFO passbook site). Rendered in a portal so it is never clipped by the
 * `overflow-y-auto` dialogs the onboarding flow uses.
 */
export function HelpHint({ text, link, label }: { text: React.ReactNode; link?: HintLink; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.left + r.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));
    setPos({ top: r.bottom + 8, left });
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    if (pinned) return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  // Stop dismiss-events at the tooltip so a parent Radix modal doesn't close on
  // interaction. Attached natively (not via React props) because Radix listens
  // on `document`, and the tooltip is portaled outside the dialog's DOM subtree.
  const stopEvent = useCallback((e: Event) => e.stopPropagation(), []);
  const setTipNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (tipRef.current) {
        DISMISS_EVENTS.forEach((ev) => tipRef.current!.removeEventListener(ev, stopEvent));
      }
      tipRef.current = node;
      if (node) {
        DISMISS_EVENTS.forEach((ev) => node.addEventListener(ev, stopEvent));
      }
    },
    [stopEvent]
  );

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setPinned(false); }
    };
    const onDown = (e: MouseEvent) => {
      if (!pinned) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setOpen(false);
      setPinned(false);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, pinned]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label ? `What is "${label}"?` : "More information"}
        aria-expanded={open}
        onClick={() => {
          cancelClose();
          // A click should pin the tooltip open so its link is reachable. Only a
          // second click (when already pinned) closes it. Otherwise clicking a
          // hover-opened tooltip would immediately dismiss it.
          if (pinned) {
            setPinned(false);
            setOpen(false);
          } else {
            setPinned(true);
            setOpen(true);
          }
        }}
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-[#9CA3AF] transition hover:text-[#138A3C] focus:outline-none focus-visible:text-[#138A3C]"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={setTipNode}
              role="tooltip"
              // pointerEvents auto: re-enable interaction even when a Radix modal
              // has set `body { pointer-events: none }` on everything else.
              style={{ position: "fixed", top: pos.top, left: pos.left, width: TOOLTIP_WIDTH, pointerEvents: "auto" }}
              className="z-[200] rounded-xl border border-[#E5E7EB] bg-white p-3 text-left text-[0.78125rem] font-normal leading-5 text-[#374151] shadow-2xl"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {text}
              {link ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-semibold text-[#138A3C] underline underline-offset-2"
                >
                  {link.label} ↗
                </a>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
