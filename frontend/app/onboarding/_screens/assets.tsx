"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyField } from "../_lib/field-helpers";
import { HelpHint, HintLink } from "../_lib/help-hint";
import { PapaPeek } from "../_components/papa-peek";
import { formatIndianCurrencyInput, formatINR, parseIndianCurrencyInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Holding, HoldingAssetClass, OnboardingProfile } from "@/types";
import { ScreenWrap } from "./about";
import { ScreenContext } from "../_flow/types";

const OTHERS_OPTIONS: { value: HoldingAssetClass; label: string; emoji: string; helper: string }[] = [
  { value: "gold", label: "Gold (physical)", emoji: "🥇", helper: "Jewellery, coins. Enter grams + value." },
  { value: "silver", label: "Silver (physical)", emoji: "🥈", helper: "Bars, coins. Enter grams + value." },
  { value: "crypto", label: "Crypto", emoji: "🪙", helper: "BTC, ETH, etc. We track live in INR." },
  { value: "realEstate", label: "Real estate", emoji: "🏘️", helper: "Property value (no loan)." },
  { value: "bond", label: "Bonds", emoji: "🧾", helper: "Govt bonds, NCDs, SGBs." },
  { value: "nps", label: "NPS", emoji: "🧓", helper: "National Pension Scheme." },
  { value: "fd", label: "Fixed deposits", emoji: "🔒", helper: "Bank/Post Office FDs and RDs." },
  { value: "other", label: "Other", emoji: "📦", helper: "Anything not listed above." },
];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function readHoldings(form: UseFormReturn<OnboardingProfile>): Holding[] {
  return (form.getValues("holdings") || []) as Holding[];
}

function writeHoldings(form: UseFormReturn<OnboardingProfile>, holdings: Holding[]) {
  form.setValue("holdings", holdings, { shouldValidate: false, shouldDirty: true });
}

function addHolding(form: UseFormReturn<OnboardingProfile>, partial: Partial<Holding>): Holding {
  const holding: Holding = {
    id: uid("h"),
    assetClass: "other",
    name: "",
    currentValue: 0,
    hasSip: false,
    source: "manual",
    ...partial,
  };
  writeHoldings(form, [...readHoldings(form), holding]);
  return holding;
}

function updateHolding(form: UseFormReturn<OnboardingProfile>, id: string, patch: Partial<Holding>) {
  writeHoldings(form, readHoldings(form).map((h) => (h.id === id ? { ...h, ...patch } : h)));
}

function removeHolding(form: UseFormReturn<OnboardingProfile>, id: string) {
  writeHoldings(form, readHoldings(form).filter((h) => h.id !== id));
}

function holdingsForClass(values: OnboardingProfile, assetClasses: HoldingAssetClass[]): Holding[] {
  return (values.holdings || []).filter((h) => assetClasses.includes(h.assetClass));
}

// Live ₹/gram spot for physical metals, used to auto-value gold/silver from
// grams during onboarding. Cached at module level so the three entry surfaces
// (single dialog, manual list, upload preview) share one fetch.
let metalPriceCache: { gold: number; silver: number } | null = null;
function useMetalPrices(): { gold: number; silver: number } {
  const [prices, setPrices] = useState<{ gold: number; silver: number }>(metalPriceCache || { gold: 0, silver: 0 });
  useEffect(() => {
    if (metalPriceCache) return;
    let active = true;
    Promise.all([
      api.metalPrice("gold").catch(() => ({ inrPerGram: 0 })),
      api.metalPrice("silver").catch(() => ({ inrPerGram: 0 })),
    ]).then(([g, s]) => {
      metalPriceCache = { gold: g.inrPerGram || 0, silver: s.inrPerGram || 0 };
      if (active) setPrices(metalPriceCache);
    });
    return () => { active = false; };
  }, []);
  return prices;
}

function isMetalClass(c: HoldingAssetClass | string): boolean {
  return c === "gold" || c === "silver";
}

// EPF/PPF are jargon to most first-timers, so the bucket carries a plain-language
// explainer plus a link to the EPFO passbook where salaried users can look up
// their actual balance.
const EPFO_HINT_LINK: HintLink = {
  href: "https://passbook.epfindia.gov.in/MemberPassBook/login",
  label: "Check my EPF balance (EPFO passbook)",
};
const EPF_PPF_HINT =
  "EPF is the retirement fund your employer sets aside from your salary every month. If you draw a salary, you almost certainly have one building up. PPF is a voluntary long term savings account, usually opened at your bank. Not sure of the balance? Log in to the EPFO passbook with your UAN to see it, or check PPF in your bank app.";

