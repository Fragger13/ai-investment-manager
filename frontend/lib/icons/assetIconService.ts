import manifest from "@/src/lib/icons/fundhouse-logo-manifest.json";
import type { AssetIcon } from "./types";

export type FundHouseLogoManifestEntry = {
  fundHouse: string;
  slug: string;
  file: string;
  sourceUrl: string;
  imageSourceUrl: string;
  license: string;
  retrievedAt: string;
};

type LocalIconRule = {
  match: RegExp;
  icon: AssetIcon;
};

const logoManifest = manifest as FundHouseLogoManifestEntry[];

/**
 * Maps a free-text scheme/fund name to a manifest slug.
 * Order matters — earlier rules win. Multi-word brands appear before
 * single-token brands they share words with (e.g. "aditya-birla-sun-life"
 * before "bandhan" so "Aditya Birla Bandhan" never resolves to bandhan).
 */
const FUND_HOUSE_ALIASES: { slug: string; match: RegExp }[] = [
  { slug: "360-one", match: /360\s*one|\b360\b/i },
  { slug: "abakkus", match: /\babakkus\b/i },
  { slug: "aditya-birla-sun-life", match: /\baditya\b|\bbirla\b|sun life|\babsl\b/i },
  { slug: "angel-one", match: /angel\s*one/i },
  { slug: "axis", match: /\baxis\b/i },
  { slug: "bajaj-finserv", match: /\bbajaj\b|finserv/i },
  { slug: "bandhan", match: /\bbandhan\b/i },
  { slug: "bank-of-india", match: /\bbank of india\b|\bboi\b|\baxa\b/i },
  { slug: "baroda-bnp-paribas", match: /\bbaroda\b|\bbnp\b|paribas/i },
  { slug: "canara-robeco", match: /\bcanara\b|robeco/i },
  { slug: "capitalmind", match: /capitalmind/i },
  { slug: "choice", match: /choice\s+(mf|mutual)/i },
  { slug: "dsp", match: /\bdsp\b/i },
  { slug: "edelweiss", match: /\bedelweiss\b/i },
  { slug: "franklin-templeton", match: /\bfranklin\b|\btempleton\b/i },
  { slug: "groww", match: /\bgroww\b/i },
  { slug: "hdfc", match: /\bhdfc\b/i },
  { slug: "helios", match: /\bhelios\b/i },
  { slug: "icici-prudential", match: /\bicici\b|prudential/i },
  { slug: "idbi", match: /\bidbi\b/i },
  { slug: "idfc", match: /\bidfc\b/i },
  { slug: "invesco", match: /\binvesco\b/i },
  { slug: "iti", match: /\biti\b/i },
  { slug: "jio-blackrock", match: /\bjio\b|\bblackrock\b/i },
  { slug: "jm-financial", match: /\bjm\b/i },
  { slug: "kotak", match: /\bkotak\b/i },
  { slug: "landt", match: /\bl\s*&\s*t\b|\blandt\b/i },
  { slug: "lic", match: /\blic\b/i },
  { slug: "mahindra-manulife", match: /\bmahindra\b|\bmanulife\b/i },
  { slug: "mirae-asset", match: /\bmirae\b/i },
  { slug: "motilal-oswal", match: /\bmotilal\b|\boswal\b/i },
  { slug: "navi", match: /\bnavi\b/i },
  { slug: "nippon-india", match: /\bnippon\b|reliance mutual/i },
  { slug: "nj", match: /\bnj\s+(mutual|mf|amc|flexi|cap|index|fund)/i },
  { slug: "peerless", match: /\bpeerless\b/i },
  { slug: "pgim-india", match: /\bpgim\b/i },
  { slug: "pioneer-iti", match: /pioneer\s+iti/i },
  { slug: "ppfas", match: /\bppfas\b|parag parikh/i },
  { slug: "quantum", match: /\bquantum\b/i },
  { slug: "quant", match: /\bquant\b/i },
  { slug: "religare", match: /\breligare\b/i },
  { slug: "sahara", match: /\bsahara\b/i },
  { slug: "samco", match: /\bsamco\b/i },
  { slug: "sbi", match: /\bsbi\b|state bank/i },
  { slug: "shriram", match: /\bshriram\b/i },
  { slug: "sundaram", match: /\bsundaram\b/i },
  { slug: "tata", match: /\btata\b/i },
  { slug: "taurus", match: /\btaurus\b/i },
  { slug: "the-wealth-company", match: /wealth\s+company/i },
  { slug: "trust", match: /\btrust\s+(mutual|mf|amc|flexi|cap|index|fund|equity|debt|liquid|hybrid)/i },
  { slug: "unifi", match: /\bunifi\b/i },
  { slug: "union", match: /\bunion\s+(mutual|mf|amc|flexi|cap|index|fund|equity|debt|liquid|hybrid)/i },
  { slug: "uti", match: /\buti\b/i },
  { slug: "whiteoak-capital", match: /\bwhiteoak\b|white oak/i },
  { slug: "zerodha", match: /\bzerodha\b/i },
];

