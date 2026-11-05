/**
 * Fetch AMC monthly portfolio disclosures and build public/data/holdings.json.
 *
 *   npx tsx scripts/holdings/ingest.ts             # discover + download latest month per AMC
 *   npx tsx scripts/holdings/ingest.ts --offline   # rebuild from the local download cache only
 *   npx tsx scripts/holdings/ingest.ts --only sbi,ppfas
 *
 * Needs Playwright + Chromium for discovery (pages are client-rendered). Downloads are cached in
 * scripts/.holdings-cache/ (git-ignored). Only public files are fetched; nothing personal is involved.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { unzipSync } from "fflate";
import { parseWorkbook, type ParsedScheme } from "./parse-disclosure";
import { buildSnapshot, type AmcBatch, type MasterScheme } from "./build-snapshot";
import { NOT_YET_COVERED, SOURCES, type Link, type Month } from "./sources";

const ROOT = path.resolve(__dirname, "../..");
const CACHE = path.join(ROOT, "scripts", ".holdings-cache");
const OUT = path.join(ROOT, "public", "data", "holdings.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 MF-X-ray-data-bot";

const args = process.argv.slice(2);
const OFFLINE = args.includes("--offline");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

function monthsToTry(now = new Date()): Month[] {
  const out: Month[] = [];
  for (let back = 1; back <= 3; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}
const ym = (m: Month) => `${m.year}-${String(m.month).padStart(2, "0")}`;

interface PwPage {
  goto(url: string, o: object): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  close(): Promise<void>;
}
interface PlaywrightChromium {
  launch(o: object): Promise<{ newContext(o: object): Promise<{ newPage(): Promise<PwPage> }>; close(): Promise<void> }>;
}

async function discover(pages: string[]): Promise<Link[]> {
  const req = createRequire(__filename);
  // Playwright is a CI/dev-machine tool, not an app dependency (see .github/workflows/holdings.yml).
  const { chromium } = req("playwright") as { chromium: PlaywrightChromium };
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ userAgent: UA });
  const links: Link[] = [];
  try {
    for (const url of pages) {
      const page = await ctx.newPage();
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForTimeout(6000);
        links.push(...(await page.evaluate(() => [...document.querySelectorAll("a")].map((a) => ({ href: a.href, text: (a.textContent || "").trim().slice(0, 200) })))));
      } catch (e) {
        console.warn(`  ! could not open ${url}: ${(e as Error).message.slice(0, 120)}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  {
    // Some pages render partially headless but ship links in the static HTML; merge both.
    for (const url of pages) {
      try {
        const html = await (await fetch(url, { headers: { "user-agent": UA } })).text();
        for (const m of html.matchAll(/href=["']([^"']+)["'][^>]*>([^<]{0,200})/gi)) links.push({ href: new URL(m[1], url).href, text: m[2].trim() });
        // ...and URLs embedded in inline JSON / scripts
        for (const m of html.matchAll(/https?:\\?\/\\?\/[^"'\s<>]+?\.(?:xlsx?|zip)(?:\?[^"'\s<>]*)?/gi)) links.push({ href: m[0].replace(/\\\//g, "/"), text: "" });
      } catch {
        /* ignore */
      }
    }
  }
  return links;
}

async function download(url: string): Promise<Buffer | null> {
  const ext = (url.match(/\.(xlsx?|zip)(\?|$)/i)?.[1] ?? "bin").toLowerCase();
  const file = path.join(CACHE, createHash("sha1").update(url).digest("hex").slice(0, 16) + "." + ext);
  const isSpreadsheet = (b: Buffer) => (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
  if (existsSync(file)) {
    const cached = await readFile(file);
    if (isSpreadsheet(cached)) return cached;
  }
  if (OFFLINE) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isSpreadsheet(buf)) return null; // soft-404 HTML page
      await writeFile(file, buf);
      return buf;
    } catch (e) {
      if (attempt === 2) console.warn(`  ! download failed ${url}: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

function workbooksIn(buf: Buffer, url: string): Buffer[] {
  if (!/\.zip(\?|$)/i.test(url)) return [buf];
  const entries = unzipSync(new Uint8Array(buf));
  return Object.entries(entries)
    .filter(([name]) => /\.xlsx?$/i.test(name) && !/debt|fortnight/i.test(name) && !name.startsWith("__MACOSX"))
    .map(([, data]) => Buffer.from(data));
}

async function loadMaster(): Promise<MasterScheme[]> {
  const f = JSON.parse(await readFile(path.join(ROOT, "public", "data", "schemes.json"), "utf8")) as {
    amcs: string[];
    schemes: [number, string, string, string, number, number, number, string][];
  };
  return f.schemes.map(([, isin, isinR, name, , ai]) => ({ isin, isinReinvest: isinR, name, amc: f.amcs[ai] }));
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  const manifestPath = path.join(CACHE, "manifest.json");
  const manifest: Record<string, { month: string; files: string[] }> = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, "utf8")) : {};
  const batches: AmcBatch[] = [];

  for (const src of SOURCES) {
    if (ONLY && !ONLY.includes(src.id)) {
      if (!manifest[src.id]) continue;
    }
    console.log(`• ${src.amfiAmc}`);
    let month: string | null = null;
    let files: string[] = [];
    if (!OFFLINE && (!ONLY || ONLY.includes(src.id))) {
      const links = await discover(src.pages);
      for (const m of monthsToTry()) {
        const probed: string[] = [];
        for (const u of src.probe?.(m) ?? []) if (await download(u)) probed.push(u);
        const picked = [...new Set([...src.pick(links, m), ...probed])];
        if (picked.length) {
          month = ym(m);
          files = picked;
          break;
        }
      }
      if (!month) console.warn(`  ! no file found for recent months (${links.length} links scanned)`);
    }
    if (!month && manifest[src.id]) ({ month, files } = manifest[src.id]);
    if (!month) continue;

    const schemes: ParsedScheme[] = [];
    for (const url of files) {
      const buf = await download(url);
      if (!buf) continue;
      for (const wb of workbooksIn(buf, url)) {
        try {
          schemes.push(...parseWorkbook(wb));
        } catch (e) {
          console.warn(`  ! parse failed ${url}: ${(e as Error).message}`);
        }
      }
    }
    if (!schemes.length) continue;
    manifest[src.id] = { month, files };
    batches.push({ amc: src.amfiAmc, month, files, schemes });
    console.log(`  ${month}: ${files.length} file(s), ${schemes.length} sheets parsed`);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const snapshot = buildSnapshot(batches, await loadMaster(), NOT_YET_COVERED);
  if (snapshot.schemes.length < 50) {
    console.error(`Only ${snapshot.schemes.length} schemes — refusing to overwrite the snapshot.`);
    process.exit(1);
  }
  await writeFile(OUT, JSON.stringify(snapshot));
  const mapped = snapshot.schemes.filter((s) => s.i.length).length;
  console.log(`\nWrote ${path.relative(ROOT, OUT)}: ${snapshot.schemes.length} schemes (${mapped} mapped to AMFI plan ISINs), ${snapshot.stocks.length} stocks, month ${snapshot.month}`);
  for (const s of snapshot.sources) console.log(`  ${s.amc.padEnd(36)} ${s.month}  ${s.schemes} schemes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
