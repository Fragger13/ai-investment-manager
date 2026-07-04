"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export type Theme = "light" | "dark";

export { THEME_STORAGE_KEY };

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const pathname = usePathname();
  // Onboarding is a bright, light-only funnel that isn't wired for dark tokens,
  // so we always render it in light (without touching the saved preference) and
  // hide the toggle there. It restores the user's theme on leaving.
  const onOnboarding = Boolean(pathname && pathname.startsWith("/onboarding"));

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    // Friendly & Bright defaults to light for first-time users; an explicit
    // saved choice always wins.
    const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "light";
    setThemeState(nextTheme);
  }, []);

  // Apply the effective theme: forced light on onboarding, the saved theme
  // everywhere else. Re-runs when the route or the saved theme changes. The
  // data-onboarding marker lets globals.css scope onboarding-only rules
  // (e.g. pure-black field text) even to dialogs that portal to <body>.
  useEffect(() => {
    applyTheme(onOnboarding ? "light" : theme);
    document.documentElement.dataset.onboarding = onOnboarding ? "true" : "false";
  }, [onOnboarding, theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [setTheme, theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {!onOnboarding ? (
        <button
          type="button"
          data-tour="theme-toggle"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={toggleTheme}
          className="fixed right-4 top-4 z-[100] grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-foreground shadow-card transition-colors duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {theme === "dark" ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
          <span className="sr-only">Switch color theme</span>
        </button>
      ) : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
