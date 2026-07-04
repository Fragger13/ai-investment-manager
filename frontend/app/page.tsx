import Link from "next/link";
import { ArrowRight, ChartPie, Lightbulb, Plus, Sprout, Target, TrendingUp } from "lucide-react";
import { caveat, sans, SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";
import { OurStoryButton } from "@/components/our-story-button";

const script: React.CSSProperties = { fontFamily: SCRIPT_FAMILY };

export default function LandingPage() {
  return (
    <main
      className={`${sans.variable} ${caveat.variable} min-h-screen bg-white text-[#0F172A]`}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <div className="w-full px-6 py-6 sm:px-10 lg:px-16 lg:py-8 xl:px-20">
        <Header />
        <Hero />
        <QuoteBar />
        <SectionHeading />
        <Features />
        <div className="h-12" />
      </div>
    </main>
  );
}

/* ───────────────────────────── Header ───────────────────────────── */

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/" className="block">
        <img src="/landing/logo.png" alt="AskPapa" className="h-14 w-auto md:h-16" />
      </Link>

      <div className="flex items-center gap-3">
        <OurStoryButton />
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-full bg-[#138A3C] px-6 py-2.5 text-sm font-bold text-white shadow-md ring-1 ring-[#138A3C]/30 transition hover:bg-[#107132] hover:shadow-lg"
        >
          Get Started <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

/* ───────────────────────────── Hero ───────────────────────────── */

function Hero() {
  return (
    <section className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_1.25fr] lg:gap-6 xl:gap-8">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-[#4B5563] shadow-md ring-1 ring-black/[0.05]">
          <span aria-hidden>👋</span>
          <span>
            <span className="font-semibold text-[#0F172A]">Namaste!</span> Let&apos;s build your better tomorrow.
          </span>
        </span>

        <h1 className="mt-6 text-[64px] font-extrabold leading-[1.04] tracking-tight md:text-[76px]">
          Financial advice
          <br />
          you can trust,
        </h1>
        <div className="relative mt-1 inline-block">
          <span
            className="block text-[84px] leading-[1]"
            style={{ ...script, color: SCRIPT_GREEN }}
          >
            from Papa.
          </span>
          <WavyUnderline className="absolute -bottom-2 left-2 right-6 w-[88%] text-[#138A3C]" />
          <HeartFlourish className="absolute -right-16 top-2 h-16 w-16 text-[#138A3C]" />
        </div>

        <p className="mt-7 max-w-md text-base font-medium leading-7 text-[#1F2937]">
          Share your financial details, plan your goals, and get personalized advice from your AI Coach — just like Papa would
          give.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-[#138A3C] px-8 py-4 text-base font-bold text-white shadow-lg ring-1 ring-[#138A3C]/30 transition hover:bg-[#107132] hover:shadow-xl"
          >
            <Plus className="h-5 w-5" /> Add Goal
          </Link>
          <div className="flex items-center gap-3" style={{ color: SCRIPT_GREEN }}>
            <CurlyArrow className="h-8 w-14" />
            <p className="text-[24px] leading-tight" style={script}>
              Start your journey
              <br />
              <span className="relative inline-block">
                today!
                <DashUnderline className="absolute -bottom-1 left-0 w-full text-[#138A3C]" />
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          className="overflow-hidden bg-white shadow-sm ring-1 ring-[#E5E7EB]"
          style={{ borderRadius: "140px 36px 36px 36px" }}
        >
          <img
            src="/landing/hero.png"
            alt="Family planning their finances together"
            className="block aspect-[19/12] h-auto w-full object-cover"
          />
        </div>

        <FloatingPill className="absolute -left-3 top-6 md:-left-6" Icon={Target} title="Clear Plans">
          See where your money goes &amp; where it grows
        </FloatingPill>
        <FloatingPill className="absolute -right-3 top-6 md:-right-6" Icon={TrendingUp} title="Smart Investments">
          Curated for your goals &amp; risk
        </FloatingPill>
        <FloatingPill className="absolute -right-3 bottom-12 md:-right-6" Icon={Lightbulb} title="Better Decisions">
          Simple advice, backed by data &amp; experience
        </FloatingPill>
      </div>
    </section>
  );
}

function FloatingPill({
  Icon,
  title,
  children,
  className = "",
}: {
  Icon: typeof Target;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-[210px] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/[0.06] ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E9F4EC]">
          <Icon className="h-4 w-4 text-[#138A3C]" />
        </span>
        <div>
          <p className="text-sm font-bold text-[#0F172A]">{title}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#1F2937]">{children}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Quote bar ───────────────────────────── */

function QuoteBar() {
  return (
    <section className="relative mt-10 min-h-[120px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-[#F1F8F0] px-8 py-5">
      <div className="relative z-10 flex max-w-[70%] items-start gap-3">
        <span className="text-4xl leading-none text-[#138A3C]" aria-hidden>
          &ldquo;
        </span>
        <div>
          <p className="text-[30px] leading-[1.2]" style={{ ...script, color: "#0F172A", fontWeight: 600 }}>
            Paise ki value samajh kar chaloge, to zindagi aaram se nikaloge.
            <span className="ml-1 text-4xl leading-none text-[#138A3C] align-bottom" aria-hidden>
              &rdquo;
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-[26px]" style={{ ...script, color: SCRIPT_GREEN }}>
            – Papa <HeartGlyph className="h-3.5 w-3.5" />
          </p>
        </div>
      </div>
      <img
        src="/landing/beanbag.png"
        alt=""
        className="pointer-events-none absolute bottom-0 right-0 hidden h-[80px] w-auto object-contain object-bottom md:block lg:h-[90px]"
      />
    </section>
  );
}

/* ───────────────────────────── Section heading ───────────────────────────── */

function SectionHeading() {
  return (
    <div className="mt-12 flex items-center justify-center gap-3">
      <span className="text-[26px] leading-none" style={{ ...script, color: SCRIPT_GREEN }}>
        &raquo;
      </span>
      <h2 className="text-2xl font-semibold text-[#0F172A] md:text-[28px]">
        Everything you need, in{" "}
        <span className="relative inline-block">
          one
          <DashUnderline className="absolute -bottom-1 left-0 w-full text-[#138A3C]" />
        </span>{" "}
        place
      </h2>
      <span className="text-[26px] leading-none" style={{ ...script, color: SCRIPT_GREEN }}>
        &laquo;
      </span>
    </div>
  );
}

/* ───────────────────────────── Features ───────────────────────────── */

type FeatureIcon = React.ComponentType<{ className?: string }>;
const features: { Icon: FeatureIcon; title: string; text: string; cta: string; href: string }[] = [
  {
    Icon: PapaAvatarIcon,
    title: "Ask Papa!",
    text: "Ask anything about money. Get simple, jargon-free answers from your AI Papa.",
    cta: "Ask Now",
    href: "/chat",
  },
  {
    Icon: ChartPie,
    title: "A Clear Plan",
    text: "See where your money goes and get a plan to reach your goals.",
    cta: "View Plan",
    href: "/portfolio",
  },
  {
    Icon: Target,
    title: "Hit Your Goals",
    text: "Plan for what matters – home, travel, education or early retirement.",
    cta: "Plan Goals",
    href: "/goals",
  },
  {
    Icon: TrendingUp,
    title: "Smart Investments",
    text: "Curated investment options that match your goals & risk profile.",
    cta: "Explore",
    href: "/asset-intelligence",
  },
  {
    Icon: Sprout,
    title: "Learn & Grow",
    text: "Learn money lessons in simple language. Because gyaan is power.",
    cta: "Start Learning",
    href: "/chat",
  },
];

function Features() {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {features.map((feature) => (
        <article
          key={feature.title}
          className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-md ring-1 ring-black/[0.03] transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${feature.Icon === PapaAvatarIcon ? "overflow-hidden bg-transparent p-0" : "bg-[#E9F4EC]"}`}
          >
            <feature.Icon className={feature.Icon === PapaAvatarIcon ? "h-12 w-12 object-cover" : "h-5 w-5 text-[#138A3C]"} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-[#0F172A]">{feature.title}</h3>
          <p className="mt-1.5 flex-1 text-sm font-medium leading-6 text-[#1F2937]">{feature.text}</p>
          <Link href={feature.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#138A3C] hover:underline">
            {feature.cta} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </article>
      ))}
    </section>
  );
}

/* ───────────────────────────── Inline SVG bits ───────────────────────────── */

function HeartGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path d="M12 21s-7-4.4-7-11a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 6.6-7 11-7 11Z" fill="currentColor" />
    </svg>
  );
}

function WavyUnderline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 12" className={className} preserveAspectRatio="none" aria-hidden focusable="false">
      <path d="M2 8 Q 50 1 100 7 T 200 7 T 318 7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function DashUnderline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 6" className={className} preserveAspectRatio="none" aria-hidden focusable="false">
      <path d="M2 3 Q 50 -1 98 3" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function HeartFlourish({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden focusable="false">
      <path
        d="M2 56 Q 18 42 36 50 Q 50 56 64 44"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M58 36 c -6 -8 -16 -2 -10 6 c 4 6 12 10 12 10 s 8 -4 12 -10 c 6 -8 -4 -14 -10 -6 c -1 -1 -2 -1 -4 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CurlyArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 70 36" className={className} aria-hidden focusable="false">
      <path
        d="M4 22 Q 18 4 38 12 Q 52 18 64 16"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M58 10 L 66 16 L 58 22" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PapaAvatarIcon({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/landing/papa-avatar.png" alt="" aria-hidden className={className} />;
}
