/**
 * AskPapa design tokens, mirrored from frontend/app/globals.css so the mobile
 * app reads as the same product as the web app. React Native accepts hsl()
 * color strings, so the values are kept verbatim from the web CSS variables.
 * The app is light-only for now (matching the web onboarding/product decision).
 */

export const colors = {
  background: "hsl(36, 100%, 97%)", // warm cream
  surface: "hsl(0, 0%, 100%)",
  surfaceSoft: "hsl(220, 24%, 95%)",
  surfaceHover: "hsl(220, 20%, 90%)",
  foreground: "hsl(222, 28%, 13%)", // soft ink
  textSecondary: "hsl(222, 20%, 30%)",
  mutedForeground: "hsl(222, 14%, 46%)",
  card: "hsl(0, 0%, 100%)",
  primary: "hsl(157, 84%, 31%)", // money green
  primaryDeep: "hsl(160, 86%, 19%)", // gradient end for hero surfaces
  primaryForeground: "hsl(0, 0%, 100%)",
  accent: "hsl(157, 60%, 92%)", // mint tint
  accentForeground: "hsl(158, 78%, 23%)",
  destructive: "hsl(6, 88%, 61%)",
  border: "hsl(36, 30%, 86%)",
  input: "hsl(36, 28%, 82%)",
  positive: "hsl(157, 62%, 37%)",
  positiveSoft: "hsl(157, 60%, 92%)",
  warning: "hsl(38, 96%, 50%)",
  warningForeground: "hsl(30, 84%, 30%)",
  warningSoft: "hsl(44, 100%, 90%)",
  negative: "hsl(6, 88%, 61%)",
  negativeForeground: "hsl(4, 74%, 42%)",
  negativeSoft: "hsl(8, 100%, 95%)",
  info: "hsl(252, 92%, 67%)",
  infoForeground: "hsl(252, 58%, 45%)",
  infoSoft: "hsl(252, 100%, 96%)",
} as const;

// Radii follow the web Tailwind scale (rounded-md .. rounded-3xl).
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  "2xl": 24,
  "3xl": 28,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;

// Soft, borderless card shadow. Cards sit on cream with depth, not borders.
export const cardShadow = {
  shadowColor: "hsl(160, 40%, 20%)",
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

// Stronger lift for the hero header and floating elements.
export const heroShadow = {
  shadowColor: "hsl(160, 86%, 19%)",
  shadowOpacity: 0.28,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 8,
} as const;