// Plain-language explainer for the upload flow: what file to grab, where it
// lives in common apps, and what it should contain. Shown on the intro + upload
// screens so amateurs aren't stuck wondering what an "XIRR statement" even is.
function UploadStatementHelp() {
  return (
    <details className="group rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[0.8125rem] text-[#374151]">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[#0F172A]">
        <span aria-hidden>📄</span>
        <span>New to this? What should I upload, and how do I get it?</span>
        <span className="ml-auto text-[#9CA3AF] transition group-open:rotate-180" aria-hidden>⌄</span>
      </summary>
      <div className="mt-2.5 space-y-2.5 leading-5">
        <p>
          You just need a <strong>holdings or portfolio statement</strong>, sometimes called an{" "}
          <strong>XIRR</strong>, <strong>capital gains</strong>, or <strong>CAS</strong> statement. It&apos;s an
          Excel or CSV file that lists what you own and what it&apos;s worth today. No need to understand the numbers.
          Papa reads it for you.
        </p>
        <p className="font-semibold text-[#0F172A]">Where to download it:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>Stocks (Zerodha):</strong> Console → Portfolio → Holdings → download as Excel.</li>
          <li><strong>Groww / Upstox / Angel One:</strong> Profile → Reports or Statements → Holdings statement.</li>
          <li><strong>Mutual funds (any platform):</strong> get a free <strong>Consolidated Account Statement (CAS)</strong> from <strong>CAMS</strong> or <strong>KFintech</strong>. They email it to you.</li>
        </ul>
        <p>
          Look for a file showing each holding with its <strong>current value</strong>. Have more than one broker?
          Upload them all and Papa merges everything into one portfolio.
        </p>
      </div>
    </details>
  );
}

// ─────────────────────────── Intro ───────────────────────────

export function AssetsIntroScreen({ form, values, next }: ScreenContext) {
  const totalHoldings = (values.holdings || []).length;
  const totalValue = (values.holdings || []).reduce((sum, h) => sum + Number(h.currentValue || 0), 0);
  const [peekOpen, setPeekOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setPeekOpen(true), 500);
    return () => window.clearTimeout(t);
  }, []);
  const triggerUpload = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("askpapa_assets_intent", "upload");
    }
    void next();
  };
  const triggerManual = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("askpapa_assets_intent", "manual");
    }
    void next();
  };
  return (
    <ScreenWrap
      papa="Now we're talking. Show me the good stuff!"
      headline="What you own"
      sub="Upload a portfolio statement to skip typing, or add holdings one by one."
      mood="proud"
    >
      <div className="space-y-4">
        {totalHoldings > 0 ? (
          <div className="rounded-2xl border border-[#138A3C]/20 bg-[#E9F4EC] p-4">
            <p className="text-[0.9375rem] font-semibold text-[#0F172A]">{totalHoldings} holding{totalHoldings === 1 ? "" : "s"} on file · {formatINR(totalValue)}</p>
            <p className="mt-1 text-[0.8125rem] text-[#4B5563]">You can edit them in the next screens.</p>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={triggerUpload}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-[#138A3C] bg-[#138A3C] p-5 text-left text-white shadow-md transition hover:bg-[#107132] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Upload className="h-5 w-5" /></span>
            <p className="text-[1.0625rem] font-semibold">Upload statement</p>
            <p className="text-[0.875rem] leading-snug text-white/85">Upload a portfolio or holdings statement from your broker, mutual fund platform, or demat account. I&apos;ll automatically build a complete picture of your investments.</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.75rem] font-medium text-white">⚡ Live P&amp;L · auto-refresh with the market</p>
          </button>
          <button
            type="button"
            onClick={triggerManual}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-[#138A3C]/40 bg-white p-5 text-left shadow-md transition hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E9F4EC] text-[#138A3C]"><Pencil className="h-5 w-5" /></span>
            <p className="text-[1.0625rem] font-semibold text-[#0F172A]">Add manually</p>
            <p className="text-[0.875rem] leading-snug text-[#4B5563]">Just enter what you remember. We can always update the details later.</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.75rem] font-medium text-amber-800">⚠ No live P&amp;L — refresh values monthly to stay accurate</p>
          </button>
        </div>
        <UploadStatementHelp />
        <p className="text-[0.8125rem] text-[#4B5563]">Hit “Continue” after picking. You can always come back to add more.</p>
      </div>
      <PapaPeek
        open={peekOpen}
        onClose={() => setPeekOpen(false)}
        variant="edge"
        imageSrc="/landing/papa-peek-concerned.png"
        autoDismissMs={18000}
      >
        <strong>You don&apos;t have the statement handy, do you? Thought so.</strong>
        <br />
        <br />
        And somehow this 5-minute onboarding is about to become a 15-minute adventure.
      </PapaPeek>
    </ScreenWrap>
  );
}

// ─────────────────────────── Upload + Preview ───────────────────────────

export function AssetsUploadScreen({ form, values }: ScreenContext) {
  const intent = typeof window !== "undefined" ? window.localStorage.getItem("askpapa_assets_intent") : null;
  const skippedFromIntro = intent === "manual";
  return (
    <ScreenWrap
      papa={skippedFromIntro ? "Beta, you already picked manual. You can still upload here if you want." : "Beta, upload your portfolio statement and I'll line everything up for you."}
      headline="Your portfolio"
      sub="Upload a portfolio statement (Excel or CSV) from any broker or fund platform to auto-fill, or tap any bucket below to add by hand. Everything lands in one portfolio with live P&L."
      mood="curious"
    >
      <div className="space-y-6">
        <StatementUploader form={form} />
        <PortfolioBuckets form={form} values={values} />
      </div>
    </ScreenWrap>
  );
}

// The statement-upload box + review preview. Extracted so the portfolio edit
// dialog can offer the same upload flow — a fresh upload, or an updated
// statement for someone who started out entering holdings by hand.
export function StatementUploader({ form, onCommitted }: { form: UseFormReturn<OnboardingProfile>; onCommitted?: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<Holding[] | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const onPick = () => fileInputRef.current?.click();

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    setParsing(true);
    setError("");
    setWarning("");
    try {
      const results = await Promise.all(files.map((file) => api.importHoldings(file).catch((err) => ({
        holdings: [] as Holding[],
        warnings: [`${file.name}: ${err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "parse failed"}`],
        unmappedRows: 0,
      }))));
      const merged: Holding[] = [];
      const allWarnings: string[] = [];
      results.forEach((res) => {
        res.holdings.forEach((h) => merged.push({ ...h, id: h.id || uid("up") }));
        allWarnings.push(...res.warnings);
      });
      setPreview([...(preview || []), ...merged]);
      if (allWarnings.length) setWarning(allWarnings.join(" "));
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Upload failed.";
      setError(message);
    } finally {
      setParsing(false);
    }
  };

  const togglePreview = (id: string) => {
    setPreview((prev) => prev?.map((h) => (h.id === id ? { ...h, hasSip: !h.hasSip } : h)) || prev);
  };

  const setPreviewField = (id: string, patch: Partial<Holding>) => {
    setPreview((prev) => prev?.map((h) => (h.id === id ? { ...h, ...patch } : h)) || prev);
  };

  const removeFromPreview = (id: string) => {
    setPreview((prev) => prev?.filter((h) => h.id !== id) || prev);
  };

  const commitPreview = () => {
    if (!preview || preview.length === 0) return;
    writeHoldings(form, [...readHoldings(form), ...preview]);
    setPreview(null);
    onCommitted?.();
  };

  const totalIncoming = preview?.reduce((sum, h) => sum + Number(h.currentValue || 0), 0) || 0;

  return (
    <div className="space-y-4">
        {preview ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-[#138A3C]/30 bg-[#E9F4EC] px-4 py-3">
              <div>
                <p className="text-[0.9375rem] font-semibold text-[#0F172A]">{preview.length} holding{preview.length === 1 ? "" : "s"} detected · {formatINR(totalIncoming)}</p>
                <p className="mt-0.5 text-[0.75rem] text-[#4B5563]">Review, edit names, or mark SIPs before committing.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPreview(null)}>Discard</Button>
                <Button type="button" size="sm" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={commitPreview}>Add all to portfolio</Button>
              </div>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {preview.map((h) => (
                <div key={h.id} className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
                  <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_0.7fr_auto] sm:items-center">
                    <Input value={h.name} onChange={(e) => setPreviewField(h.id, { name: e.target.value })} placeholder="Name" className="text-[0.875rem]" />
                    <Select value={h.assetClass} onValueChange={(v) => setPreviewField(h.id, { assetClass: v as HoldingAssetClass })}>
                      <SelectTrigger className="text-[0.875rem]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stock">Direct stock</SelectItem>
                        <SelectItem value="mutualFund">Mutual fund</SelectItem>
                        <SelectItem value="etf">ETF</SelectItem>
                        <SelectItem value="crypto">Crypto</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="bond">Bond</SelectItem>
                        <SelectItem value="nps">NPS</SelectItem>
                        <SelectItem value="fd">FD</SelectItem>
                        <SelectItem value="realEstate">Real estate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.8125rem] text-muted-foreground">₹</span>
                      <Input className="pl-7 text-[0.875rem]" inputMode="numeric" value={formatIndianCurrencyInput(Number(h.currentValue || 0))} onChange={(e) => setPreviewField(h.id, { currentValue: parseIndianCurrencyInput(e.target.value) })} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFromPreview(h.id)} title="Skip this row"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[0.75rem] text-[#4B5563]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={h.hasSip} onChange={() => togglePreview(h.id)} className="h-3.5 w-3.5 rounded border-[#138A3C] text-[#138A3C] focus:ring-[#138A3C]" />
                      Has SIP
                    </label>
                    {h.hasSip ? (
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[0.75rem] text-muted-foreground">₹</span>
                        <Input className="pl-5 h-7 text-[0.75rem]" inputMode="numeric" placeholder="Monthly" value={Number(h.sipAmount || 0) === 0 ? "" : formatIndianCurrencyInput(Number(h.sipAmount))} onChange={(e) => setPreviewField(h.id, { sipAmount: parseIndianCurrencyInput(e.target.value) })} />
                      </div>
                    ) : null}
                    {h.units ? <span>Units: {h.units}</span> : null}
                    {h.symbol ? <span>· {h.symbol}</span> : null}
                    {h.valueAtCost ? <span className={cn("ml-auto font-medium", (h.currentValue - h.valueAtCost) >= 0 ? "text-positive-foreground" : "text-negative-foreground")}>P&L {formatINR(h.currentValue - h.valueAtCost)} ({((h.currentValue - h.valueAtCost) / h.valueAtCost * 100).toFixed(1)}%)</span> : null}
                  </div>
                </div>
              ))}
            </div>
            {warning ? <p className="text-[0.75rem] text-[#92400E]">{warning}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onPick}
              disabled={parsing}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#138A3C]/40 bg-white p-8 text-center transition hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {parsing ? <Loader2 className="h-7 w-7 animate-spin text-[#138A3C]" /> : <Upload className="h-7 w-7 text-[#138A3C]" />}
              <p className="text-[0.9375rem] font-semibold text-[#0F172A]">{parsing ? "Parsing your statement(s)…" : "Tap to choose one or more files"}</p>
              <p className="text-[0.75rem] text-[#4B5563]">HDFC, Zerodha, Groww, CAMS, KFintech, etc. — select multiple if you have more than one broker</p>
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="hidden" onChange={onChange} />
            {error ? <p className="text-[0.8125rem] text-negative-foreground">{error}</p> : null}
            <UploadStatementHelp />
          </div>
        )}
    </div>
  );
}

