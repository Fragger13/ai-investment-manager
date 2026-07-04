import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { PapaTour } from "@/components/papa-tour";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { caveat, sans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskPapa",
  description: "Clear, practical guidance for building your financial plan",
  icons: {
    icon: "/landing/papa-avatar-round.png",
    apple: "/landing/papa-avatar-round.png"
  }
};

const themeScript = `
  (function () {
    try {
      var storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
      var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.dataset.theme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${caveat.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <PapaTour />
        </ThemeProvider>
      </body>
    </html>
  );
}
