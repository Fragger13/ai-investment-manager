#!/usr/bin/env node
/*
 * Safe importer for Indian mutual fund logos.
 *
 * Source registries:
 * - AMFI factsheet download centre:
 *   https://www.amfiindia.com/online-center/download-factsheets
 * - Value Research fund-house directory:
 *   https://www.valueresearchonline.com/funds/fund-house/
 * - Logopedia/Fandom category:
 *   https://logos.fandom.com/wiki/Category:Mutual_funds_in_India
 *
 * This script:
 * - Prefers AMFI's current 64×64 AMC logos when available.
 * - Uses Value Research as a current fund-house registry.
 * - Uses the Logopedia/Fandom MediaWiki API as fallback.
 * - Checks robots.txt for every origin it reads from.
 * - Adds polite delay between requests.
 * - Downloads local copies only; the app never hotlinks source URLs.
 * - Writes attribution metadata beside the app manifest.
 * - Skips images when the source blocks access, the format is unsupported,
 *   or an SVG contains active content.
 *
 * Logos remain trademarks of their respective owners and are used only for
 * identification inside the app.
 */

const fs = require("node:fs/promises") as typeof import("node:fs/promises");
const path = require("node:path") as typeof import("node:path");

type CategoryMember = {
  pageid: number;
  ns: number;
  title: string;
};

type ImageInfo = {
  url?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
};

type CandidateImage = {
  title: string;
  url: string;
  mime: string;
  metadata: Record<string, { value?: string }>;
  score: number;
  source: "amfi" | "fandom";
};

type ManifestEntry = {
  fundHouse: string;
  slug: string;
  file: string;
  sourceUrl: string;
  imageSourceUrl: string;
  license: string;
  retrievedAt: string;
};

const API_URL = "https://logos.fandom.com/api.php";
const CATEGORY_TITLE = "Category:Mutual_funds_in_India";
const CATEGORY_URL = "https://logos.fandom.com/wiki/Category%3AMutual_funds_in_India";
const AMFI_FACTSHEETS_URL = "https://www.amfiindia.com/online-center/download-factsheets";
const VALUE_RESEARCH_FUND_HOUSES_URL = "https://www.valueresearchonline.com/funds/fund-house/";
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "frontend/public/assets/icons/fundhouses");
const MANIFEST_FILE = path.join(ROOT, "frontend/src/lib/icons/fundhouse-logo-manifest.json");
const REQUEST_DELAY_MS = Number(process.env.LOGO_IMPORT_DELAY_MS ?? "1250");
const USER_AGENT = "AIInvestmentManagerLogoImporter/1.0 (+local development; respectful MediaWiki API use)";

const slugOverrides: Record<string, string> = {
  "SBI Mutual Fund": "sbi",
  "HDFC Mutual Fund": "hdfc",
  "ICICI Prudential Mutual Fund": "icici-prudential",
  "Axis Mutual Fund": "axis",
  "Kotak Mutual Fund": "kotak",
  "Kotak Mahindra Mutual Fund": "kotak",
  "Nippon India Mutual Fund": "nippon-india",
  "Mirae Asset Mutual Fund": "mirae-asset",
  "UTI Mutual Fund": "uti",
  "Tata Mutual Fund": "tata",
  "Aditya Birla Sun Life Mutual Fund": "aditya-birla-sun-life",
  "Motilal Oswal Mutual Fund": "motilal-oswal",
  "Canara Robeco Mutual Fund": "canara-robeco",
  "DSP Mutual Fund": "dsp",
  "Edelweiss Mutual Fund": "edelweiss",
  "Invesco Mutual Fund": "invesco",
  "LIC Mutual Fund": "lic",
  "PPFAS Mutual Fund": "ppfas",
  "PGIM India Mutual Fund": "pgim-india",
  "Quantum Mutual Fund": "quantum",
  "Sundaram Mutual Fund": "sundaram",
  "Bandhan Mutual Fund": "bandhan",
  "Baroda BNP Paribas Mutual Fund": "baroda-bnp-paribas",
  "Bank of India Mutual Fund": "bank-of-india",
  "Franklin Templeton Mutual Fund": "franklin-templeton",
  "Groww Mutual Fund": "groww",
  "HSBC Mutual Fund": "hsbc",
  "Mahindra Manulife Mutual Fund": "mahindra-manulife",
  "Navi Mutual Fund": "navi",
  "NJ Mutual Fund": "nj",
  "Samco Mutual Fund": "samco",
  "WhiteOak Capital Mutual Fund": "whiteoak-capital",
  "Zerodha Mutual Fund": "zerodha",
};

