import type { Metadata } from "next";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { PapaTour } from "@/components/papa-tour";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { caveat, sans } from "@/lib/fonts";
import "./globals.css";

const SITE_URL = "https://www.askpapa.in";
// GA4 measurement ID. This is a public, client-side identifier (it ships in the
// page source), so it is safe to keep in the repo. Analytics only load in a
// production build, so local `next dev` never pollutes the reporting.
const GA_MEASUREMENT_ID = "G-FYEQLQZBDK";
const ANALYTICS_ENABLED = process.env.NODE_ENV === "production";
const SITE_DESCRIPTION =
  "AskPapa makes where to invest and how much a no brainer. Tell Papa about your life once and get a clear plan in plain language, starting from just ₹500 a month.";
const SOCIAL_DESCRIPTION =
  "Where to invest and how much, made a no brainer. Tell Papa about your life once and get a clear money plan in plain language. Start from ₹500 a month.";

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

// Schema.org data so Google can render the result with the right site name,
// logo and description (instead of guessing). Organization + WebSite are the
// two signals that most affect the search snippet and knowledge panel.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "AskPapa",
      url: SITE_URL,
      logo: `${SITE_URL}/landing/papa-avatar-round.png`,
      description: SITE_DESCRIPTION
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "AskPapa",
      url: SITE_URL,
      inLanguage: "en-IN",
      publisher: { "@id": `${SITE_URL}/#organization` }
    }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${caveat.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <PapaTour />
        </ThemeProvider>
        {ANALYTICS_ENABLED ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
