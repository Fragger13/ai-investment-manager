import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-elevated": "hsl(var(--surface-elevated))",
        "surface-soft": "hsl(var(--surface-soft))",
        "surface-hover": "hsl(var(--surface-hover))",
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        positive: "hsl(var(--positive))",
        "positive-foreground": "hsl(var(--positive-foreground))",
        "positive-soft": "hsl(var(--positive-soft))",
        warning: "hsl(var(--warning))",
        "warning-foreground": "hsl(var(--warning-foreground))",
        "warning-soft": "hsl(var(--warning-soft))",
        negative: "hsl(var(--negative))",
        "negative-foreground": "hsl(var(--negative-foreground))",
        "negative-soft": "hsl(var(--negative-soft))",
        info: "hsl(var(--info))",
        "info-foreground": "hsl(var(--info-foreground))",
        "info-soft": "hsl(var(--info-soft))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        coral: "hsl(var(--coral))",
        "coral-foreground": "hsl(var(--coral-foreground))",
        "coral-soft": "hsl(var(--coral-soft))",
        sun: "hsl(var(--sun))",
        "sun-foreground": "hsl(var(--sun-foreground))",
        "sun-soft": "hsl(var(--sun-soft))",
        grape: "hsl(var(--grape))",
        "grape-foreground": "hsl(var(--grape-foreground))",
        "grape-soft": "hsl(var(--grape-soft))"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        script: ["var(--font-caveat)", "ui-sans-serif", "cursive"]
      },
      boxShadow: {
        glow: "0 0 44px hsl(var(--primary) / 0.28)",
        card: "var(--card-shadow)",
        pop: "var(--shadow-pop)"
      },
      borderRadius: {
        "3xl": "1.75rem",
        "2xl": "1.5rem",
        xl: "1.125rem",
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