const robotsCache = new Map<string, string>();
let lastRequestAt = 0;

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run") || process.env.LOGO_IMPORT_DRY_RUN === "1";
  const limitArg = process.argv.find((arg: string) => arg.startsWith("--limit="));
  const limit = Number(limitArg?.split("=")[1] ?? process.env.LOGO_IMPORT_LIMIT ?? "0");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });

  const amfiCandidates = await fetchAmfiLogoCandidates();
  const valueResearchNames = await fetchValueResearchFundHouseNames();
  const fandomPages = await fetchCategoryMembersIfAllowed();
  const pages = mergeFundHouseRegistries(amfiCandidates, valueResearchNames, fandomPages);
  const selectedPages = limit > 0 ? pages.slice(0, limit) : pages;
  const manifest: ManifestEntry[] = [];

  console.log(`Found ${pages.length} fund-house registry entries. Processing ${selectedPages.length}.`);
  console.log(`AMFI logo candidates: ${amfiCandidates.size}. Value Research names: ${valueResearchNames.length}. Logopedia pages: ${fandomPages.length}.`);
  console.log("Logos are trademarks of their owners. Saved copies are for identification only.");

  for (const page of selectedPages) {
    const amfiCandidate = amfiCandidates.get(normalizeFundHouseName(page.title));
    const sourceUrl = amfiCandidate ? AMFI_FACTSHEETS_URL : pageUrl(page.title);
    try {
      const candidate = amfiCandidate ?? (page.hasFandomPage ? await findBestLogoCandidate(page.title) : null);
      if (!candidate) {
        console.warn(`SKIP ${page.title}: no SVG/PNG logo candidate found.`);
        continue;
      }

      if (!(await isAllowed(candidate.url))) {
        console.warn(`SKIP ${page.title}: robots.txt blocks image download.`);
        continue;
      }

      const extension = candidate.mime === "image/svg+xml" ? "svg" : "png";
      const slug = slugFor(page.title);
      const fileName = `${slug}.${extension}`;
      const outputPath = path.join(OUTPUT_DIR, fileName);
      const publicFile = `/assets/icons/fundhouses/${fileName}`;

      if (!dryRun) {
        const bytes = await downloadImage(candidate.url, candidate.mime);
        await fs.writeFile(outputPath, bytes);
      }

      manifest.push({
        fundHouse: page.title,
        slug,
        file: publicFile,
        sourceUrl,
        imageSourceUrl: candidate.url,
        license: licenseFor(candidate.metadata, candidate.source),
        retrievedAt: new Date().toISOString(),
      });

      console.log(`${dryRun ? "DRY" : "OK "} ${page.title} [${candidate.source}] -> ${publicFile}`);
    } catch (error) {
      console.warn(`SKIP ${page.title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!dryRun) {
    await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log(`${dryRun ? "Dry run complete" : "Import complete"}: ${manifest.length} logos.`);
  console.log(`Manifest: ${MANIFEST_FILE}`);
  console.log(`Source registries: ${AMFI_FACTSHEETS_URL}, ${VALUE_RESEARCH_FUND_HOUSES_URL}, ${CATEGORY_URL}`);
}

async function fetchCategoryMembersIfAllowed(): Promise<CategoryMember[]> {
  if (!(await isAllowed(API_URL))) {
    console.warn("Skipping Logopedia fallback: robots.txt does not allow access to the Fandom API.");
    return [];
  }
  return fetchCategoryMembers();
}

async function fetchCategoryMembers(): Promise<CategoryMember[]> {
  const members: CategoryMember[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: CATEGORY_TITLE,
      cmnamespace: "0",
      cmlimit: "50",
      format: "json",
      origin: "*",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const json = await fetchJson(`${API_URL}?${params.toString()}`);
    members.push(...(json.query?.categorymembers ?? []));
    cmcontinue = json.continue?.cmcontinue;
  } while (cmcontinue);

  return members.sort((a, b) => a.title.localeCompare(b.title));
}

async function findBestLogoCandidate(pageTitle: string): Promise<CandidateImage | null> {
  const imageNames = new Set<string>();

  const pageImage = await fetchPageImage(pageTitle);
  if (pageImage) imageNames.add(pageImage);

  const pageImages = await fetchImagesOnPage(pageTitle);
  for (const image of pageImages) imageNames.add(image);

  const candidates: CandidateImage[] = [];
  for (const imageName of imageNames) {
    const info = await fetchImageInfo(imageName);
    if (!info?.url || !info.mime) continue;
    if (info.mime !== "image/svg+xml" && info.mime !== "image/png") continue;
    candidates.push({
      title: imageName,
      url: info.url,
      mime: info.mime,
      metadata: info.extmetadata ?? {},
      score: scoreImage(pageTitle, imageName, info.mime),
      source: "fandom",
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

async function fetchAmfiLogoCandidates(): Promise<Map<string, CandidateImage>> {
  const candidates = new Map<string, CandidateImage>();

  if (!(await isAllowed(AMFI_FACTSHEETS_URL))) {
    console.warn("Skipping AMFI source: robots.txt blocks factsheet page access.");
    return candidates;
  }

  try {
    const html = await fetchText(AMFI_FACTSHEETS_URL);
    const imageTagPattern = /<img\b[^>]*\balt="([^"]*Mutual Fund[^"]*)"[^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = imageTagPattern.exec(html))) {
      const fundHouse = decodeHtml(match[1]).trim();
      const tag = match[0];
      const rawUrl = extractImageUrlFromTag(tag);
      if (!rawUrl) continue;

      const imageUrl = absolutizeUrl(rawUrl, AMFI_FACTSHEETS_URL);
      const mime = mimeFromUrl(imageUrl);
      if (!mime) continue;

      candidates.set(normalizeFundHouseName(fundHouse), {
        title: fundHouse,
        url: imageUrl,
        mime,
        metadata: {},
        score: mime === "image/svg+xml" ? 100 : 90,
        source: "amfi",
      });
    }
  } catch (error) {
    console.warn(`Skipping AMFI source: ${error instanceof Error ? error.message : String(error)}`);
  }

  return candidates;
}

async function fetchValueResearchFundHouseNames(): Promise<string[]> {
  if (!(await isAllowed(VALUE_RESEARCH_FUND_HOUSES_URL))) {
    console.warn("Skipping Value Research registry: robots.txt blocks fund-house page access.");
    return [];
  }

  try {
    const html = await fetchText(VALUE_RESEARCH_FUND_HOUSES_URL);
    const names = new Set<string>();
    const linkPattern = /<a\b[^>]*>([^<]*(?:AUM|Mutual Fund)[^<]*)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(html))) {
      const text = decodeHtml(match[1]).replace(/\s+/g, " ").trim();
      const name = text.replace(/\s*AUM\s*:.*$/i, "").trim();
      if (!name || name.length < 2) continue;
      names.add(name.endsWith("Mutual Fund") ? name : `${name} Mutual Fund`);
    }

    return [...names].sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.warn(`Skipping Value Research registry: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function mergeFundHouseRegistries(
  amfiCandidates: Map<string, CandidateImage>,
  valueResearchNames: string[],
  fandomPages: CategoryMember[],
): { title: string; hasFandomPage: boolean }[] {
  const merged = new Map<string, { title: string; hasFandomPage: boolean }>();

  for (const page of fandomPages) {
    merged.set(normalizeFundHouseName(page.title), { title: page.title, hasFandomPage: true });
  }

  for (const name of valueResearchNames) {
    const key = normalizeFundHouseName(name);
    const current = merged.get(key);
    merged.set(key, { title: current?.title ?? name, hasFandomPage: current?.hasFandomPage ?? false });
  }

  for (const candidate of amfiCandidates.values()) {
    const key = normalizeFundHouseName(candidate.title);
    const current = merged.get(key);
    merged.set(key, { title: canonicalFundHouseName(candidate.title), hasFandomPage: current?.hasFandomPage ?? false });
  }

  return [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
}

async function fetchText(url: string): Promise<string> {
  await politeDelay();
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function fetchPageImage(pageTitle: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: pageTitle,
    prop: "pageimages",
    piprop: "name|original",
    format: "json",
    origin: "*",
  });

  const json = await fetchJson(`${API_URL}?${params.toString()}`);
  const page = firstPage(json);
  return page?.pageimage ? String(page.pageimage) : null;
}

async function fetchImagesOnPage(pageTitle: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    titles: pageTitle,
    prop: "images",
    imlimit: "50",
    format: "json",
    origin: "*",
  });

  const json = await fetchJson(`${API_URL}?${params.toString()}`);
  const page = firstPage(json);
  return (page?.images ?? []).map((image: { title: string }) => image.title.replace(/^File:/, ""));
}

async function fetchImageInfo(imageName: string): Promise<ImageInfo | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: `File:${imageName.replace(/^File:/, "")}`,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    format: "json",
    origin: "*",
  });

  const json = await fetchJson(`${API_URL}?${params.toString()}`);
  const page = firstPage(json);
  return page?.imageinfo?.[0] ?? null;
}

