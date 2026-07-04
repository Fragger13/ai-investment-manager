"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, FieldPath, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseIndianCurrencyInput } from "@/lib/currency";
import { INDIAN_CITIES } from "@/lib/indian-cities";
import { OnboardingProfile } from "@/types";
import { HelpHint, HintLink } from "./help-hint";

export function fieldError(errors: Record<string, unknown>, name: string): string {
  const parts = name.split(".");
  let current: unknown = errors;
  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (!current || typeof current !== "object") return "";
  const message = (current as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

type BaseProps = {
  name: FieldPath<OnboardingProfile>;
  label?: string;
  placeholder?: string;
  helper?: string;
  autoFocus?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  hintLink?: HintLink;
  action?: React.ReactNode;
};

export function FieldLabel({ label, optional, hint, hintLink, action }: { label: string; optional?: boolean; hint?: React.ReactNode; hintLink?: HintLink; action?: React.ReactNode }) {
  return (
    <Label className="inline-flex items-center gap-1.5 text-sm text-[#374151]">
      <span>
        {label}
        {!optional ? <span className="ml-1 text-red-500" aria-hidden>*</span> : null}
      </span>
      {hint ? <HelpHint text={hint} link={hintLink} label={label} /> : null}
      {action}
    </Label>
  );
}

// Number/currency inputs keep a local string so a deliberately-typed "0" sticks
// instead of being swallowed (the form stores 0 as the "empty" default, which the
// raw-number display turned back into a blank). A truly empty field still shows
// its placeholder; only an explicit "0" renders as "0".

function NumberInput({ value, onChange, className, placeholder, autoFocus }: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [raw, setRaw] = useState<string>(value === 0 ? "" : String(value));
  const lastValue = useRef(value);
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    const parsed = raw === "" ? 0 : Number(raw);
    if (parsed !== value) setRaw(value === 0 ? "" : String(value));
  }, [value, raw]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      className={className}
      value={raw}
      onChange={(event) => {
        // digits with at most one decimal point (rates like 8.5 need decimals)
        const cleaned = event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
        setRaw(cleaned);
        const next = cleaned === "" || cleaned === "." ? 0 : Number(cleaned);
        const safe = Number.isFinite(next) ? next : 0;
        lastValue.current = safe;
        onChange(safe);
      }}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}

function CurrencyInput({ value, onChange, className, placeholder, autoFocus }: {
  value: number;
  onChange: (next: number) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [raw, setRaw] = useState<string>(value ? value.toLocaleString("en-IN") : "");
  const lastValue = useRef(value);
  useEffect(() => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    if (parseIndianCurrencyInput(raw) !== value) setRaw(value ? value.toLocaleString("en-IN") : "");
  }, [value, raw]);
  return (
    <Input
      type="text"
      inputMode="numeric"
      className={className}
      value={raw}
      onChange={(event) => {
        const digits = event.target.value.replace(/[^\d]/g, "");
        setRaw(digits === "" ? "" : Number(digits).toLocaleString("en-IN"));
        const next = digits === "" ? 0 : Number(digits);
        lastValue.current = next;
        onChange(next);
      }}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}

export function TextField({ name, label, placeholder, helper, autoFocus, optional, hint, hintLink, action, type = "text", sanitize }: BaseProps & { type?: string; sanitize?: (raw: string) => string }) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} hint={hint} hintLink={hintLink} action={action} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            type={type}
            className="text-[15px] placeholder:text-[#4B5563]"
            value={String(field.value ?? "")}
            onChange={(event) => field.onChange(sanitize ? sanitize(event.target.value) : event.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
          />
        )}
      />
      {helper ? <p className="text-[13px] leading-5 text-[#4B5563]">{helper}</p> : null}
      {error ? <p className="text-[13px] leading-5 text-negative-foreground">{error}</p> : null}
    </div>
  );
}

