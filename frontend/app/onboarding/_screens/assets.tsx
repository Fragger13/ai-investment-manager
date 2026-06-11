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

// ─────────────────────────── Intro ───────────────────────────

export function AssetsIntroScreen({ form, values, next }: ScreenContext) {
  const totalHoldings = (values.holdings || []).length;
  const totalValue = (values.holdings || []).reduce((sum, h) => sum + Number(h.currentValue || 0), 0);
  const [peekOpen, setPeekOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setPeekOpen(true), 1000);
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
            <p className="text-[15px] font-semibold text-[#0F172A]">{totalHoldings} holding{totalHoldings === 1 ? "" : "s"} on file · {formatINR(totalValue)}</p>
            <p className="mt-1 text-[13px] text-[#4B5563]">You can edit them in the next screens.</p>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={triggerUpload}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-[#138A3C] bg-[#138A3C] p-5 text-left text-white shadow-md transition hover:bg-[#107132] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Upload className="h-5 w-5" /></span>
            <p className="text-[17px] font-semibold">Upload statement</p>
            <p className="text-[14px] leading-snug text-white/85">Upload XIRR statements from your broker, mutual fund platform, or demat account. I&apos;ll automatically build a complete picture of your investments.</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[12px] font-medium text-white">⚡ Live P&amp;L · auto-refresh with the market</p>
          </button>
          <button
            type="button"
            onClick={triggerManual}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-[#138A3C]/40 bg-white p-5 text-left shadow-md transition hover:border-[#138A3C] hover:bg-[#F8FAF9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E9F4EC] text-[#138A3C]"><Pencil className="h-5 w-5" /></span>
            <p className="text-[17px] font-semibold text-[#0F172A]">Add manually</p>
            <p className="text-[14px] leading-snug text-[#4B5563]">Just enter what you remember. We can always update the details later.</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-800">⚠ No live P&amp;L — refresh values monthly to stay accurate</p>
          </button>
        </div>
        <p className="text-[13px] text-[#4B5563]">Hit “Continue” after picking. You can always come back to add more.</p>
      </div>
      <PapaPeek
        open={peekOpen}
        onClose={() => setPeekOpen(false)}
        variant="edge"
        imageSrc="/landing/papa-peek-concerned.png"
        autoDismissMs={7000}
      >
        <strong>You don&apos;t have the statement handy, do you? Thought so.</strong>
        <br />
        And somehow this 5-minute onboarding is about to become a 15-minute adventure.
      </PapaPeek>
    </ScreenWrap>
  );
}

// ─────────────────────────── Upload + Preview ───────────────────────────

export function AssetsUploadScreen({ form, values }: ScreenContext) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<Holding[] | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const intent = typeof window !== "undefined" ? window.localStorage.getItem("askpapa_assets_intent") : null;
  const skippedFromIntro = intent === "manual";

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
  };

  const totalIncoming = preview?.reduce((sum, h) => sum + Number(h.currentValue || 0), 0) || 0;

  return (
    <ScreenWrap
      papa={skippedFromIntro ? "Beta, you already picked manual. You can still upload here if you want." : "Beta, upload that XIRR file and I'll line everything up for you."}
      headline="Upload portfolio statement"
      sub="XLSX or CSV of the XIRR from your DEMAT broker app. Add one file or many — we'll merge them into one portfolio with live P&L."
      mood="curious"
    >
      <div className="space-y-4">
        {preview ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-[#138A3C]/30 bg-[#E9F4EC] px-4 py-3">
              <div>
                <p className="text-[15px] font-semibold text-[#0F172A]">{preview.length} holding{preview.length === 1 ? "" : "s"} detected · {formatINR(totalIncoming)}</p>
                <p className="mt-0.5 text-[12px] text-[#4B5563]">Review, edit names, or mark SIPs before committing.</p>
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
                    <Input value={h.name} onChange={(e) => setPreviewField(h.id, { name: e.target.value })} placeholder="Name" className="text-[14px]" />
                    <Select value={h.assetClass} onValueChange={(v) => setPreviewField(h.id, { assetClass: v as HoldingAssetClass })}>
                      <SelectTrigger className="text-[14px]"><SelectValue /></SelectTrigger>
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
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-muted-foreground">₹</span>
                      <Input className="pl-7 text-[14px]" inputMode="numeric" value={formatIndianCurrencyInput(Number(h.currentValue || 0))} onChange={(e) => setPreviewField(h.id, { currentValue: parseIndianCurrencyInput(e.target.value) })} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFromPreview(h.id)} title="Skip this row"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-[#4B5563]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={h.hasSip} onChange={() => togglePreview(h.id)} className="h-3.5 w-3.5 rounded border-[#138A3C] text-[#138A3C] focus:ring-[#138A3C]" />
                      Has SIP
                    </label>
                    {h.hasSip ? (
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[12px] text-muted-foreground">₹</span>
                        <Input className="pl-5 h-7 text-[12px]" inputMode="numeric" placeholder="Monthly" value={Number(h.sipAmount || 0) === 0 ? "" : formatIndianCurrencyInput(Number(h.sipAmount))} onChange={(e) => setPreviewField(h.id, { sipAmount: parseIndianCurrencyInput(e.target.value) })} />
                      </div>
                    ) : null}
                    {h.units ? <span>Units: {h.units}</span> : null}
                    {h.symbol ? <span>· {h.symbol}</span> : null}
                    {h.valueAtCost ? <span className={cn("ml-auto font-medium", (h.currentValue - h.valueAtCost) >= 0 ? "text-positive-foreground" : "text-negative-foreground")}>P&L {formatINR(h.currentValue - h.valueAtCost)} ({((h.currentValue - h.valueAtCost) / h.valueAtCost * 100).toFixed(1)}%)</span> : null}
                  </div>
                </div>
              ))}
            </div>
            {warning ? <p className="text-[12px] text-[#92400E]">{warning}</p> : null}
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
              <p className="text-[15px] font-semibold text-[#0F172A]">{parsing ? "Parsing your statement(s)…" : "Tap to choose one or more XIRR files"}</p>
              <p className="text-[12px] text-[#4B5563]">HDFC, Zerodha, Groww, CAMS, KFintech — select multiple if you have more than one broker</p>
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="hidden" onChange={onChange} />
            {error ? <p className="text-[13px] text-negative-foreground">{error}</p> : null}
            <p className="text-[12px] text-[#4B5563]">Already added {readHoldings(form).length} holding{readHoldings(form).length === 1 ? "" : "s"}. Tap Continue to keep going manually, or upload to add more.</p>
          </div>
        )}
      </div>
    </ScreenWrap>
  );
}

