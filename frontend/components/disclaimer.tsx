import { cn } from "@/lib/utils";

/**
 * Standard risk / not-advice disclaimer, shared across the app so the wording
 * stays consistent. AskPapa is a free educational recommendation tool, not a
 * registered adviser, so every money surface carries this baseline.
 *
 * `compact` is a single muted line for in-app footers; `full` is the longer
 * version for the landing page and other first-touch surfaces.
 */
export function Disclaimer({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const text =
    variant === "full"
      ? "AskPapa is a free educational tool. It shares general information and recommendations for you to consider, not personalized investment, financial, legal, or tax advice, and it is not a SEBI registered investment adviser. Investments carry risk, including the possible loss of capital, and past performance does not guarantee future returns. Please verify details and consult a qualified professional before you invest."
      : "AskPapa shares educational information and recommendations, not investment advice. Investments carry market risk. Verify details and consider a qualified adviser before you invest.";
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{text}</p>;
}
