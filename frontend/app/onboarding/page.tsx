"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FieldPath, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { onboardingSchema } from "@/lib/schemas";
import { ageFromDob, blankProfile, mergeProfilePatch } from "@/lib/profile";
import { DocumentAnalysis, OnboardingProfile } from "@/types";
import { useAuthStore } from "@/store/auth-store";

const stepTitles = [
  "Choose setup method",
  "Personal details",
  "Income and cashflow",
  "Expenses and debt",
  "Investments",
  "Risk comfort",
  "Goals",
  "Money behavior"
];

const investmentOptions = ["Silver", "Bonds", "NPS", "Fixed deposits", "Recurring deposits", "Sovereign gold bonds", "International stocks", "ETFs", "ESOPs", "RSUs", "Insurance-linked investments", "Other"];

type NumberPath = FieldPath<OnboardingProfile>;

export default function OnboardingPage() {
  const router = useRouter();
  const saveProfile = useAuthStore((state) => state.saveProfile);
  const existing = useAuthStore((state) => state.profile);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [setupMode, setSetupMode] = useState<"documents" | "manual" | "">("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [uploadError, setUploadError] = useState("");

  const form = useForm<OnboardingProfile>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: existing || blankProfile,
    mode: "onBlur"
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "additionalInvestments" });
  const values = useWatch({ control: form.control });
  const progress = useMemo(() => ((step + 1) / stepTitles.length) * 100, [step]);

  useEffect(() => {
    const income = Number(values.monthlySalary || 0) + Number(values.bonusIncome || 0) + Number(values.sideIncome || 0) + Number(values.otherIncome || 0);
    form.setValue("monthlyCashInflow", income, { shouldValidate: true });
  }, [values.monthlySalary, values.bonusIncome, values.sideIncome, values.otherIncome, form]);

  useEffect(() => {
    form.setValue("age", ageFromDob(values.dateOfBirth || ""), { shouldValidate: true });
  }, [values.dateOfBirth, form]);

  useEffect(() => {
    const travel = Number(values.internationalTrips || 0) * Number(values.internationalTripCost || 0) + Number(values.domesticTrips || 0) * Number(values.domesticTripCost || 0);
    form.setValue("travelTarget", travel, { shouldValidate: true });
  }, [values.internationalTrips, values.internationalTripCost, values.domesticTrips, values.domesticTripCost, form]);

  async function upload(file?: File) {
    if (!file) return;
    setUploadError("");
    setUploadProgress(25);
    try {
      setUploadProgress(60);
      const result = await api.uploadDocument(file);
      setAnalysis(result);
      setUploadProgress(100);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
      setUploadProgress(0);
    }
  }

  function applyExtraction() {
    if (!analysis) return;
    const merged = mergeProfilePatch(form.getValues(), analysis.profilePatch);
    form.reset(merged);
  }

  async function saveDraft() {
    const current = form.getValues();
    saveProfile(current, false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  async function submit(valuesToSubmit: OnboardingProfile) {
    const normalized = {
      ...valuesToSubmit,
      age: ageFromDob(valuesToSubmit.dateOfBirth),
      monthlyCashInflow: valuesToSubmit.monthlySalary + valuesToSubmit.bonusIncome + valuesToSubmit.sideIncome + valuesToSubmit.otherIncome
    };
    await api.saveOnboarding(normalized);
    saveProfile(normalized, true);
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-primary">Step {step + 1} of {stepTitles.length}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Build your financial profile</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Use documents to fill fields faster, or enter details manually. You can review and edit everything before saving.</p>
          </div>
          <Button variant="outline" onClick={saveDraft}><Save className="h-4 w-4" /> {saved ? "Saved" : "Save draft"}</Button>
        </div>
        <Progress value={progress} />

        <form onSubmit={form.handleSubmit(submit)} className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{stepTitles[step]}</CardTitle>
            </CardHeader>
            <CardContent>
              {step === 0 ? (
                <SetupStep setupMode={setupMode} setSetupMode={setSetupMode} upload={upload} uploadProgress={uploadProgress} analysis={analysis} applyExtraction={applyExtraction} uploadError={uploadError} />
              ) : null}
              {step === 1 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <TextField form={form} name="name" label="Full name" placeholder="Enter your full name" helper="This personalizes your dashboard and reports." />
                  <TextField form={form} name="dateOfBirth" type="date" label="Date of birth" placeholder="" helper="We calculate age from this. Age helps retirement planning and risk suggestions." />
                  <ReadOnly label="Age" value={String(values.age || 0)} helper="Auto-calculated from your date of birth." />
                  <TextField form={form} name="occupation" label="Occupation" placeholder="e.g., Product manager, founder, student" helper="Occupation helps understand income stability." />
                  <TextField form={form} name="city" label="City" placeholder="e.g., Bengaluru" helper="City helps estimate living costs and goal assumptions." />
                  <SelectField form={form} name="maritalStatus" label="Marital status" placeholder="Select status" options={["Single", "Married", "Partnered"]} helper="This can affect responsibilities, emergency money, and insurance needs." />
                </div>
              ) : null}
              {step === 2 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <NumberField form={form} name="monthlySalary" label="Fixed monthly salary" placeholder="Enter salary after tax, e.g., Rs 1,50,000" helper="Your regular monthly income after tax." />
                  <NumberField form={form} name="bonusIncome" label="Variable bonus or incentives" placeholder="Monthly average, e.g., Rs 20,000" helper="Use an average if bonus changes month to month." />
                  <NumberField form={form} name="sideIncome" label="Side income" placeholder="Freelance, rent, consulting income" helper="Additional income you receive regularly." />
                  <NumberField form={form} name="otherIncome" label="Other income" placeholder="Any other monthly income" helper="Include only money you expect most months." />
                  <ReadOnly label="Total monthly inflow" value={`Rs ${Number(values.monthlyCashInflow || 0).toLocaleString("en-IN")}`} helper="This is the total money you receive every month before expenses." />
                </div>
              ) : null}
              {step === 3 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <NumberField form={form} name="rent" label="Rent" placeholder="Enter monthly rent, e.g., Rs 30,000" helper="Monthly housing rent." />
                  <NumberField form={form} name="emi" label="Existing EMIs" placeholder="Total EMI you already pay each month" helper="Includes home, car, personal, or education loan EMIs." />
                  <NumberField form={form} name="loans" label="Outstanding loan amount" placeholder="Total remaining loan balance" helper="This helps estimate debt burden." />
                  <NumberField form={form} name="subscriptions" label="Subscriptions" placeholder="Netflix, apps, tools, memberships" helper="Recurring payments can quietly reduce savings." />
                  <NumberField form={form} name="creditCardDebt" label="Credit card debt" placeholder="Unpaid credit card balance" helper="Credit card debt can be expensive and should be handled carefully." />
                  <NumberField form={form} name="monthlyExpenses" label="Total monthly expenses" placeholder="All spending per month, e.g., Rs 80,000" helper="Include groceries, bills, shopping, food, travel, and other regular spending." />
                </div>
              ) : null}
              {step === 4 ? (
                <div className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <NumberField form={form} name="stocksValue" label="Direct stocks" placeholder="Total value of your direct stock investments" helper="Use current market value, not purchase price." />
                    <NumberField form={form} name="mutualFundsValue" label="Mutual funds" placeholder="Current value of all mutual funds" helper="Include SIP and lumpsum mutual fund holdings." />
                    <NumberField form={form} name="cryptoValue" label="Crypto" placeholder="Current value of crypto holdings" helper="Crypto is high risk; this helps cap exposure." />
                    <NumberField form={form} name="goldValue" label="Gold" placeholder="Jewellery, ETF, SGB, or digital gold value" helper="Gold can diversify but should not dominate the portfolio." />
                    <NumberField form={form} name="epfPpfValue" label="EPF / PPF" placeholder="Current EPF and PPF balance" helper="Long-term retirement-style savings." />
                    <NumberField form={form} name="realEstateValue" label="Real estate" placeholder="Current value of owned property" helper="Include property value, but keep loans in the debt section." />
                    <NumberField form={form} name="cashBalance" label="Cash and bank balance" placeholder="Savings account and cash balance" helper="This helps calculate your emergency fund strength." />
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">Additional investments</p>
                        <p className="mt-1 text-xs text-muted-foreground">Add bonds, NPS, fixed deposits, ESOPs, RSUs, ETFs, or anything else you own.</p>
                      </div>
                      <Button type="button" variant="outline" onClick={() => append({ type: "", value: 0, notes: "" })}><Plus className="h-4 w-4" /> Add another investment</Button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {fields.map((field, index) => (
                        <div key={field.id} className="grid gap-3 rounded-md bg-white/5 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                          <SelectField form={form} name={`additionalInvestments.${index}.type`} label="Type" placeholder="Select type" options={investmentOptions} />
                          <NumberField form={form} name={`additionalInvestments.${index}.value`} label="Current value" placeholder="Amount today" />
                          <TextField form={form} name={`additionalInvestments.${index}.notes`} label="Notes" placeholder="Optional details" />
                          <Button type="button" variant="outline" size="icon" className="self-end" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {step === 5 ? (
                <div className="space-y-6">
                  <SectionIntro title="Short-term risk comfort" text="This helps us understand how much temporary loss you can tolerate for short-term opportunities like tactical investments." />
                  <div className="grid gap-5 md:grid-cols-2">
                    <SelectField form={form} name="shortTermLossTolerance" label="Maximum short-term loss you can tolerate" placeholder="Choose a range" options={["0-5%", "5-10%", "10-15%", "15%+"]} helper="Example: if Rs 1,00,000 falls by 10%, the temporary loss is Rs 10,000." />
                    <SelectField form={form} name="shortTermHorizon" label="Short-term investment timeline" placeholder="Choose timeline" options={["Less than 3 months", "3-6 months", "6-12 months", "1-2 years"]} helper="This decides whether short-term ideas are suitable." />
                    <SelectField form={form} name="shortTermVolatilityComfort" label="Comfort with quick ups and downs" placeholder="Choose comfort" options={["Low", "Moderate", "High"]} helper="Volatility means prices moving up and down quickly." />
                    <SelectField form={form} name="opportunityPreference" label="Opportunity style" placeholder="Choose style" options={["Fewer high-confidence calls", "Balanced", "Frequent opportunities"]} helper="This controls how selective short-term suggestions should be." />
                  </div>
                  <SectionIntro title="Long-term risk comfort" text="This helps us decide how aggressively your long-term wealth should be invested." />
                  <div className="grid gap-5 md:grid-cols-2">
                    <SelectField form={form} name="drawdownTolerance" label="Long-term temporary fall comfort" placeholder="Choose comfort" options={["0-10%", "15-25%", "25%+"]} helper="A drawdown is a temporary fall in investment value before it recovers." />
                    <SelectField form={form} name="volatilityComfort" label="Stability vs higher growth" placeholder="Choose preference" options={["Low", "Moderate", "High"]} helper="Higher growth usually comes with bigger temporary falls." />
                    <SelectField form={form} name="liquidityRequirement" label="Emergency money requirement" placeholder="Choose months" options={["3 months", "6 months", "12 months"]} helper="Liquidity means money you can access quickly." />
                    <SelectField form={form} name="investmentHorizon" label="Long-term investment horizon" placeholder="Choose horizon" options={["1-3 years", "3-5 years", "7-10 years", "10+ years"]} helper="Longer horizons can usually handle more market ups and downs." />
                    <NumberField form={form} name="retirementAge" label="Planned retirement age" placeholder="e.g., 60" helper="Used for retirement timeline calculations." />
                  </div>
                </div>
              ) : null}
              {step === 6 ? (
                <div className="space-y-6">
                  <SectionIntro title="Goal planning" text="Goals show how much you need to save every month and whether a loan EMI would put pressure on your savings." />
                  <div className="grid gap-5 md:grid-cols-2">
                    <NumberField form={form} name="emergencyFundTarget" label="Emergency fund target" placeholder="Usually 6 months of expenses" helper="Money kept aside for sudden expenses." />
                    <NumberField form={form} name="housePurchaseTarget" label="House purchase target" placeholder="Target property cost or down payment" helper="You can compare save-first vs EMI below." />
                    <SelectField form={form} name="housePlan.mode" label="House payment style" placeholder="Choose style" options={["lumpsum", "emi"]} helper="Choose whether you want to save first or estimate a loan EMI." />
                    <NumberField form={form} name="housePlan.downPayment" label="House down payment" placeholder="Amount you can pay upfront" />
                    <NumberField form={form} name="housePlan.interestRate" label="Loan interest rate" placeholder="e.g., 8.5" />
                    <NumberField form={form} name="housePlan.tenureYears" label="Loan tenure in years" placeholder="e.g., 20" />
                  </div>
                  <SectionIntro title="Travel goal" text="Tell us how often you travel. We calculate a yearly travel budget automatically." />
                  <div className="grid gap-5 md:grid-cols-2">
                    <NumberField form={form} name="internationalTrips" label="International trips per year" placeholder="e.g., 1" />
                    <NumberField form={form} name="domesticTrips" label="Domestic trips per year" placeholder="e.g., 2" />
                    <NumberField form={form} name="internationalTripCost" label="Average international trip cost" placeholder="Default Rs 2,00,000" />
                    <NumberField form={form} name="domesticTripCost" label="Average domestic trip cost" placeholder="Default Rs 60,000" />
                    <ReadOnly label="Yearly travel goal" value={`Rs ${Number(values.travelTarget || 0).toLocaleString("en-IN")}`} />
                  </div>
                  <SectionIntro title="Retirement and financial freedom" text="You can enter a total corpus or tell us the income you want. We estimate the required corpus from assumptions." />
                  <div className="grid gap-5 md:grid-cols-2">
                    <SelectField form={form} name="retirementInputType" label="Retirement input type" placeholder="Choose type" options={["corpus", "monthly", "yearly"]} />
                    <NumberField form={form} name="retirementTarget" label="Retirement corpus" placeholder="Total amount needed, if known" />
                    <NumberField form={form} name="retirementMonthlyIncome" label="Desired monthly retirement income" placeholder="e.g., Rs 1,00,000" />
                    <NumberField form={form} name="retirementYearlyIncome" label="Desired yearly retirement income" placeholder="e.g., Rs 12,00,000" />
                    <NumberField form={form} name="expectedInflation" label="Expected inflation %" placeholder="e.g., 6" />
                    <NumberField form={form} name="lifeExpectancy" label="Life expectancy" placeholder="e.g., 85" />
                    <NumberField form={form} name="postRetirementReturn" label="Post-retirement return %" placeholder="e.g., 7" />
                    <SelectField form={form} name="financialFreedomInputType" label="Financial freedom input type" placeholder="Choose type" options={["corpus", "monthly", "yearly"]} />
                    <NumberField form={form} name="financialFreedomTarget" label="Financial freedom target corpus" placeholder="Total target amount" />
                    <NumberField form={form} name="passiveMonthlyIncome" label="Monthly passive income target" placeholder="e.g., Rs 1,50,000" />
                    <NumberField form={form} name="passiveYearlyIncome" label="Yearly passive income target" placeholder="e.g., Rs 18,00,000" />
                    <NumberField form={form} name="withdrawalRate" label="Withdrawal rate %" placeholder="Default 4" helper="A 4% withdrawal rate means Rs 1 crore may support about Rs 4 lakh per year before tax." />
                  </div>
                </div>
              ) : null}
              {step === 7 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  <SelectField form={form} name="spendingDiscipline" label="How disciplined are you with monthly spending?" placeholder="Choose answer" options={["Needs work", "Improving", "Strong"]} />
                  <SelectField form={form} name="emotionalSpendingTendency" label="Do you make impulse purchases?" placeholder="Choose answer" options={["Rarely", "Sometimes", "Often", "High"]} />
                  <SelectField form={form} name="riskReaction" label="How do you react when investments fall by 10%?" placeholder="Choose answer" options={["Panic sell", "Wait and review", "Reviews before selling", "Buy more if plan still fits"]} />
                  <SelectField form={form} name="investmentPsychology" label="Do you prefer stable returns or high growth?" placeholder="Choose answer" options={["Stable returns", "Balanced", "High growth", "Research-led"]} />
                  <SelectField form={form} name="panicSellRisk" label="Do you panic-sell during market falls?" placeholder="Choose answer" options={["Yes", "No", "Not sure"]} />
                  <SelectField form={form} name="tracksExpenses" label="Do you track expenses regularly?" placeholder="Choose answer" options={["Yes", "No", "Sometimes"]} />
                  <SelectField form={form} name="investsMonthly" label="Do you invest consistently every month?" placeholder="Choose answer" options={["Yes", "No", "Sometimes", "Always"]} />
                </div>
              ) : null}

              <div className="mt-8 flex justify-between">
                <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
                  <ArrowLeft className="h-4 w-4" /> Previous
                </Button>
                {step < stepTitles.length - 1 ? (
                  <Button type="button" onClick={() => setStep((value) => value + 1)}>
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="submit">Save profile and open dashboard</Button>
                )}
              </div>
              {Object.keys(form.formState.errors).length ? <p className="mt-4 text-sm text-red-300">Some required fields need your answer before saving.</p> : null}
            </CardContent>
          </Card>
        </form>
      </div>
    </main>
  );
}

function SetupStep({ setupMode, setSetupMode, upload, uploadProgress, analysis, applyExtraction, uploadError }: {
  setupMode: string;
  setSetupMode: (value: "documents" | "manual") => void;
  upload: (file?: File) => void;
  uploadProgress: number;
  analysis: DocumentAnalysis | null;
  applyExtraction: () => void;
  uploadError: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <button type="button" onClick={() => setSetupMode("documents")} className={`rounded-md border p-5 text-left ${setupMode === "documents" ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"}`}>
        <FileUp className="h-6 w-6 text-primary" />
        <h2 className="mt-4 text-lg font-semibold text-white">Auto-fill using documents</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Upload a bank statement, salary slip, brokerage statement, mutual fund statement, P/L statement, or tax document. PDF, CSV, and XLSX parsing works in this MVP. Image OCR is coming soon.</p>
      </button>
      <button type="button" onClick={() => setSetupMode("manual")} className={`rounded-md border p-5 text-left ${setupMode === "manual" ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"}`}>
        <Save className="h-6 w-6 text-primary" />
        <h2 className="mt-4 text-lg font-semibold text-white">Enter manually</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Start with blank fields and helpful placeholders. Use this if documents are not ready or you prefer entering values yourself.</p>
      </button>
      {setupMode === "documents" ? (
        <div className="lg:col-span-2 rounded-md border border-white/10 bg-white/5 p-5">
          <Label>Upload PDF, CSV, or XLSX</Label>
          <Input className="mt-2" type="file" accept=".pdf,.csv,.xlsx,.xls" onChange={(event) => upload(event.target.files?.[0])} />
          {uploadProgress > 0 ? <Progress value={uploadProgress} className="mt-4" /> : null}
          {uploadError ? <p className="mt-3 text-sm text-red-300">{uploadError}</p> : null}
          {analysis ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-200">{analysis.summary.extractionStatus} - {analysis.summary.confidence}% confidence</p>
                <Button type="button" onClick={applyExtraction}>Apply extracted values</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {analysis.extractedFields.map((field) => (
                  <div key={field.field} className="rounded-md bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{field.label}</p>
                      <span className={field.status === "Needs your review" ? "text-xs text-amber-200" : "text-xs text-primary"}>{field.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{String(field.value || "No value found")}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{field.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md bg-primary/[0.08] p-4">
      <p className="font-medium text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function TextField({ form, name, label, placeholder, helper, type = "text" }: { form: ReturnType<typeof useForm<OnboardingProfile>>; name: FieldPath<OnboardingProfile>; label: string; placeholder: string; helper?: string; type?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Controller control={form.control} name={name} render={({ field }) => <Input type={type} value={String(field.value || "")} onChange={field.onChange} placeholder={placeholder} />} />
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function NumberField({ form, name, label, placeholder, helper }: { form: ReturnType<typeof useForm<OnboardingProfile>>; name: NumberPath; label: string; placeholder: string; helper?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Input
            type="number"
            inputMode="numeric"
            value={Number(field.value || 0) === 0 ? "" : Number(field.value)}
            onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
            placeholder={placeholder}
          />
        )}
      />
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function SelectField({ form, name, label, placeholder, options, helper }: { form: ReturnType<typeof useForm<OnboardingProfile>>; name: FieldPath<OnboardingProfile>; label: string; placeholder: string; options: string[]; helper?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={String(field.value || "")} onValueChange={field.onChange}>
            <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
            <SelectContent>
              {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function ReadOnly({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-10 items-center rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white">{value}</div>
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}