const OTHER_CLASSES: HoldingAssetClass[] = ["gold", "silver", "crypto", "etf", "realEstate", "bond", "nps", "fd", "other"];

// ─────────────────────────── Overview (post-upload single section) ───────────────────────────

type BucketKey = "stocks" | "mf" | "cash" | "epf" | "others";

export function AssetsOverviewScreen({ form, values }: ScreenContext) {
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
    <ScreenWrap
      papa="Here's everything you own at a glance. Tap any bucket to add or edit."
      headline="Your portfolio"
      sub="Green ticks mean we already have it from your upload. Click a bucket to review or top up."
      mood="proud"
    >
      <div className="space-y-4">
        {totalHoldings > 0 ? (
          <div className="rounded-2xl border border-[#138A3C]/20 bg-[#E9F4EC] p-4">
            <p className="text-[15px] font-semibold text-[#0F172A]">{totalHoldings} entr{totalHoldings === 1 ? "y" : "ies"} on file · Net assets {formatINR(grandTotal)}</p>
            <p className="mt-1 text-[13px] text-[#4B5563]">Tap any bucket below to add more or edit.</p>
          </div>
        ) : null}
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
          fieldName="epfPpfValue"
          form={form}
          initialValue={epfValue}
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
    </ScreenWrap>
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
          <p className="text-[15px] font-semibold text-[#0F172A] truncate">{bucket.label}</p>
          {bucket.filled ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#138A3C]" /> : null}
        </div>
        <p className={cn("mt-0.5 text-[12px] truncate", bucket.filled ? "text-[#0F172A]" : "text-[#4B5563]")}>{bucket.subtitle}</p>
      </div>
    </button>
  );
}

