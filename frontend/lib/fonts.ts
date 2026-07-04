import { Caveat, Plus_Jakarta_Sans } from "next/font/google";

// Plus Jakarta Sans: a rounded, friendly geometric sans — approachable for
// first-time investors while still clean and modern.
export const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

// Caveat: the handwritten "AskPapa" voice for warm, human accents.
export const caveat = Caveat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-caveat" });

export const SCRIPT_FAMILY = "var(--font-caveat)";
export const SCRIPT_GREEN = "#138A3C";
