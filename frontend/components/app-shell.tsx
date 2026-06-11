"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, CircleDollarSign, Compass, Home, LogOut, NotebookTabs, PieChart, Target, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/recommendations", label: "Plan", icon: NotebookTabs },
  { href: "/asset-intelligence", label: "Discover", icon: Compass },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/chat", label: "Ask Papa!", icon: Bot },
];

export function AppShell({ children, sidebarExtra }: { children: React.ReactNode; sidebarExtra?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-card max-w-md">
          <CircleDollarSign className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-semibold">Session required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Log in or create an account to continue building your financial plan.</p>
          <Button className="mt-6" onClick={() => router.push("/login")}>Login</Button>
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
      <aside className="sidebar-shell fixed left-0 top-0 hidden h-screen w-64 flex-col p-5 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/papa-avatar.png"
            alt=""
            aria-hidden
            className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
          <span className="leading-tight">
            <span className="block text-base font-semibold text-foreground">AskPapa</span>
            <span className="block text-[11px] text-muted-foreground">Your financial buddy</span>
          </span>
        </Link>

        <nav className="mt-8 flex-1 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {sidebarExtra ? <div className="my-3">{sidebarExtra}</div> : null}

        <div className="mt-3 border-t border-border pt-4">
          <Link href="/onboarding?mode=edit" className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-surface-hover">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-foreground">{user?.name || "Your profile"}</span>
              <span className="block text-[11px] text-muted-foreground">View Profile</span>
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
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>
      <nav className="sticky top-0 z-40 flex gap-2 overflow-x-auto border-b border-border bg-surface px-4 py-3 lg:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={cn("flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition", active ? "bg-primary text-primary-foreground" : "bg-surface-soft text-muted-foreground")}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <main className="px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