// City input with type-ahead suggestions from a bundled Indian-cities list.
// Free text is still allowed so smaller towns that aren't on the list work.
export function CityField({ name, label, placeholder, helper, optional, hint, hintLink }: BaseProps) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as string[];
    const starts = INDIAN_CITIES.filter((c) => c.toLowerCase().startsWith(q));
    const contains = INDIAN_CITIES.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 8);
  }, [query]);

  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} hint={hint} hintLink={hintLink} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          const choose = (city: string) => {
            field.onChange(city);
            setQuery("");
            setOpen(false);
          };
          return (
            <div className="relative">
              <Input
                type="text"
                className="text-[15px] placeholder:text-[#4B5563]"
                value={String(field.value ?? "")}
                placeholder={placeholder}
                onChange={(event) => {
                  field.onChange(event.target.value);
                  setQuery(event.target.value);
                  setOpen(true);
                  setHighlight(0);
                }}
                onFocus={() => { if (String(field.value ?? "")) setQuery(String(field.value)); setOpen(true); }}
                onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
                onKeyDown={(event) => {
                  if (!open || matches.length === 0) return;
                  if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((h) => Math.min(h + 1, matches.length - 1)); }
                  else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
                  else if (event.key === "Enter") { event.preventDefault(); choose(matches[highlight]); }
                  else if (event.key === "Escape") { setOpen(false); }
                }}
                autoComplete="off"
              />
              {open && matches.length > 0 ? (
                <ul
                  className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
                  onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
                >
                  {matches.map((city, idx) => (
                    <li key={city}>
                      <button
                        type="button"
                        className={`flex w-full items-center px-3 py-1.5 text-left text-[15px] ${idx === highlight ? "bg-surface-hover" : ""} hover:bg-surface-hover`}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => choose(city)}
                      >
                        {city}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        }}
      />
      {helper ? <p className="text-[13px] leading-5 text-[#4B5563]">{helper}</p> : null}
      {error ? <p className="text-[13px] leading-5 text-negative-foreground">{error}</p> : null}
    </div>
  );
}

export function NumberField({ name, label, placeholder, helper, autoFocus, optional, hint, hintLink }: BaseProps) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} hint={hint} hintLink={hintLink} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <NumberInput
            className="text-[15px] placeholder:text-[#4B5563]"
            value={Number(field.value ?? 0)}
            onChange={field.onChange}
            placeholder={placeholder}
            autoFocus={autoFocus}
          />
        )}
      />
      {helper ? <p className="text-[13px] leading-5 text-[#4B5563]">{helper}</p> : null}
      {error ? <p className="text-[13px] leading-5 text-negative-foreground">{error}</p> : null}
    </div>
  );
}

export function CurrencyField({ name, label, placeholder, helper, autoFocus, optional, hint, hintLink, action, size = "md" }: BaseProps & { size?: "md" | "lg" }) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  const sizeCls =
    size === "lg"
      ? "h-12 pl-9 text-lg font-semibold placeholder:text-[#4B5563] placeholder:font-normal"
      : "pl-7 text-[15px] placeholder:text-[#4B5563] placeholder:font-normal";
  const symbolCls =
    size === "lg" ? "left-3.5 text-lg font-semibold" : "left-3 text-[15px]";
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} hint={hint} hintLink={hintLink} action={action} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="relative">
            <span className={`pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground ${symbolCls}`}>₹</span>
            <CurrencyInput
              className={sizeCls}
              value={Number(field.value ?? 0)}
              onChange={field.onChange}
              placeholder={placeholder}
              autoFocus={autoFocus}
            />
          </div>
        )}
      />
      {helper ? <p className="text-[13px] leading-5 text-[#4B5563]">{helper}</p> : null}
      {error ? <p className="text-[13px] leading-5 text-negative-foreground">{error}</p> : null}
    </div>
  );
}

export function SelectField({ name, label, placeholder, helper, options, optional, hint, hintLink }: BaseProps & { options: string[] }) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} hint={hint} hintLink={hintLink} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={String(field.value ?? "")} onValueChange={field.onChange}>
            <SelectTrigger className="text-[15px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
            <SelectContent>
              {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />
      {helper ? <p className="text-[13px] leading-5 text-[#4B5563]">{helper}</p> : null}
      {error ? <p className="text-[13px] leading-5 text-negative-foreground">{error}</p> : null}
    </div>
  );
}

export function ReadOnly({ label, value, helper }: { label?: string; value: string; helper?: string }) {
  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <div className="flex h-10 items-center rounded-md border border-border bg-surface-hover px-3 text-sm text-foreground">{value}</div>
      {helper ? <p className="text-[13px] leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}
