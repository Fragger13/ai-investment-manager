import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bitcoin,
  BriefcaseBusiness,
  Building2,
  Car,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  Droplets,
  Eye,
  FileText,
  Factory,
  Gem,
  GraduationCap,
  Hand,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Layers3,
  Leaf,
  Minus,
  Plane,
  RefreshCw,
  Rocket,
  Scale,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Stethoscope,
  Target,
  TrendingDown,
  TrendingUp,
  Download,
  WalletCards,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IconAccent } from "@/components/colorful-icon";

export type IconSpec = { icon: LucideIcon; accent: IconAccent; label: string };

export function assetIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (includesAny(text, ["crypto", "bitcoin", "ethereum", "btc", "eth"])) return spec(Bitcoin, "orange", "Digital asset");
  if (text.includes("silver")) return spec(Coins, "blue", "Silver");
  if (includesAny(text, ["gold", "sovereign"])) return spec(Coins, "amber", "Gold");
  if (includesAny(text, ["real estate", "reit", "invit"])) return spec(House, "violet", "Real estate");
  if (includesAny(text, ["commodity", "oil", "energy"])) return spec(Droplets, "orange", "Commodity");
  if (includesAny(text, ["cash", "liquid"])) return spec(Banknote, "emerald", "Cash or liquid investment");
  if (includesAny(text, ["debt", "bond", "fixed deposit"])) return spec(Landmark, "blue", "Bond or debt investment");
  if (includesAny(text, ["etf", "bees"])) return spec(Layers3, "cyan", "ETF");
  if (includesAny(text, ["mutual fund", "index fund", "fund"])) return spec(WalletCards, "violet", "Mutual fund");
  if (includesAny(text, ["stock", "share", "equity", "ltd"])) return spec(Building2, "cyan", "Stock");
  return spec(CircleDollarSign, "emerald", "Investment");
}

export function actionIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (includesAny(text, ["watch", "keep an eye"])) return spec(Eye, "blue", "Keep an eye on");
  if (includesAny(text, ["exit", "avoid"])) return spec(ArrowDownRight, "rose", "Exit or avoid");
  if (includesAny(text, ["reduce", "trim"])) return spec(TrendingDown, "orange", "Reduce");
  if (text.includes("hold")) return spec(Hand, "amber", "Hold");
  if (includesAny(text, ["accumulate", "add", "gradually"])) return spec(Download, "emerald", "Add gradually");
  return spec(ArrowUpRight, "emerald", "Consider buying");
}

export function riskIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (text.includes("high")) return spec(AlertTriangle, "rose", "High risk");
  if (text.includes("medium")) return spec(Scale, "amber", "Medium risk");
  return spec(ShieldCheck, "emerald", "Low risk");
}

export function explanationIconSpec(title: string): IconSpec {
  const text = title.toLowerCase();
  if (includesAny(text, ["seeing this", "recommended"])) return spec(Target, "orange", "Why you are seeing this");
  if (includesAny(text, ["good time", "why now"])) return spec(Clock3, "blue", "Why the timing may matter");
  if (includesAny(text, ["promising", "supports"])) return spec(CheckCircle2, "emerald", "What supports this idea");
  if (includesAny(text, ["careful", "wrong", "risk"])) return spec(AlertTriangle, "amber", "What to be careful about");
  if (includesAny(text, ["do next", "act"])) return spec(Rocket, "cyan", "What to do next");
  if (includesAny(text, ["change this outlook", "invalidate"])) return spec(RefreshCw, "violet", "What could change this outlook");
  return spec(Activity, "cyan", "Explanation");
}

export function detailSectionIconSpec(title: string): IconSpec {
  const text = title.toLowerCase();
  if (includesAny(text, ["action", "next step"])) return spec(Rocket, "cyan", "Suggested action");
  if (includesAny(text, ["why this matters", "fits your situation", "who this may suit", "goal"])) return spec(Target, "violet", "Why this fits");
  if (includesAny(text, ["why it is showing now", "timing", "possible effects"])) return spec(Clock3, "blue", "Timing and possible effects");
  if (includesAny(text, ["supporting", "signals", "evidence"])) return spec(CheckCircle2, "emerald", "Supporting information");
  if (includesAny(text, ["risk", "watch", "careful"])) return spec(AlertTriangle, "amber", "Risks to watch");
  if (includesAny(text, ["invalidate", "change this outlook", "review"])) return spec(RefreshCw, "violet", "What could change this outlook");
  if (includesAny(text, ["source", "data point"])) return spec(FileText, "blue", "Sources and data points");
  if (text.includes("summary")) return spec(Activity, "cyan", "Summary");
  return spec(Activity, "cyan", title);
}

