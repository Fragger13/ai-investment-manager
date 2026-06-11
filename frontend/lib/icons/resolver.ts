import { BRAND_ICONS, BRAND_MATCHERS } from "./brands";
import { ASSET_ICONS } from "./assets";
import { CATEGORY_ICONS } from "./categories";
import { SECTOR_ICONS } from "./sectors";
import { actionIconFor } from "./actions";
import { cryptoIconFor } from "./crypto";
import { FALLBACK_ICON } from "./fallback";
import { resolveImportedAssetIcon } from "./assetIconService";
import type { AssetIcon } from "./types";

/**
 * Dispatcher.
 *
 * Priority order:
 *  1. Imported fund-house logo from the manifest — a real brand always wins
 *     so "Increase UTI Nifty 50 SIP" shows the UTI mark, not a generic
 *     "increase savings" action icon.
 *  2. Behavioural action (catch-up, avoid debt, emergency fund, etc.) — only
 *     when no fund-house was detected.
 *  3. Crypto (BTC / ETH / etc.) — recognised by ticker or coin name.
 *  4. Asset-specific (gold / silver / bonds / real-estate / cash).
 *  5. Sector (banking, defence, pharma, infrastructure, tech, energy, fmcg, auto, oil & gas).
 *  6. Mutual-fund category (index / large-mid-small-flexi-multi-cap / ELSS / hybrid / liquid / debt / international / sectoral).
 *  7. Generic stock or mutual fund.
 *  8. Fallback.
 */
export function resolveAssetIcon(input: {
  name: string;
  category?: string;
  ticker?: string;
}): AssetIcon {
  const text = `${input.name} ${input.category ?? ""} ${input.ticker ?? ""}`;
  const value = text.toLowerCase();

  // 1) Imported local fund-house logos. Brand wins over generic action verbs.
  const imported = resolveImportedAssetIcon(input);
  if (imported) return imported;

  // 2) Behavioural actions — only when nothing brand-like was detected.
  const action = actionIconFor(text);
  if (action) return action;

  // 3) Crypto
  const crypto = cryptoIconFor(text);
  if (crypto) return crypto;

  // 4) Brand marks — but only if no asset-specific keyword overrides
  const isAssetSpecific =
    value.includes("gold") ||
    value.includes("silver") ||
    value.includes("emergency");
  if (!isAssetSpecific) {
    const brand = BRAND_MATCHERS.find((entry) => entry.match.test(text));
    if (brand) return BRAND_ICONS[brand.key];
  }

  // 5) Asset-specific
  if (/\bgold\b|sgb|sovereign gold/.test(value)) return ASSET_ICONS.goldBar;
  if (/\bsilver\b/.test(value)) return ASSET_ICONS.silverBar;
  if (/\bemergency\b/.test(value)) return ASSET_ICONS.emergencyFund;
  if (/\bbond\b|\bbonds\b|\bg[-\s]?sec\b|\bgilts?\b/.test(value)) return ASSET_ICONS.bonds;
  if (/real estate|reit\b|invit\b|housing/.test(value)) return ASSET_ICONS.realEstate;
  if (/\bcash\b|\bsavings account\b/.test(value)) return ASSET_ICONS.cash;

  // 5) Sectors (only when the name explicitly references the sector)
  if (/\bbank|nbfc|financial services|psu bank/.test(value)) return SECTOR_ICONS.banking;
  if (/\bdefence\b|\bdefense\b|aerospace/.test(value)) return SECTOR_ICONS.defence;
  if (/pharma|healthcare|hospital|medic|drug/.test(value)) return SECTOR_ICONS.pharma;
  if (/infra(structure)?|construction|cement|capital goods/.test(value)) return SECTOR_ICONS.infrastructure;
  if (/\btech\b|\bit\b|software|digital india|ai fund|innovation/.test(value)) return SECTOR_ICONS.technology;
  if (/\benergy\b|\bpower\b|electric|renewable|solar/.test(value)) return SECTOR_ICONS.energy;
  if (/\bfmcg\b|consumer|retail/.test(value)) return SECTOR_ICONS.fmcg;
  if (/\bauto\b|automobile|vehicle|two[-\s]?wheeler/.test(value)) return SECTOR_ICONS.auto;
  if (/\boil\b|\bgas\b|crude|refiner/.test(value)) return SECTOR_ICONS.oilGas;

  // 6) Mutual-fund categories
  if (/\bindex\b|nifty 50|nifty50|sensex|bees\b|nifty next/.test(value)) return CATEGORY_ICONS.indexFund;
  if (/\betf\b/.test(value)) return CATEGORY_ICONS.etf;
  if (/large.?cap|bluechip|frontline/.test(value)) return CATEGORY_ICONS.largeCap;
  if (/mid.?cap/.test(value)) return CATEGORY_ICONS.midCap;
  if (/small.?cap|micro.?cap/.test(value)) return CATEGORY_ICONS.smallCap;
  if (/flexi.?cap/.test(value)) return CATEGORY_ICONS.flexiCap;
  if (/multi.?cap/.test(value)) return CATEGORY_ICONS.multiCap;
  if (/elss|tax saver|tax saving|equity linked savings/.test(value)) return CATEGORY_ICONS.elss;
  if (/hybrid|balanced|asset allocation|aggressive hybrid|conservative hybrid|equity savings/.test(value)) return CATEGORY_ICONS.hybrid;
  if (/liquid fund|overnight fund|money market|ultra short|low duration/.test(value)) return CATEGORY_ICONS.liquid;
  if (/\bdebt\b|corporate bond fund|credit risk|short duration|medium duration|long duration|gilt fund|banking and psu/.test(value)) return CATEGORY_ICONS.debt;
  if (/international|us equity|nasdaq|global|world|emerging market|china|japan/.test(value)) return CATEGORY_ICONS.international;
  if (/sector(al)? fund|thematic/.test(value)) return CATEGORY_ICONS.sectoral;

  // 7) Generic stock / mutual fund
  if (/\bstock\b|\bequity\b|\bshare\b|\bltd\b|ltd\.|limited/.test(value)) return CATEGORY_ICONS.stock;
  if (/mutual|\bfund\b|scheme/.test(value)) return CATEGORY_ICONS.mutualFund;

  // 8) Fallback
  return FALLBACK_ICON;
}