// ─────────────────────────── Manual (lumpsum) entry ───────────────────────────

type LumpsumField = keyof Pick<OnboardingProfile, "stocksValue" | "mutualFundsValue" | "cashBalance" | "epfPpfValue">;

const LUMPSUM_TILES: { value: LumpsumField; label: string; emoji: string; placeholder: string; helper: string }[] = [
  { value: "stocksValue", label: "Direct stocks & ETFs", emoji: "📊", placeholder: "Total value today", helper: "Include any ETFs you hold. Today's value, not cost." },
  { value: "mutualFundsValue", label: "Mutual funds / SIPs", emoji: "💼", placeholder: "Total MF value", helper: "SIP + lumpsum together." },
  { value: "cashBalance", label: "Savings & cash", emoji: "🏦", placeholder: "Bank + cash", helper: "Counts toward emergency fund." },
  { value: "epfPpfValue", label: "EPF / PPF", emoji: "🏛️", placeholder: "Latest balance", helper: "Long-term retirement savings." },
];

const ADDITIONAL_TYPES = [
  "Gold",
  "Silver",
  "Crypto",
  "Real estate",
  "Bonds",
  "NPS",
  "Fixed deposits",
  "Recurring deposits",
  "Sovereign gold bonds",
  "International stocks",
  "ESOPs",
  "RSUs",
  "Insurance-linked investments",
  "Other",
];

type AdditionalInvestment = { type: string; value: number; notes?: string };