async function fetchJson(url: string): Promise<any> {
  await politeDelay();
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function downloadImage(url: string, mime: string): Promise<Buffer> {
  await politeDelay();
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: mime } });
  if (!response.ok) throw new Error(`image HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  if (mime === "image/svg+xml") {
    const svg = buffer.toString("utf8");
    assertSafeSvg(svg);
    return Buffer.from(svg, "utf8");
  }

  return buffer;
}

async function isAllowed(rawUrl: string): Promise<boolean> {
  const url = new URL(rawUrl);
  const robotsUrl = `${url.origin}/robots.txt`;

  let robots = robotsCache.get(url.origin);
  if (robots === undefined) {
    try {
      await politeDelay();
      const response = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT } });
      robots = response.ok ? await response.text() : "";
      robotsCache.set(url.origin, robots);
    } catch {
      robots = "";
      robotsCache.set(url.origin, robots);
    }
  }

  if (!robots.trim()) return true;
  return allowsPath(robots, url.pathname);
}

function allowsPath(robots: string, pathname: string): boolean {
  const lines = robots.split(/\r?\n/);
  let applies = false;
  let best: { type: "allow" | "disallow"; path: string } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      applies = value === "*" || USER_AGENT.toLowerCase().includes(value.toLowerCase());
      continue;
    }

    if (!applies || (key !== "allow" && key !== "disallow")) continue;
    if (!value) continue;
    if (!pathname.startsWith(value)) continue;

    if (!best || value.length > best.path.length) {
      best = { type: key as "allow" | "disallow", path: value };
    }
  }

  return best?.type !== "disallow";
}

function assertSafeSvg(svg: string) {
  const unsafe = /<\s*script\b|<\s*foreignObject\b|\son[a-z]+\s*=|javascript:/i;
  if (unsafe.test(svg)) {
    throw new Error("SVG contains active content and was not saved");
  }
}

function scoreImage(pageTitle: string, imageName: string, mime: string): number {
  const title = pageTitle.toLowerCase().replace(/mutual fund/g, "").trim();
  const name = imageName.toLowerCase();
  let score = mime === "image/svg+xml" ? 20 : 10;
  if (name.includes("logo")) score += 40;
  if (name.includes(title.split(/\s+/)[0])) score += 25;
  if (name.includes("wordmark")) score += 8;
  if (name.includes("icon")) score -= 5;
  if (name.includes("old") || name.includes("former")) score -= 20;
  return score;
}

function slugFor(title: string): string {
  const canonical = canonicalFundHouseName(title);
  return slugOverrides[canonical] ?? slugOverrides[title] ?? canonical
    .replace(/&/g, "and")
    .replace(/\bmutual funds?\b/gi, "")
    .replace(/\bindia\b/gi, "india")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalFundHouseName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  if (/^BOI AXA Mutual Fund$/i.test(normalized)) return "Bank of India Mutual Fund";
  if (/^Baroda Mutual Fund$/i.test(normalized)) return "Baroda BNP Paribas Mutual Fund";
  if (/^Reliance Mutual Fund$/i.test(normalized)) return "Nippon India Mutual Fund";
  if (/^Principal Mutual Funds$/i.test(normalized)) return "Principal Mutual Fund";
  return normalized;
}

function normalizeFundHouseName(name: string): string {
  return canonicalFundHouseName(name)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bmahindra mutual fund\b/g, "mahindra mutual fund")
    .replace(/\bmutual funds\b/g, "mutual fund")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pageUrl(title: string): string {
  return `https://logos.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function licenseFor(metadata: Record<string, { value?: string }>, source: CandidateImage["source"]): string {
  if (source === "amfi") {
    return "trademark/logo; source: AMFI factsheet page; check source terms";
  }
  return (
    metadata.LicenseShortName?.value ||
    metadata.UsageTerms?.value ||
    metadata.License?.value ||
    "unknown/check source"
  ).replace(/<[^>]+>/g, "");
}

