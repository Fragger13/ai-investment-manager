import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";

/** Shared shell for the Terms and Privacy pages: a light, readable document
 *  surface with a header back to home and the standard disclaimer at the foot. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <style>{`
        .legal-prose h2 { font-size:1.2rem; font-weight:700; margin:2rem 0 .55rem; color:#0F172A; }
        .legal-prose p { margin:0 0 1rem; line-height:1.72; color:#1F2937; }
        .legal-prose ul { margin:0 0 1rem 1.25rem; line-height:1.72; color:#1F2937; list-style:disc; }
        .legal-prose li { margin:.3rem 0; }
        .legal-prose a { color:#138A3C; text-decoration:underline; }
        .legal-prose strong { font-weight:700; color:#0F172A; }
      `}</style>
      <header className="border-b border-[#E5E7EB]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo.png" alt="AskPapa" className="h-9 w-auto" />
          </Link>
          <Link href="/" className="text-sm font-semibold text-[#138A3C] hover:underline">Back to home</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#6B7280]">Last updated {updated}</p>
        <div className="legal-prose mt-6">{children}</div>
        <div className="mt-10 border-t border-[#E5E7EB] pt-6">
          <Disclaimer variant="full" />
          <p className="mt-3 text-xs text-[#9CA3AF]">
            <Link className="hover:underline" href="/terms">Terms</Link> · <Link className="hover:underline" href="/privacy">Privacy</Link> · © 2026 AskPapa
          </p>
        </div>
      </article>
    </main>
  );
}
