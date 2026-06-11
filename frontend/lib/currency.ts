export function parseIndianCurrencyInput(value: string | number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatIndianCurrencyInput(value: string | number): string {
  const amount = parseIndianCurrencyInput(value);
  return amount ? amount.toLocaleString("en-IN") : "";
}

export function formatINR(value: string | number): string {
  return `₹${parseIndianCurrencyInput(value).toLocaleString("en-IN")}`;
}
