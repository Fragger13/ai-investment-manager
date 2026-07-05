import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { PapaTour } from "@/components/papa-tour";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { caveat, sans } from "@/lib/fonts";
import "./globals.css";

const SITE_URL = "https://www.askpapa.in";
const SITE_DESCRIPTION =
  "AskPapa is your friendly AI money mentor for India. Build a clear financial plan, set goals, track your portfolio, and make confident money decisions, all explained in simple language.";
const SOCIAL_DESCRIPTION =
  "Your friendly AI money mentor for India. A clear financial plan, goals, and portfolio tracking, all explained in simple language.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AskPapa: Your Papa for all things Finance",
    template: "%s · AskPapa"
  },
  description: SITE_DESCRIPTION,
  applicationName: "AskPapa",
  keywords: [
    "AskPapa",
    "financial planning India",
    "AI investment guidance",
    "personal finance",
    "mutual funds",
    "SIP",
    "retirement planning",
    "goal planning"
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "AskPapa",
    title: "AskPapa: Your Papa for all things Finance",
    description: SOCIAL_DESCRIPTION,
    locale: "en_IN",
    images: [{ url: "/landing/papa-avatar-round.png", width: 280, height: 280, alt: "AskPapa" }]
  },
  twitter: {
    card: "summary",
    title: "AskPapa: Your Papa for all things Finance",
    description: SOCIAL_DESCRIPTION,
    images: ["/landing/papa-avatar-round.png"]
  },
  icons: {
    icon: "/landing/papa-avatar-round.png",
    apple: "/landing/papa-avatar-round.png"
  }
};

// Runs before first paint so the theme and the toggle's visibility are correct
// on the very first frame — no flash. The landing page ("/") and onboarding are
// hardcoded light-only, so we force light there and hide the toggle up front
// (usePathname() is null during static prerender, so the React layer alone
// would briefly render the button before hydration removes it).
const themeScript = `
  (function () {
    try {
      var path = window.location.pathname;
      var lightOnly = path === "/" || path.indexOf("/onboarding") === 0;
      var storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
      var theme = (!lightOnly && (storedTheme === "light" || storedTheme === "dark")) ? storedTheme : "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.dataset.theme = theme;
      if (lightOnly) document.documentElement.dataset.hideThemeToggle = "true";
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
