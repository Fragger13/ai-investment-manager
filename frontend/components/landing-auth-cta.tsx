"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

/**
 * The landing-page auth cluster, aware of the visitor's session:
 *  - logged out (and pre-hydrate) → "Log in" + "Get Started"
 *  - signed in, mid-onboarding    → "Continue where you left off"
 *  - signed in and onboarded      → "My dashboard" dropdown (open / log out)
 * `className` styles the primary (green) button so it matches the header.
 */
export function LandingAuthCta({ className }: { className: string }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const token = useAuthStore((state) => state.token);
  const onboardingComplete = useAuthStore((state) => state.onboardingComplete);
  const logout = useAuthStore((state) => state.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const signedIn = hasHydrated && Boolean(token);

  // Signed in and onboarded → dashboard dropdown with a log-out option.
  if (signedIn && onboardingComplete) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className={className}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <LayoutDashboard className="h-4 w-4" /> My dashboard
          <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
        {menuOpen ? (
          <div role="menu" className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-lg">
            <Link
              role="menuitem"
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#0F172A] transition hover:bg-[#F3F4F6]"
            >
              <LayoutDashboard className="h-4 w-4" /> Open dashboard
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); logout(); }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#B42318] transition hover:bg-[#FEF3F2]"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // Signed in but still onboarding → resume link.
  if (signedIn) {
    return (
      <Link href="/onboarding" className={className}>
        Continue where you left off <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  // Logged out (also the pre-hydration default) → Log in + Get Started.
  return (
    <>
      <Link
        href="/login"
        className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-bold text-[#138A3C] ring-1 ring-[#138A3C]/30 transition hover:bg-[#138A3C]/5"
      >
        Log in
      </Link>
      <Link href="/register" className={className}>
        Get Started <ArrowRight className="h-4 w-4" />
      </Link>
    </>
  );
}
