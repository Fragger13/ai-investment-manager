// Indian digit grouping (12,34,567) without relying on Intl availability in
// Hermes across OS versions — mirrors the web app's formatting.
export function formatINR(value: number | null | undefined): string {
  const n = Math.round(Number(value || 0));
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(n).toString();
  if (digits.length <= 3) return `${sign}₹${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${rest},${last3}`;
}

// Compact form for headline numbers: ₹1.2L, ₹3.4Cr.
export function formatINRCompact(value: number | null | undefined): string {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 0 : 1)}L`;
  return formatINR(n);
}
