"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BellRing, Bot, CircleDollarSign, FileSearch, Gauge, Landmark, LineChart, LogOut, PieChart, Target, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/expenses", label: "Expenses", icon: WalletCards },
  { href: "/recommendations", label: "Recommendations", icon: BarChart3 },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/documents", label: "Documents", icon: FileSearch },
  { href: "/market", label: "Market", icon: LineChart },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/chat", label: "AI Chat", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="glass max-w-md rounded-lg p-8 text-center">
          <CircleDollarSign className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-semibold">Session required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Login or create an account to enter your financial command center.</p>
          <Button className="mt-6" onClick={() => router.push("/login")}>Login</Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-[#071016]/[0.82] p-5 backdrop-blur-xl lg:block">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">AI Investment</span>
            <span className="block text-xs text-muted-foreground">Manager</span>
          </span>
        </Link>
        <nav className="mt-10 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition",
                  active ? "bg-primary/[0.12] text-primary" : "text-muted-foreground hover:bg-white/[0.07] hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            className="mt-3 w-full justify-start"
            variant="ghost"
            onClick={() => {
              logout();
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>
      <main className="px-4 py-5 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