export function AssetsManualScreen({ form, values }: ScreenContext) {
  const items = (values.additionalInvestments || []) as AdditionalInvestment[];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftList, setDraftList] = useState<AdditionalInvestment[]>([]);

  const openDialog = () => {
    const existingTypes = new Set(items.map((i) => i.type));
    const seeded: AdditionalInvestment[] = items.map((i) => ({ ...i }));
    // Pull pre-existing scalar values into the editor so users don't lose them
    // when we relocate those buckets into Other investments.
    const goldScalar = Number(values.goldValue || 0);
    if (goldScalar > 0 && !existingTypes.has("Gold")) seeded.push({ type: "Gold", value: goldScalar, notes: "" });
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
    form.setValue("goldValue", sumOfType("Gold") + sumOfType("Sovereign gold bonds"), { shouldDirty: true });
    form.setValue("cryptoValue", sumOfType("Crypto"), { shouldDirty: true });
    form.setValue("realEstateValue", sumOfType("Real estate"), { shouldDirty: true });
    setDialogOpen(false);
  };

  return (
    <ScreenWrap
      papa="Quick lumpsum entry — total for each bucket. Update these monthly to stay accurate."
      headline="What you own"
      sub="Enter what you have. Leave the rest at zero."
      mood="proud"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          <strong>Heads up:</strong> live portfolio P&amp;L and live valuation are only available with the XIRR upload option. Since you&apos;re entering manually, please refresh these values once a month so your plan stays accurate.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {LUMPSUM_TILES.map((tile) => (
            <div key={tile.value} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>{tile.emoji}</span>
                <p className="text-base font-semibold text-[#0F172A]">{tile.label}</p>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-[#4B5563]">{tile.helper}</p>
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
            <p className="mt-1 text-[13px] leading-snug text-[#4B5563]">Gold, silver, crypto, real estate, bonds, NPS, FDs, RSUs and anything else.</p>
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
                  <Label className="text-xs">Type</Label>
                  <Select value={row.type || ""} onValueChange={(v) => setDraftList(draftList.map((r, i) => i === index ? { ...r, type: v } : r))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {ADDITIONAL_TYPES.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value today</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                    <Input className="pl-7" inputMode="numeric" placeholder="Amount" value={Number(row.value || 0) ? formatIndianCurrencyInput(Number(row.value)) : ""} onChange={(e) => setDraftList(draftList.map((r, i) => i === index ? { ...r, value: parseIndianCurrencyInput(e.target.value) } : r))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
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
    </ScreenWrap>
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
          <p className="mt-1 text-[13px] text-[#4B5563]">{list.length ? `${list.length} item${list.length === 1 ? "" : "s"} on file.` : "Nothing here yet."}</p>
          <div className="mt-3 space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {list.map((h) => {
              const pl = h.valueAtCost && h.valueAtCost > 0 ? h.currentValue - h.valueAtCost : 0;
              const plp = h.valueAtCost && h.valueAtCost > 0 ? (pl / h.valueAtCost) * 100 : 0;
              return (
                <div key={h.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{h.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#4B5563]">
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
}: {
  title: string;
  helper: string;
  fieldName: "cashBalance" | "epfPpfValue";
  form: UseFormReturn<OnboardingProfile>;
  initialValue: number;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const save = () => {
    form.setValue(fieldName, value, { shouldValidate: false, shouldDirty: true });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">{title}</DialogTitle>
        <p className="mt-1 text-[13px] text-[#4B5563]">{helper}</p>
        <div className="mt-4 space-y-1.5">
          <Label className="text-[13px]">Amount</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-muted-foreground">₹</span>
            <Input className="pl-7" inputMode="numeric" autoFocus value={formatIndianCurrencyInput(Number(value || 0))} onChange={(e) => setValue(parseIndianCurrencyInput(e.target.value))} />
          </div>
        </div>
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

  const updateRow = (index: number, patch: Partial<OtherDraft>) => {
    setDraftList((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const commit = () => {
    const cleaned = draftList.filter((r) => r.assetClass && Number(r.currentValue) > 0);
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
                    <Label className="text-xs">Type</Label>
                    <Select value={row.assetClass || ""} onValueChange={(v) => updateRow(index, { assetClass: v as HoldingAssetClass })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {OTHERS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value today</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                      <Input className="pl-7" inputMode="numeric" placeholder="Amount" value={Number(row.currentValue || 0) ? formatIndianCurrencyInput(Number(row.currentValue)) : ""} onChange={(e) => updateRow(index, { currentValue: parseIndianCurrencyInput(e.target.value) })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{nameLabel}</Label>
                    <Input placeholder={namePlaceholder} value={row.notes} onChange={(e) => updateRow(index, { notes: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" size="icon" onClick={() => setDraftList(draftList.filter((_, i) => i !== index))} title="Remove row"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {showExtras ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-[#6B7280]">Value at cost (optional)</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                        <Input className="pl-7" inputMode="numeric" placeholder="For P&L" value={Number(row.valueAtCost || 0) ? formatIndianCurrencyInput(Number(row.valueAtCost)) : ""} onChange={(e) => updateRow(index, { valueAtCost: parseIndianCurrencyInput(e.target.value) })} />
                      </div>
                    </div>
                    {unitLbl ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-[#6B7280]">{unitLbl} (optional)</Label>
                        <Input type="number" inputMode="decimal" placeholder="e.g., 25" value={Number(row.units || 0) === 0 ? "" : Number(row.units)} onChange={(e) => updateRow(index, { units: Number(e.target.value || 0) })} />
                      </div>
                    ) : null}
                    {isCrypto ? (
                      <div className="space-y-1">
                        <Label className="text-xs text-[#6B7280]">Symbol (optional)</Label>
                        <Input placeholder="BTC, ETH" value={row.symbol || ""} onChange={(e) => updateRow(index, { symbol: e.target.value.toUpperCase() })} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {isCrypto ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[#4B5563]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={Boolean(row.hasSip)} onChange={(e) => updateRow(index, { hasSip: e.target.checked, sipAmount: e.target.checked ? row.sipAmount || 0 : 0 })} className="h-3.5 w-3.5 rounded border-[#138A3C] text-[#138A3C] focus:ring-[#138A3C]" />
                      Monthly SIP
                    </label>
                    {row.hasSip ? (
                      <div className="relative w-32">
                        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[12px] text-muted-foreground">₹</span>
                        <Input className="pl-5 h-7 text-[12px]" inputMode="numeric" placeholder="Monthly" value={Number(row.sipAmount || 0) === 0 ? "" : formatIndianCurrencyInput(Number(row.sipAmount))} onChange={(e) => updateRow(index, { sipAmount: parseIndianCurrencyInput(e.target.value) })} />
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
  const isUnitClass = ["stock", "etf", "mutualFund", "crypto", "gold", "silver"].includes(holding.assetClass);
  const canSip = ["stock", "etf", "mutualFund", "crypto"].includes(holding.assetClass);
  const canSave = holding.name.trim().length > 0 && holding.currentValue > 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogTitle className="text-lg font-semibold text-[#0F172A]">{labelForClass(holding.assetClass)} details</DialogTitle>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Name</Label>
            <Input value={holding.name} onChange={(e) => onChange({ ...holding, name: e.target.value })} placeholder={placeholderName || "e.g., Investment name"} />
          </div>
          {symbolLabel ? (
            <div className="space-y-1.5">
              <Label className="text-[13px]">{symbolLabel}</Label>
              <Input
                value={symbolField === "schemeCode" ? (holding.schemeCode || "") : (holding.symbol || "")}
                onChange={(e) => onChange(symbolField === "schemeCode" ? { ...holding, schemeCode: e.target.value } : { ...holding, symbol: e.target.value.toUpperCase() })}
                placeholder={symbolPlaceholder}
              />
              <p className="text-[11px] text-[#4B5563]">Lets us refresh prices live later.</p>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Current value</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-muted-foreground">₹</span>
                <Input className="pl-7" inputMode="numeric" value={formatIndianCurrencyInput(Number(holding.currentValue || 0))} onChange={(e) => onChange({ ...holding, currentValue: parseIndianCurrencyInput(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Value at cost <span className="text-[#4B5563] font-normal">(invested)</span></Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-muted-foreground">₹</span>
                <Input className="pl-7" inputMode="numeric" placeholder="Optional — enables P&L" value={Number(holding.valueAtCost || 0) === 0 ? "" : formatIndianCurrencyInput(Number(holding.valueAtCost))} onChange={(e) => onChange({ ...holding, valueAtCost: parseIndianCurrencyInput(e.target.value) })} />
              </div>
            </div>
            {isUnitClass ? (
              <div className="space-y-1.5">
                <Label className="text-[13px]">{unitFieldLabel(holding.assetClass)}</Label>
                <Input type="number" inputMode="decimal" value={Number(holding.units || 0) === 0 ? "" : Number(holding.units)} onChange={(e) => onChange({ ...holding, units: Number(e.target.value || 0) })} placeholder="Optional" />
              </div>
            ) : null}
          </div>
          {canSip ? (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
              <label className="flex items-center gap-2 text-[13px] font-medium text-[#0F172A]">
                <input type="checkbox" checked={holding.hasSip} onChange={(e) => onChange({ ...holding, hasSip: e.target.checked, sipAmount: e.target.checked ? holding.sipAmount : 0 })} className="h-4 w-4 rounded border-[#138A3C] text-[#138A3C] focus:ring-[#138A3C]" />
                I have a monthly SIP on this
              </label>
              {holding.hasSip ? (
                <div className="mt-3 space-y-1.5">
                  <Label className="text-[13px]">Monthly SIP amount</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-muted-foreground">₹</span>
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
