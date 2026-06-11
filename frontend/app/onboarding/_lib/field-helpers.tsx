"use client";

import { Controller, FieldPath, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatIndianCurrencyInput, parseIndianCurrencyInput } from "@/lib/currency";
import { OnboardingProfile } from "@/types";

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
};

export function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <Label className="text-sm text-[#374151]">
      {label}
      {!optional ? <span className="ml-1 text-red-500" aria-hidden>*</span> : null}
    </Label>
  );
}

export function TextField({ name, label, placeholder, helper, autoFocus, optional, type = "text" }: BaseProps & { type?: string }) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            type={type}
            className="text-[15px] placeholder:text-[#4B5563]"
            value={String(field.value ?? "")}
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

export function NumberField({ name, label, placeholder, helper, autoFocus, optional }: BaseProps) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            type="number"
            inputMode="numeric"
            className="text-[15px] placeholder:text-[#4B5563]"
            value={Number(field.value ?? 0) === 0 ? "" : Number(field.value)}
            onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
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

export function CurrencyField({ name, label, placeholder, helper, autoFocus, optional, size = "md" }: BaseProps & { size?: "md" | "lg" }) {
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
      {label ? <FieldLabel label={label} optional={optional} /> : null}
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="relative">
            <span className={`pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground ${symbolCls}`}>₹</span>
            <Input
              type="text"
              inputMode="numeric"
              className={sizeCls}
              value={formatIndianCurrencyInput(Number(field.value ?? 0))}
              onChange={(event) => field.onChange(parseIndianCurrencyInput(event.target.value))}
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

export function SelectField({ name, label, placeholder, helper, options, optional }: BaseProps & { options: string[] }) {
  const { control, formState } = useFormContext<OnboardingProfile>();
  const error = fieldError(formState.errors as Record<string, unknown>, String(name));
  return (
    <div className="space-y-2">
      {label ? <FieldLabel label={label} optional={optional} /> : null}
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