function extractImageUrlFromTag(tag: string): string | null {
  const src = attr(tag, "src");
  if (src) {
    const decoded = decodeNextImageUrl(decodeHtml(src));
    if (decoded) return decoded;
  }

  const srcSet = attr(tag, "srcSet") ?? attr(tag, "srcset");
  if (srcSet) {
    for (const part of decodeHtml(srcSet).split(",")) {
      const candidate = part.trim().split(/\s+/)[0];
      const decoded = decodeNextImageUrl(candidate);
      if (decoded) return decoded;
      if (candidate) return candidate;
    }
  }

  return null;
}

function attr(tag: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}="([^"]+)"`, "i");
  return pattern.exec(tag)?.[1] ?? null;
}

function decodeNextImageUrl(value: string): string | null {
  if (!value.includes("/_next/image")) return value;
  try {
    const url = new URL(value, AMFI_FACTSHEETS_URL);
    return url.searchParams.get("url");
  } catch {
    return null;
  }
}

function absolutizeUrl(value: string, base: string): string {
  return new URL(value, base).toString();
}

function mimeFromUrl(rawUrl: string): string | null {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function firstPage(json: any): any {
  const pages = json.query?.pages;
  if (!pages) return null;
  return Object.values(pages)[0] ?? null;
}

async function politeDelay() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