export function marketIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (includesAny(text, ["interest", "rate", "rbi", "bank", "nbfc"])) return spec(Landmark, "blue", "Banking or interest-rate update");
  if (includesAny(text, ["inflation", "price rise"])) return spec(TrendingUp, "orange", "Inflation update");
  if (includesAny(text, ["policy", "government", "budget"])) return spec(Landmark, "violet", "Government policy update");
  if (includesAny(text, ["gold", "precious"])) return spec(Coins, "amber", "Gold update");
  if (includesAny(text, ["oil", "crude", "energy"])) return spec(Droplets, "orange", "Energy update");
  if (includesAny(text, ["crypto", "bitcoin", "ethereum"])) return spec(Bitcoin, "orange", "Digital-asset update");
  if (includesAny(text, ["technology", "software", "it "])) return spec(Laptop, "cyan", "Technology update");
  if (includesAny(text, ["health", "pharma"])) return spec(Stethoscope, "emerald", "Healthcare update");
  if (includesAny(text, ["infrastructure", "cement", "construction"])) return spec(Factory, "amber", "Infrastructure update");
  if (includesAny(text, ["defence", "defense"])) return spec(Shield, "blue", "Defence update");
  if (includesAny(text, ["consumer", "consumption", "retail"])) return spec(ShoppingCart, "violet", "Consumer update");
  if (includesAny(text, ["real estate", "housing"])) return spec(House, "violet", "Real-estate update");
  return spec(Activity, "cyan", "Market update");
}

export function directionIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (includesAny(text, ["bullish", "positive"])) return spec(TrendingUp, "emerald", "Positive update");
  if (includesAny(text, ["bearish", "negative"])) return spec(TrendingDown, "rose", "Negative update");
  return spec(Minus, "amber", "Mixed or neutral update");
}

export function opportunityIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (text.includes("income")) return spec(CircleDollarSign, "emerald", "Income opportunity");
  if (includesAny(text, ["value", "undervalued", "contrarian"])) return spec(Gem, "violet", "Value opportunity");
  if (includesAny(text, ["momentum", "tactical", "short-term"])) return spec(Zap, "amber", "Short-term opportunity");
  if (includesAny(text, ["defensive", "stability"])) return spec(Shield, "blue", "Stability-focused opportunity");
  if (text.includes("turnaround")) return spec(RefreshCw, "orange", "Turnaround opportunity");
  if (includesAny(text, ["high conviction", "strong opportunity"])) return spec(CheckCircle2, "emerald", "Strong opportunity");
  if (includesAny(text, ["emerging", "underdog"])) return spec(Sprout, "emerald", "Emerging opportunity");
  return spec(Rocket, "cyan", "Growth opportunity");
}

export function goalIconSpec(value: string): IconSpec {
  const text = value.toLowerCase();
  if (text.includes("marriage")) return spec(HeartPulse, "rose", "Marriage goal");
  if (includesAny(text, ["house", "home"])) return spec(House, "violet", "Home goal");
  if (text.includes("car")) return spec(Car, "blue", "Car goal");
  if (text.includes("retirement")) return spec(Leaf, "emerald", "Retirement goal");
  if (text.includes("freedom")) return spec(Sprout, "emerald", "Financial freedom goal");
  if (text.includes("travel")) return spec(Plane, "cyan", "Travel goal");
  if (text.includes("education")) return spec(GraduationCap, "blue", "Education goal");
  if (includesAny(text, ["business", "startup"])) return spec(BriefcaseBusiness, "amber", "Business goal");
  return spec(Target, "violet", "Financial goal");
}

function spec(icon: LucideIcon, accent: IconAccent, label: string): IconSpec {
  return { icon, accent, label };
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}
