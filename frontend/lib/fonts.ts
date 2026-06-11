import { Caveat, Inter } from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const caveat = Caveat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-caveat" });

export const SCRIPT_FAMILY = "var(--font-caveat)";
export const SCRIPT_GREEN = "#138A3C";