const ASSET_FILE_ICONS: LocalIconRule[] = [
  { match: /\bgold\b|sgb|sovereign gold/i, icon: fileIcon("Gold", "/assets/icons/assets/gold-bars.svg", "bg-amber-50 dark:bg-amber-950/35") },
  { match: /\bsilver\b/i, icon: fileIcon("Silver", "/assets/icons/assets/silver-bars.svg", "bg-slate-100 dark:bg-slate-800") },
  { match: /\bbitcoin\b|\bbtc\b/i, icon: fileIcon("Bitcoin", "/assets/icons/assets/bitcoin.svg", "bg-orange-50 dark:bg-orange-950/35") },
  { match: /\bethereum\b|\beth\b/i, icon: fileIcon("Ethereum", "/assets/icons/assets/ethereum.svg", "bg-indigo-50 dark:bg-indigo-950/35") },
  { match: /\bbond\b|\bbonds\b|\bg[-\s]?sec\b|\bgilts?\b|\bdebt\b/i, icon: fileIcon("Bond", "/assets/icons/assets/bond.svg", "bg-emerald-50 dark:bg-emerald-950/35") },
  { match: /\betf\b/i, icon: fileIcon("ETF", "/assets/icons/assets/etf.svg", "bg-sky-50 dark:bg-sky-950/35") },
  { match: /mutual|\bfund\b|scheme/i, icon: fileIcon("Mutual Fund", "/assets/icons/assets/mutual-fund.svg", "bg-violet-50 dark:bg-violet-950/35") },
  { match: /\bstock\b|\bequity\b|\bshare\b|\bltd\b|limited/i, icon: fileIcon("Equity", "/assets/icons/assets/equity.svg", "bg-blue-50 dark:bg-blue-950/35") },
];

const SECTOR_FILE_ICONS: LocalIconRule[] = [
  { match: /\bbank|nbfc|financial services|psu bank/i, icon: fileIcon("Banking", "/assets/icons/sectors/banking.svg", "bg-blue-50 dark:bg-blue-950/35") },
  { match: /\bdefence\b|\bdefense\b|aerospace/i, icon: fileIcon("Defence", "/assets/icons/sectors/defence.svg", "bg-rose-50 dark:bg-rose-950/35") },
  { match: /infra(structure)?|construction|cement|capital goods/i, icon: fileIcon("Infrastructure", "/assets/icons/sectors/infrastructure.svg", "bg-amber-50 dark:bg-amber-950/35") },
  { match: /\btech\b|\bit\b|software|digital|ai fund|innovation/i, icon: fileIcon("Technology", "/assets/icons/sectors/technology.svg", "bg-cyan-50 dark:bg-cyan-950/35") },
  { match: /\benergy\b|\bpower\b|electric|renewable|solar/i, icon: fileIcon("Energy", "/assets/icons/sectors/energy.svg", "bg-yellow-50 dark:bg-yellow-950/35") },
  { match: /pharma|healthcare|hospital|medic|drug/i, icon: fileIcon("Healthcare", "/assets/icons/sectors/healthcare.svg", "bg-emerald-50 dark:bg-emerald-950/35") },
  { match: /\bfmcg\b|consumer|retail|consumption/i, icon: fileIcon("Consumer", "/assets/icons/sectors/consumer.svg", "bg-pink-50 dark:bg-pink-950/35") },
];

