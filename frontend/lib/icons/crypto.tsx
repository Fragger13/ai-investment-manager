import { SiBitcoin, SiCardano, SiEthereum, SiLitecoin, SiPolkadot, SiSolana, SiTether } from "react-icons/si";
import type { AssetIcon } from "./types";

/**
 * Crypto icons via Simple Icons (`react-icons/si`).
 * These are community-distributed brand marks bundled in the icon library.
 */

export const CRYPTO_ICONS: Record<string, AssetIcon> = {
  bitcoin: {
    bg: "bg-[#F7931A]",
    label: "Bitcoin",
    Element: SiBitcoin,
  },
  ethereum: {
    bg: "bg-[#3C3C3D]",
    label: "Ethereum",
    Element: SiEthereum,
  },
  tether: {
    bg: "bg-[#26A17B]",
    label: "Tether",
    Element: SiTether,
  },
  solana: {
    bg: "bg-[#9945FF]",
    label: "Solana",
    Element: SiSolana,
  },
  cardano: {
    bg: "bg-[#0033AD]",
    label: "Cardano",
    Element: SiCardano,
  },
  polkadot: {
    bg: "bg-[#E6007A]",
    label: "Polkadot",
    Element: SiPolkadot,
  },
  litecoin: {
    bg: "bg-[#345D9D]",
    label: "Litecoin",
    Element: SiLitecoin,
  },
  generic: {
    bg: "bg-violet-600",
    label: "Crypto",
    svg: (
      <>
        <circle cx="32" cy="32" r="18" fill="none" stroke="#FFFFFF" strokeWidth="3" />
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight="800"
          fontSize="22"
          fill="#FFFFFF"
        >
          ¢
        </text>
      </>
    ),
  },
};

export function cryptoIconFor(text: string): AssetIcon | null {
  const value = text.toLowerCase();
  if (/\bbitcoin\b|\bbtc\b/.test(value)) return CRYPTO_ICONS.bitcoin;
  if (/\bethereum\b|\beth\b/.test(value)) return CRYPTO_ICONS.ethereum;
  if (/\btether\b|\busdt\b/.test(value)) return CRYPTO_ICONS.tether;
  if (/\bsolana\b|\bsol\b/.test(value)) return CRYPTO_ICONS.solana;
  if (/\bcardano\b|\bada\b/.test(value)) return CRYPTO_ICONS.cardano;
  if (/\bpolkadot\b|\bdot\b/.test(value)) return CRYPTO_ICONS.polkadot;
  if (/\blitecoin\b|\bltc\b/.test(value)) return CRYPTO_ICONS.litecoin;
  if (value.includes("crypto")) return CRYPTO_ICONS.generic;
  return null;
}
