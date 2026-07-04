// Server-safe theme constants. Kept OUT of the "use client" theme-provider so the
// server-rendered inline theme script in app/layout.tsx can read the real string
// value. Importing a value from a "use client" module into a server component
// turns it into a client-reference stub, which corrupts the inline <script>.
export const THEME_STORAGE_KEY = "ai-investment-manager-theme";