const OTHER_CLASSES: HoldingAssetClass[] = ["gold", "silver", "crypto", "etf", "realEstate", "bond", "nps", "fd", "other"];

// ─────────────────────────── Portfolio buckets (shown inline under upload) ───────────────────────────

type BucketKey = "stocks" | "mf" | "cash" | "epf" | "others";

export function PortfolioBuckets({ form, values }: { form: UseFormReturn<OnboardingProfile>; values: OnboardingProfile }) {
  const [openBucket, setOpenBucket] = useState<BucketKey | null>(null);
  const stocks = holdingsForClass(values, ["stock", "etf"]);
  const mfs = holdingsForClass(values, ["mutualFund"]);
  const others = holdingsForClass(values, OTHER_CLASSES.filter((c) => c !== "etf"));
  const stocksTotal = stocks.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const mfTotal = mfs.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const othersTotal = others.reduce((s, h) => s + Number(h.currentValue || 0), 0);
  const cashValue = Number(values.cashBalance || 0);
  const epfValue = Number(values.epfPpfValue || 0);

  const buckets: Array<{ key: BucketKey; label: string; emoji: string; count?: number; value: number; filled: boolean; subtitle: string }> = [
    { key: "stocks", label: "Direct stocks & ETFs", emoji: "📊", count: stocks.length, value: stocksTotal, filled: stocks.length > 0, subtitle: stocks.length ? `${stocks.length} holding${stocks.length === 1 ? "" : "s"} · ${formatINR(stocksTotal)}` : "Tap to add" },
    { key: "mf", label: "Mutual funds & SIPs", emoji: "💼", count: mfs.length, value: mfTotal, filled: mfs.length > 0, subtitle: mfs.length ? `${mfs.length} fund${mfs.length === 1 ? "" : "s"} · ${formatINR(mfTotal)}` : "Tap to add" },
    { key: "cash", label: "Savings & cash", emoji: "🏦", value: cashValue, filled: cashValue > 0, subtitle: cashValue > 0 ? formatINR(cashValue) : "Tap to add" },
    { key: "epf", label: "EPF / PPF", emoji: "🏛️", value: epfValue, filled: epfValue > 0, subtitle: epfValue > 0 ? formatINR(epfValue) : "Tap to add" },
    { key: "others", label: "Other investments", emoji: "📦", count: others.length, value: othersTotal, filled: others.length > 0, subtitle: others.length ? `${others.length} item${others.length === 1 ? "" : "s"} · ${formatINR(othersTotal)}` : "Tap to add (gold, crypto, etc.)" },
  ];

  const grandTotal = stocksTotal + mfTotal + cashValue + epfValue + othersTotal;
  const totalHoldings = stocks.length + mfs.length + others.length + (cashValue > 0 ? 1 : 0) + (epfValue > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {totalHoldings > 0 ? (
          <div className="rounded-2xl border border-[#138A3C]/20 bg-[#E9F4EC] p-4">
            <p className="text-[0.9375rem] font-semibold text-[#0F172A]">{totalHoldings} entr{totalHoldings === 1 ? "y" : "ies"} on file · Net assets {formatINR(grandTotal)}</p>
            <p className="mt-1 text-[0.8125rem] text-[#4B5563]">Tap any bucket below to add more or edit.</p>
          </div>
        ) : (
          <p className="text-[0.8125rem] text-[#4B5563]">Or add any bucket by hand — tap one below.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {buckets.map((b) => (
            <BucketTile key={b.key} bucket={b} onClick={() => setOpenBucket(b.key)} />
          ))}
        </div>
      </div>

      {openBucket === "stocks" ? (
        <HoldingsBucketDialog
          title="Direct stocks & ETFs"
          form={form}
          values={values}
          assetClasses={["stock", "etf"]}
          defaultAssetClass="stock"
          placeholderName="e.g., RELIANCE"
          symbolLabel="NSE symbol"
          symbolPlaceholder="RELIANCE"
          onClose={() => setOpenBucket(null)}
        />
      ) : null}
      {openBucket === "mf" ? (
        <HoldingsBucketDialog
          title="Mutual funds & SIPs"
          form={form}
          values={values}
          assetClasses={["mutualFund"]}
          defaultAssetClass="mutualFund"
          placeholderName="e.g., HDFC Mid-Cap Opportunities Dir-G"
          symbolLabel="AMFI scheme code"
          symbolPlaceholder="Optional — helps live NAV refresh"
          symbolField="schemeCode"
          onClose={() => setOpenBucket(null)}
        />
      ) : null}
      {openBucket === "cash" ? (
        <ScalarBucketDialog
          title="Savings & cash"
          helper="Bank balance plus any cash in hand. Counts toward your emergency fund."
          fieldName="cashBalance"
          form={form}
          initialValue={cashValue}
          onClose={() => setOpenBucket(null)}
        />
      ) : null}
      {openBucket === "epf" ? (
        <ScalarBucketDialog
          title="EPF / PPF"
          helper="Latest balance from your last statement. Long-term retirement money."
          hint={EPF_PPF_HINT}
          hintLink={EPFO_HINT_LINK}
          fieldName="epfPpfValue"
          form={form}
          initialValue={epfValue}
          monthlyField="epfPpfMonthly"
          monthlyLabel="Monthly contribution"
          monthlyHelper="Amount added every month (your share + employer's, or your PPF deposit)."
          monthlyInitial={Number(values.epfPpfMonthly || 0)}
          onClose={() => setOpenBucket(null)}
        />
      ) : null}
      {openBucket === "others" ? (
        <OthersBucketDialog
          form={form}
          values={values}
          onClose={() => setOpenBucket(null)}
        />
      ) : null}
    </div>
  );
}

function BucketTile({ bucket, onClick }: { bucket: { key: BucketKey; label: string; emoji: string; filled: boolean; subtitle: string }; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2",
        bucket.filled ? "border-[#138A3C]/40" : "border-[#E5E7EB]"
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F8FAF9] text-xl" aria-hidden>{bucket.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[0.9375rem] font-semibold text-[#0F172A] truncate">{bucket.label}</p>
          {bucket.filled ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#138A3C]" /> : null}
        </div>
        <p className={cn("mt-0.5 text-[0.75rem] truncate", bucket.filled ? "text-[#0F172A]" : "text-[#4B5563]")}>{bucket.subtitle}</p>
      </div>
    </button>
  );
}

// ─────────────────────────── Manual (lumpsum) entry ───────────────────────────

type LumpsumField = keyof Pick<OnboardingProfile, "stocksValue" | "mutualFundsValue" | "cashBalance" | "epfPpfValue">;

const LUMPSUM_TILES: { value: LumpsumField; label: string; emoji: string; placeholder: string; helper: string; hint?: string; hintLink?: HintLink }[] = [
  { value: "stocksValue", label: "Direct stocks & ETFs", emoji: "📊", placeholder: "Total value today", helper: "Include any ETFs you hold. Today's value, not cost.", hint: "Shares of individual companies (like Reliance or TCS) and ETFs you bought directly through a demat account. Enter what they're worth today, not what you paid." },
  { value: "mutualFundsValue", label: "Mutual funds / SIPs", emoji: "💼", placeholder: "Total MF value", helper: "SIP + lumpsum together.", hint: "Money in mutual funds, whether you invested a lump sum or through a monthly SIP. Add up the current value of all your funds." },
  { value: "cashBalance", label: "Savings & cash", emoji: "🏦", placeholder: "Bank + cash", helper: "Counts toward emergency fund.", hint: "Money sitting in your savings/current accounts plus cash in hand. This is what Papa counts toward your emergency fund." },
  { value: "epfPpfValue", label: "EPF / PPF", emoji: "🏛️", placeholder: "Latest balance", helper: "Long-term retirement savings.", hint: EPF_PPF_HINT, hintLink: EPFO_HINT_LINK },
];

// Keep the manual "Other investments" choices identical to the upload-flow
// "Other investments" list (OTHERS_OPTIONS) so the two paths match.
const ADDITIONAL_TYPES = OTHERS_OPTIONS.map((o) => o.label);

type AdditionalInvestment = { type: string; value: number; notes?: string };

export function AssetsManualScreen({ form, values }: ScreenContext) {
  return (
    <ScreenWrap
      papa="Quick lumpsum entry — total for each bucket. Update these monthly to stay accurate."
      headline="What you own"
      sub="Enter what you have. Leave the rest at zero."
      mood="proud"
    >
      <ManualLumpsumEditor form={form} values={values} />
    </ScreenWrap>
  );
}

// The concise "lumpsum totals" editor. Used in onboarding's manual path and
// reused by the portfolio edit dialog when the user entered their holdings
// manually (rather than via an upload).
export function ManualLumpsumEditor({ form, values }: { form: UseFormReturn<OnboardingProfile>; values: OnboardingProfile }) {
  const items = (values.additionalInvestments || []) as AdditionalInvestment[];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftList, setDraftList] = useState<AdditionalInvestment[]>([]);

  const openDialog = () => {
    const existingTypes = new Set(items.map((i) => i.type));
    const seeded: AdditionalInvestment[] = items.map((i) => ({ ...i }));
    // Pull pre-existing scalar values into the editor so users don't lose them
    // when we relocate those buckets into Other investments.
    const goldScalar = Number(values.goldValue || 0);
    if (goldScalar > 0 && !existingTypes.has("Gold (physical)")) seeded.push({ type: "Gold (physical)", value: goldScalar, notes: "" });
    const cryptoScalar = Number(values.cryptoValue || 0);
    if (cryptoScalar > 0 && !existingTypes.has("Crypto")) seeded.push({ type: "Crypto", value: cryptoScalar, notes: "" });
    const realEstateScalar = Number(values.realEstateValue || 0);
    if (realEstateScalar > 0 && !existingTypes.has("Real estate")) seeded.push({ type: "Real estate", value: realEstateScalar, notes: "" });
    setDraftList(seeded.length ? seeded : [{ type: "", value: 0, notes: "" }]);
    setDialogOpen(true);
  };
  const commit = () => {
    const cleaned = draftList.filter((r) => r.type && Number(r.value) > 0);
    // Gold / Crypto / Real estate have dedicated scalar fields the rest of the
    // app reads from (dashboard allocation, recommendation engine, etc.). When
    // the user enters them here, mirror the totals into those scalars so the
    // numbers actually show up downstream.
    const sumOfType = (type: string) =>
      cleaned.filter((r) => r.type === type).reduce((sum, r) => sum + Number(r.value || 0), 0);
    form.setValue("additionalInvestments", cleaned, { shouldValidate: true, shouldDirty: true });
    form.setValue("goldValue", sumOfType("Gold (physical)"), { shouldDirty: true });
    form.setValue("cryptoValue", sumOfType("Crypto"), { shouldDirty: true });
    form.setValue("realEstateValue", sumOfType("Real estate"), { shouldDirty: true });
    setDialogOpen(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-[0.75rem] text-amber-900">
          <strong>Heads up:</strong> live portfolio P&amp;L and live valuation are only available with the statement upload option. Since you&apos;re entering manually, please refresh these values once a month so your plan stays accurate.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {LUMPSUM_TILES.map((tile) => (
            <div key={tile.value} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>{tile.emoji}</span>
                <p className="text-base font-semibold text-[#0F172A]">{tile.label}</p>
                {tile.hint ? <HelpHint text={tile.hint} link={tile.hintLink} label={tile.label} /> : null}
              </div>
              <p className="mt-1 text-[0.8125rem] leading-snug text-[#4B5563]">{tile.helper}</p>
              <div className="mt-3">
                <CurrencyField name={tile.value} placeholder={tile.placeholder} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={openDialog}
            className="flex flex-col rounded-2xl border border-dashed border-[#138A3C]/50 bg-white p-4 text-left shadow-sm transition hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E9F4EC] text-[#138A3C]" aria-hidden>
                <Plus className="h-4 w-4" />
              </span>
              <p className="text-base font-semibold text-[#0F172A]">Other investments</p>
            </div>
            <p className="mt-1 text-[0.8125rem] leading-snug text-[#4B5563]">Gold, silver, crypto, real estate, bonds, NPS, FDs, RSUs and anything else.</p>
            <p className="mt-3 text-sm font-semibold text-[#138A3C]">
              {items.length ? `${items.length} added · Tap to edit` : "Tap to add"}
            </p>
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-[#0F172A]">Other investments</DialogTitle>
          <p className="mt-1 text-sm text-[#4B5563]">Add as many as you like. Blank rows will be dropped on save.</p>
          <div className="mt-4 space-y-3">
            {draftList.map((row, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 sm:grid-cols-[1.1fr_1fr_1.4fr_auto]">
                <div className="space-y-1">
                  <Label className="text-[0.8125rem]">Type</Label>
                  <Select value={row.type || ""} onValueChange={(v) => setDraftList(draftList.map((r, i) => i === index ? { ...r, type: v } : r))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {ADDITIONAL_TYPES.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.8125rem]">Value today</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                    <Input className="pl-7" inputMode="numeric" placeholder="Amount" value={Number(row.value || 0) ? formatIndianCurrencyInput(Number(row.value)) : ""} onChange={(e) => setDraftList(draftList.map((r, i) => i === index ? { ...r, value: parseIndianCurrencyInput(e.target.value) } : r))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.8125rem]">Notes</Label>
                  <Input placeholder="Optional" value={row.notes || ""} onChange={(e) => setDraftList(draftList.map((r, i) => i === index ? { ...r, notes: e.target.value } : r))} />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" size="icon" onClick={() => setDraftList(draftList.filter((_, i) => i !== index))} title="Remove row"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => setDraftList([...draftList, { type: "", value: 0, notes: "" }])}>
              <Plus className="h-4 w-4" /> Add another investment
            </Button>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={commit}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─────────────────────────── Bucket dialogs ───────────────────────────

function HoldingsBucketDialog({
  title, form, values, assetClasses, defaultAssetClass, placeholderName, symbolLabel, symbolPlaceholder, symbolField = "symbol", onClose,
}: {
  title: string;
  form: UseFormReturn<OnboardingProfile>;
  values: OnboardingProfile;
  assetClasses: HoldingAssetClass[];
  defaultAssetClass: HoldingAssetClass;
  placeholderName: string;
  symbolLabel: string;
  symbolPlaceholder: string;
  symbolField?: "symbol" | "schemeCode";
  onClose: () => void;
}) {
  const list = holdingsForClass(values, assetClasses);
  const [editing, setEditing] = useState<Holding | null>(null);

  const beginAdd = () => {
    setEditing({
      id: uid("h"),
      assetClass: defaultAssetClass,
      name: "",
      currentValue: 0,
      hasSip: false,
      source: "manual",
    });
  };

  const saveEditing = () => {
    if (!editing) return;
    if (!editing.name.trim() || editing.currentValue <= 0) return;
    const all = readHoldings(form);
    const next = all.some((h) => h.id === editing.id)
      ? all.map((h) => (h.id === editing.id ? editing : h))
      : [...all, editing];
    writeHoldings(form, next);
    setEditing(null);
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-[#0F172A]">{title}</DialogTitle>
          <p className="mt-1 text-[0.8125rem] text-[#4B5563]">{list.length ? `${list.length} item${list.length === 1 ? "" : "s"} on file.` : "Nothing here yet."}</p>
          <div className="mt-3 space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {list.map((h) => {
              const pl = h.valueAtCost && h.valueAtCost > 0 ? h.currentValue - h.valueAtCost : 0;
              const plp = h.valueAtCost && h.valueAtCost > 0 ? (pl / h.valueAtCost) * 100 : 0;
              return (
                <div key={h.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] font-semibold text-[#0F172A] truncate">{h.name}</p>
                    <p className="mt-0.5 text-[0.75rem] text-[#4B5563]">
                      {formatINR(h.currentValue)}
                      {h.units ? ` · ${h.units} units` : ""}
                      {h.symbol ? ` · ${h.symbol}` : ""}
                      {h.schemeCode ? ` · ${h.schemeCode}` : ""}
                      {h.valueAtCost && h.valueAtCost > 0 ? <span className={cn("ml-1 font-medium", pl >= 0 ? "text-positive-foreground" : "text-negative-foreground")}>· P&L {formatINR(pl)} ({plp.toFixed(1)}%)</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(h)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeHolding(form, h.id)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={beginAdd}><Plus className="h-4 w-4" /> Add new</Button>
            <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
      {editing ? (
        <HoldingEditorDialog
          holding={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveEditing}
          placeholderName={placeholderName}
          symbolLabel={symbolLabel}
          symbolPlaceholder={symbolPlaceholder}
          symbolField={symbolField}
        />
      ) : null}
    </>
  );
}

function ScalarBucketDialog({
  title, helper, fieldName, form, initialValue, onClose,
  monthlyField, monthlyLabel, monthlyHelper, monthlyInitial = 0, hint, hintLink,
}: {
  title: string;
  helper: string;
  fieldName: "cashBalance" | "epfPpfValue";
  form: UseFormReturn<OnboardingProfile>;
  initialValue: number;
  onClose: () => void;
  monthlyField?: "epfPpfMonthly";
  monthlyLabel?: string;
  monthlyHelper?: string;
  monthlyInitial?: number;
  hint?: React.ReactNode;
  hintLink?: HintLink;
}) {
  const [value, setValue] = useState(initialValue);
  const [monthly, setMonthly] = useState(monthlyInitial);
  const save = () => {
    form.setValue(fieldName, value, { shouldValidate: false, shouldDirty: true });
    if (monthlyField) form.setValue(monthlyField, monthly, { shouldValidate: false, shouldDirty: true });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle className="flex items-center gap-1.5 text-lg font-semibold text-[#0F172A]">
          <span>{title}</span>
          {hint ? <HelpHint text={hint} link={hintLink} label={title} /> : null}
        </DialogTitle>
        <p className="mt-1 text-[0.8125rem] text-[#4B5563]">{helper}</p>
        <div className="mt-4 space-y-1.5">
          <Label className="text-[0.8125rem]">Current balance</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.875rem] text-muted-foreground">₹</span>
            <Input className="pl-7" inputMode="numeric" autoFocus value={formatIndianCurrencyInput(Number(value || 0))} onChange={(e) => setValue(parseIndianCurrencyInput(e.target.value))} />
          </div>
        </div>
        {monthlyField ? (
          <div className="mt-4 space-y-1.5">
            <Label className="text-[0.8125rem] text-[#6B7280]">{monthlyLabel || "Monthly contribution"} <span className="font-normal">(optional)</span></Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.875rem] text-muted-foreground">₹</span>
              <Input className="pl-7" inputMode="numeric" placeholder="e.g., 12,000" value={Number(monthly || 0) === 0 ? "" : formatIndianCurrencyInput(Number(monthly))} onChange={(e) => setMonthly(parseIndianCurrencyInput(e.target.value))} />
            </div>
            {monthlyHelper ? <p className="text-[0.75rem] text-[#4B5563]">{monthlyHelper}</p> : null}
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type OtherDraft = {
  id: string;
  assetClass: HoldingAssetClass | "";
  currentValue: number;
  notes: string;
  units?: number;
  valueAtCost?: number;
  symbol?: string;
  hasSip?: boolean;
  sipAmount?: number;
};

function OthersBucketDialog({ form, values, onClose }: { form: UseFormReturn<OnboardingProfile>; values: OnboardingProfile; onClose: () => void }) {
  const otherClasses = OTHER_CLASSES.filter((c) => c !== "etf");
  const existing = holdingsForClass(values, otherClasses);
  const [draftList, setDraftList] = useState<OtherDraft[]>(() => {
    const seeded: OtherDraft[] = existing.map((h) => ({
      id: h.id,
      assetClass: h.assetClass,
      currentValue: Number(h.currentValue || 0),
      notes: h.name === (OTHERS_OPTIONS.find((o) => o.value === h.assetClass)?.label || "") ? "" : h.name,
      units: h.units,
      valueAtCost: h.valueAtCost,
      symbol: h.symbol,
      hasSip: h.hasSip,
      sipAmount: h.sipAmount,
    }));
    return seeded.length ? seeded : [{ id: uid("h"), assetClass: "", currentValue: 0, notes: "" }];
  });

  const metalPrices = useMetalPrices();

  const updateRow = (index: number, patch: Partial<OtherDraft>) => {
    setDraftList((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  // For physical metals, grams drive the value: recompute currentValue from the
  // live ₹/gram whenever grams or the fetched price change.
  const setRowGrams = (index: number, assetClass: HoldingAssetClass | "", grams: number) => {
    const perGram = isMetalClass(assetClass) ? metalPrices[assetClass as "gold" | "silver"] : 0;
    const patch: Partial<OtherDraft> = { units: grams };
    if (perGram > 0) patch.currentValue = Math.round(perGram * grams);
    updateRow(index, patch);
  };

  useEffect(() => {
    setDraftList((prev) => prev.map((r) => {
      if (isMetalClass(r.assetClass) && Number(r.units) > 0) {
        const perGram = metalPrices[r.assetClass as "gold" | "silver"];
        if (perGram > 0) {
          const cv = Math.round(perGram * Number(r.units));
          if (cv !== r.currentValue) return { ...r, currentValue: cv };
        }
      }
      return r;
    }));
  }, [metalPrices]);

  const commit = () => {
    const cleaned = draftList.filter((r) => r.assetClass && (isMetalClass(r.assetClass) ? Number(r.units) > 0 : Number(r.currentValue) > 0));
    const all = readHoldings(form);
    const otherIds = new Set(existing.map((h) => h.id));
    const kept = all.filter((h) => !otherIds.has(h.id));
    const next: Holding[] = cleaned.map((r) => {
      const defaultName = OTHERS_OPTIONS.find((o) => o.value === r.assetClass)?.label || "";
      return {
        id: r.id,
        assetClass: r.assetClass as HoldingAssetClass,
        name: r.notes.trim() || defaultName,
        currentValue: Number(r.currentValue),
        hasSip: Boolean(r.hasSip),
        source: "manual",
        units: r.units || undefined,
        valueAtCost: r.valueAtCost || undefined,
        symbol: r.symbol || undefined,
        sipAmount: r.hasSip ? r.sipAmount || 0 : undefined,
      };
    });
    writeHoldings(form, [...kept, ...next]);
    onClose();
  };

  const unitLabelFor = (c: HoldingAssetClass | ""): string | null => {
    if (c === "gold" || c === "silver") return "Grams";
    if (c === "crypto") return "Coins";
    return null;
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">Other investments</DialogTitle>
        <p className="mt-1 text-sm text-[#4B5563]">Add as many as you like. Optional fields below help us track live values.</p>
        <div className="mt-4 space-y-3">
          {draftList.map((row, index) => {
            const unitLbl = unitLabelFor(row.assetClass);
            const showExtras = Boolean(row.assetClass);
            const isCrypto = row.assetClass === "crypto";
            const isMetal = isMetalClass(row.assetClass);
            const nameLabel = (() => {
              switch (row.assetClass) {
                case "crypto": return "Name (e.g., Bitcoin)";
                case "bond": return "Bond name / issuer";
                case "nps": return "Provider / scheme";
                case "fd": return "Bank / institution";
                case "realEstate": return "Property label";
                default: return "Notes";
              }
            })();
            const namePlaceholder = (() => {
              switch (row.assetClass) {
                case "crypto": return "e.g., Bitcoin";
                case "bond": return "e.g., NHAI 2030";
                case "nps": return "e.g., HDFC Pension Tier-1";
                case "fd": return "e.g., SBI 1-year FD";
                case "realEstate": return "e.g., Pune flat";
                default: return "Optional";
              }
            })();
            return (
              <div key={row.id} className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                <div className="grid gap-2 sm:grid-cols-[1.1fr_1fr_1.4fr_auto]">
                  <div className="space-y-1">
                    <Label className="text-[0.8125rem]">Type</Label>
                    <Select value={row.assetClass || ""} onValueChange={(v) => updateRow(index, { assetClass: v as HoldingAssetClass })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {OTHERS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.8125rem]">Value today{isMetalClass(row.assetClass) ? <span className="ml-1 font-normal text-[#6B7280]">(auto)</span> : null}</Label>
                    {isMetalClass(row.assetClass) ? (
                      <div className="flex h-10 items-center rounded-md border border-border bg-surface-hover px-3 text-sm text-foreground">
                        {metalPrices[row.assetClass as "gold" | "silver"] > 0 ? formatINR(Number(row.currentValue || 0)) : "Awaiting price…"}
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                        <Input className="pl-7" inputMode="numeric" placeholder="Amount" value={Number(row.currentValue || 0) ? formatIndianCurrencyInput(Number(row.currentValue)) : ""} onChange={(e) => updateRow(index, { currentValue: parseIndianCurrencyInput(e.target.value) })} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[0.8125rem]">{nameLabel}</Label>
                    <Input placeholder={namePlaceholder} value={row.notes} onChange={(e) => updateRow(index, { notes: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="icon" onClick={() => setDraftList(draftList.filter((_, i) => i !== index))} title="Remove row"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {showExtras ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="inline-flex items-center gap-1 text-[0.8125rem] text-[#6B7280]">
                        <span>Value at cost (optional)</span>
                        <HelpHint label="value at cost" text="What you originally paid for this, the total you invested. Add it and Papa can show your profit or loss. Leave it blank if you don't remember." />
                      </Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                        <Input className="pl-7" inputMode="numeric" placeholder="For P&L" value={Number(row.valueAtCost || 0) ? formatIndianCurrencyInput(Number(row.valueAtCost)) : ""} onChange={(e) => updateRow(index, { valueAtCost: parseIndianCurrencyInput(e.target.value) })} />
                      </div>
                    </div>
                    {unitLbl ? (
                      <div className="space-y-1">
                        <Label className="inline-flex items-center gap-1 text-[0.8125rem] text-[#6B7280]">
                          <span>{unitLbl}{isMetalClass(row.assetClass) ? <span className="ml-1 text-red-500" aria-hidden>*</span> : " (optional)"}</span>
                          <HelpHint label={unitLbl} text={isMetalClass(row.assetClass) ? "How many grams you own. Papa multiplies it by today's market rate to value your holding automatically, so you don't have to." : "How many units or coins you hold. Optional, it helps Papa track the live value."} />
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="e.g., 25"
                          value={Number(row.units || 0) === 0 ? "" : Number(row.units)}
                          onChange={(e) => isMetalClass(row.assetClass)
                            ? setRowGrams(index, row.assetClass, Number(e.target.value || 0))
                            : updateRow(index, { units: Number(e.target.value || 0) })}
                        />
                      </div>
                    ) : null}
                    {isCrypto ? (
                      <div className="space-y-1">
                        <Label className="text-[0.8125rem] text-[#6B7280]">Symbol (optional)</Label>
                        <Input placeholder="BTC, ETH" value={row.symbol || ""} onChange={(e) => updateRow(index, { symbol: e.target.value.toUpperCase() })} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {isCrypto || isMetal ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.75rem] text-[#4B5563]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={Boolean(row.hasSip)} onChange={(e) => updateRow(index, { hasSip: e.target.checked, sipAmount: e.target.checked ? row.sipAmount || 0 : 0 })} className="h-3.5 w-3.5 rounded border-[#138A3C] text-[#138A3C] focus:ring-[#138A3C]" />
                      I have a monthly SIP
                    </label>
                    {isMetal ? (
                      <HelpHint
                        label="gold or silver SIP"
                        text={`A monthly plan that buys a fixed amount of ${row.assetClass} every month. For example a digital gold SIP, a jewellers' monthly scheme, or buying coins regularly. Tick this and tell Papa the monthly amount.`}
                      />
                    ) : null}
                    {row.hasSip ? (
                      <div className="relative w-32">
                        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[0.75rem] text-muted-foreground">₹</span>
                        <Input className="pl-5 h-7 text-[0.75rem]" inputMode="numeric" placeholder="Monthly" value={Number(row.sipAmount || 0) === 0 ? "" : formatIndianCurrencyInput(Number(row.sipAmount))} onChange={(e) => updateRow(index, { sipAmount: parseIndianCurrencyInput(e.target.value) })} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => setDraftList([...draftList, { id: uid("h"), assetClass: "", currentValue: 0, notes: "" }])}>
            <Plus className="h-4 w-4" /> Add another investment
          </Button>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132]" onClick={commit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── Holding editor dialog ───────────────────────────

function HoldingEditorDialog({
  holding,
  onChange,
  onClose,
  onSave,
  placeholderName,
  symbolLabel,
  symbolPlaceholder,
  symbolField = "symbol",
}: {
  holding: Holding;
  onChange: (h: Holding) => void;
  onClose: () => void;
  onSave: () => void;
  placeholderName?: string;
  symbolLabel?: string;
  symbolPlaceholder?: string;
  symbolField?: "symbol" | "schemeCode";
}) {
  const isMetal = isMetalClass(holding.assetClass);
  const isUnitClass = ["stock", "etf", "mutualFund", "crypto"].includes(holding.assetClass);
  const canSip = ["stock", "etf", "mutualFund", "crypto"].includes(holding.assetClass);
  const metalPrices = useMetalPrices();
  const perGram = isMetal ? metalPrices[holding.assetClass as "gold" | "silver"] : 0;
  useEffect(() => {
    if (isMetal && perGram > 0 && Number(holding.units) > 0) {
      const cv = Math.round(perGram * Number(holding.units));
      if (cv !== holding.currentValue) onChange({ ...holding, currentValue: cv });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perGram, holding.units]);
  const cost = Number(holding.valueAtCost || 0);
  const pl = cost > 0 ? holding.currentValue - cost : 0;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;
  const canSave = holding.name.trim().length > 0 && (isMetal ? Number(holding.units) > 0 : holding.currentValue > 0);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">{labelForClass(holding.assetClass)} details</DialogTitle>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[0.8125rem]">Name</Label>
            <Input value={holding.name} onChange={(e) => onChange({ ...holding, name: e.target.value })} placeholder={placeholderName || "e.g., Investment name"} />
          </div>
          {symbolLabel ? (
            <div className="space-y-1.5">
              <Label className="text-[0.8125rem]">{symbolLabel}</Label>
              <Input
                value={symbolField === "schemeCode" ? (holding.schemeCode || "") : (holding.symbol || "")}
                onChange={(e) => onChange(symbolField === "schemeCode" ? { ...holding, schemeCode: e.target.value } : { ...holding, symbol: e.target.value.toUpperCase() })}
                placeholder={symbolPlaceholder}
              />
              <p className="text-[0.75rem] text-[#4B5563]">Helps us refresh prices live later.</p>
            </div>
          ) : null}
          {isMetal ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[0.8125rem]">Grams<span className="ml-1 text-red-500" aria-hidden>*</span></Label>
                <Input type="number" inputMode="decimal" value={Number(holding.units || 0) === 0 ? "" : Number(holding.units)} onChange={(e) => onChange({ ...holding, units: Number(e.target.value || 0) })} placeholder="e.g., 50" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.8125rem]">Current value <span className="text-[#4B5563] font-normal">(auto)</span></Label>
                <div className="flex h-10 items-center rounded-md border border-border bg-surface-hover px-3 text-sm text-foreground">
                  {perGram > 0 ? formatINR(holding.currentValue) : "Awaiting live price…"}
                </div>
                <p className="text-[0.75rem] text-[#4B5563]">{perGram > 0 ? `Live ₹${formatIndianCurrencyInput(Math.round(perGram))}/g — updates with the market.` : "We'll value this on the next price refresh."}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.8125rem]">Value at cost <span className="text-[#4B5563] font-normal">(optional)</span></Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.875rem] text-muted-foreground">₹</span>
                  <Input className="pl-7" inputMode="numeric" placeholder="Optional — enables P&L" value={Number(holding.valueAtCost || 0) === 0 ? "" : formatIndianCurrencyInput(Number(holding.valueAtCost))} onChange={(e) => onChange({ ...holding, valueAtCost: parseIndianCurrencyInput(e.target.value) })} />
                </div>
                {cost > 0 ? <p className={cn("text-[0.75rem] font-medium", pl >= 0 ? "text-positive-foreground" : "text-negative-foreground")}>P&L {formatINR(pl)} ({plPct.toFixed(1)}%)</p> : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[0.8125rem]">Current value</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.875rem] text-muted-foreground">₹</span>
                  <Input className="pl-7" inputMode="numeric" value={formatIndianCurrencyInput(Number(holding.currentValue || 0))} onChange={(e) => onChange({ ...holding, currentValue: parseIndianCurrencyInput(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[0.8125rem]">Value at cost <span className="text-[#4B5563] font-normal">(invested)</span></Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.875rem] text-muted-foreground">₹</span>
                  <Input className="pl-7" inputMode="numeric" placeholder="Optional — enables P&L" value={Number(holding.valueAtCost || 0) === 0 ? "" : formatIndianCurrencyInput(Number(holding.valueAtCost))} onChange={(e) => onChange({ ...holding, valueAtCost: parseIndianCurrencyInput(e.target.value) })} />
                </div>
              </div>
              {isUnitClass ? (
                <div className="space-y-1.5">
                  <Label className="text-[0.8125rem]">{unitFieldLabel(holding.assetClass)}</Label>
                  <Input type="number" inputMode="decimal" value={Number(holding.units || 0) === 0 ? "" : Number(holding.units)} onChange={(e) => onChange({ ...holding, units: Number(e.target.value || 0) })} placeholder="Optional" />
                </div>
              ) : null}
            </div>
          )}
          {canSip ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
              <label className="flex items-center gap-2 text-[0.8125rem] font-medium text-[#0F172A]">
                <input type="checkbox" checked={holding.hasSip} onChange={(e) => onChange({ ...holding, hasSip: e.target.checked, sipAmount: e.target.checked ? holding.sipAmount : 0 })} className="h-4 w-4 rounded border-[#138A3C] text-[#138A3C] focus:ring-[#138A3C]" />
                I have a monthly SIP on this
              </label>
              {holding.hasSip ? (
                <div className="mt-3 space-y-1.5">
                  <Label className="text-[0.8125rem]">Monthly SIP amount</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[0.875rem] text-muted-foreground">₹</span>
                    <Input className="pl-7" inputMode="numeric" value={Number(holding.sipAmount || 0) === 0 ? "" : formatIndianCurrencyInput(Number(holding.sipAmount))} onChange={(e) => onChange({ ...holding, sipAmount: parseIndianCurrencyInput(e.target.value) })} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" className="bg-[#138A3C] text-white hover:bg-[#107132] disabled:opacity-50" disabled={!canSave} onClick={onSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function labelForClass(c: HoldingAssetClass): string {
  return ({
    stock: "Direct stock",
    mutualFund: "Mutual fund",
    etf: "ETF",
    crypto: "Crypto",
    gold: "Gold",
    silver: "Silver",
    realEstate: "Real estate",
    bond: "Bond",
    nps: "NPS",
    fd: "Fixed deposit",
    cash: "Cash",
    epfPpf: "EPF/PPF",
    other: "Other",
  } as Record<HoldingAssetClass, string>)[c] || c;
}

function unitLabel(c: HoldingAssetClass): string {
  if (c === "gold" || c === "silver") return "g";
  if (c === "stock" || c === "etf") return "shares";
  if (c === "mutualFund") return "units";
  if (c === "crypto") return "coins";
  return "units";
}

function unitFieldLabel(c: HoldingAssetClass): string {
  if (c === "gold" || c === "silver") return "Grams";
  if (c === "stock" || c === "etf") return "Shares";
  if (c === "mutualFund") return "Units";
  if (c === "crypto") return "Coins";
  return "Quantity";
}