export function resolveImportedAssetIcon(input: {
  name: string;
  category?: string;
  ticker?: string;
}): AssetIcon | null {
  const text = `${input.name} ${input.category ?? ""} ${input.ticker ?? ""}`;

  const fundHouse = resolveFundHouseLogo(text);
  if (fundHouse) return fundHouse;

  const asset = ASSET_FILE_ICONS.find((rule) => rule.match.test(text));
  if (asset) return asset.icon;

  const sector = SECTOR_FILE_ICONS.find((rule) => rule.match.test(text));
  if (sector) return sector.icon;

  return null;
}

export function genericImportedInvestmentIcon(): AssetIcon {
  return fileIcon("Investment", "/assets/icons/assets/generic-investment.svg", "bg-slate-100 dark:bg-slate-800");
}

function resolveFundHouseLogo(text: string): AssetIcon | null {
  const alias = FUND_HOUSE_ALIASES.find((entry) => entry.match.test(text));
  if (alias) {
    const entry = logoManifest.find((item) => item.slug === alias.slug);
    if (entry?.file) return fileIcon(entry.fundHouse, entry.file, "bg-white dark:bg-white");
  }

  // Loose fallback: scan tokens against alias keywords. Catches cases like
  // "ABSL Tax Saver" or "ICICI Pru Equity" where the structured matcher
  // missed because the surrounding words were unusual.
  const tokens = text.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length < 3) continue;
    const slugGuess = LOOSE_TOKEN_TO_SLUG[token];
    if (!slugGuess) continue;
    const entry = logoManifest.find((item) => item.slug === slugGuess);
    if (entry?.file) return fileIcon(entry.fundHouse, entry.file, "bg-white dark:bg-white");
  }
  return null;
}

/**
 * Token-level lookup table used as a recovery layer for the structured
 * matcher. Keys are lowercase tokens that uniquely identify an AMC even
 * when they appear next to unexpected words.
 */
const LOOSE_TOKEN_TO_SLUG: Record<string, string> = {
  sbi: "sbi",
  hdfc: "hdfc",
  icici: "icici-prudential",
  prudential: "icici-prudential",
  pru: "icici-prudential",
  axis: "axis",
  kotak: "kotak",
  nippon: "nippon-india",
  mirae: "mirae-asset",
  tata: "tata",
  aditya: "aditya-birla-sun-life",
  birla: "aditya-birla-sun-life",
  absl: "aditya-birla-sun-life",
  motilal: "motilal-oswal",
  oswal: "motilal-oswal",
  dsp: "dsp",
  ppfas: "ppfas",
  parag: "ppfas",
  edelweiss: "edelweiss",
  quant: "quant",
  quantum: "quantum",
  canara: "canara-robeco",
  robeco: "canara-robeco",
  invesco: "invesco",
  lic: "lic",
  sundaram: "sundaram",
  taurus: "taurus",
  jm: "jm-financial",
  pgim: "pgim-india",
  baroda: "baroda-bnp-paribas",
  bnp: "baroda-bnp-paribas",
  paribas: "baroda-bnp-paribas",
  boi: "bank-of-india",
  bandhan: "bandhan",
  bajaj: "bajaj-finserv",
  finserv: "bajaj-finserv",
  franklin: "franklin-templeton",
  templeton: "franklin-templeton",
  groww: "groww",
  iti: "iti",
  jio: "jio-blackrock",
  blackrock: "jio-blackrock",
  mahindra: "mahindra-manulife",
  manulife: "mahindra-manulife",
  navi: "navi",
  samco: "samco",
  shriram: "shriram",
  uti: "uti",
  whiteoak: "whiteoak-capital",
  zerodha: "zerodha",
  helios: "helios",
  unifi: "unifi",
  abakkus: "abakkus",
  capitalmind: "capitalmind",
  angel: "angel-one",
};

function fileIcon(label: string, src: string, bg: string): AssetIcon {
  return {
    bg,
    text: "text-slate-900 dark:text-white",
    label,
    src,
  };
}
