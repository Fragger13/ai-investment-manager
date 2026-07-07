"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, CircleDollarSign, Compass, Home, LifeBuoy, LogOut, NotebookTabs, PieChart, Target, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { PageGuide } from "@/components/page-tour";
import { Disclaimer } from "@/components/disclaimer";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/recommendations", label: "Plan", icon: NotebookTabs },
  { href: "/portfolio", label: "Wallet", icon: PieChart },
  { href: "/asset-intelligence", label: "Discover", icon: Compass },
  { href: "/chat", label: "Papa", icon: Bot },
  { href: "/help", label: "Help", icon: LifeBuoy },
];

// Anchors the Papa tour spotlights so it can teach users how to navigate.
const TOUR_ANCHORS: Record<string, string> = {
  "/goals": "nav-goals",
  "/recommendations": "nav-plan",
  "/portfolio": "nav-portfolio",
  "/asset-intelligence": "nav-discover",
  "/chat": "nav-papa",
};

export function AppShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-card max-w-md">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <CircleDollarSign className="h-7 w-7 text-primary" />
          </span>
          <h1 className="text-2xl font-bold">Hey, let&apos;s log you in 👋</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in or create an account to keep building your money plan.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => router.push("/login")}>Log in</Button>
        </div>
      </main>
    );
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sidebar-shell fixed left-0 top-0 hidden h-screen w-64 flex-col p-5 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl px-2 py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/papa-avatar.png"
            alt=""
            aria-hidden
            className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/30 shadow-sm"
          />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold text-foreground">AskPapa</span>
            <span className="block whitespace-nowrap text-[0.5625rem] font-medium tracking-tight text-muted-foreground">Your Papa for all things Finance</span>
          </span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={TOUR_ANCHORS[item.href]}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} />
                {item.label === "Papa" ? "Ask Papa!" : item.label === "Wallet" ? "Portfolio" : item.label}
              </Link>
            );
          })}
        </nav>

        {sidebarExtra ? <div className="my-3">{sidebarExtra}</div> : null}

        <div className="mt-3 border-t border-border pt-4">
          <Link href="/onboarding?mode=edit" className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-surface-hover">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-foreground">{user?.name || "Your profile"}</span>
              <span className="block text-[0.6875rem] text-muted-foreground">View profile</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start gap-3 px-3 text-muted-foreground"
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar (brand only) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/papa-avatar.png" alt="" aria-hidden className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/30" />
          <span className="text-base font-extrabold text-foreground">AskPapa</span>
        </Link>
        <Link href="/onboarding?mode=edit" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserRound className="h-4 w-4" />
        </Link>
      </header>

      <main className="px-4 py-6 pb-28 lg:ml-64 lg:px-8 lg:py-8 lg:pb-8">
        <div className="mx-auto max-w-7xl">{children}</div>
        {/* Baseline risk / not-advice disclaimer on every app surface. Chat and
            Discover already carry their own contextual lines, so skip Chat where
            the layout is a fixed-height column. */}
        {pathname !== "/chat" ? (
          <div className="mx-auto mt-10 max-w-7xl border-t border-border pt-5">
            <Disclaimer />
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <Link href="/terms" className="hover:underline">Terms</Link>
              <span aria-hidden>·</span>
              <Link href="/privacy" className="hover:underline">Privacy</Link>
              <span aria-hidden>·</span>
              <a href="mailto:noreply@askpapa.in" className="hover:underline">Contact</a>
            </p>
          </div>
        ) : null}
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} data-tour={TOUR_ANCHORS[item.href]} className="group flex flex-1 flex-col items-center justify-center gap-1 py-2">
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition",
                    active ? "bg-accent text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" />
                </span>
                <span className={cn("text-[0.625rem] font-bold leading-none", active ? "text-foreground" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Per-page "Guide me" walkthrough launcher (route-aware). */}
      <PageGuide />

      {/* Occasional, dismissible star-rating prompt (self-paced via localStorage) */}
      <FeedbackPrompt />
    </div>
  );
}
