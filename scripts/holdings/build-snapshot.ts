/** Pure: parsed disclosures + AMFI scheme master → compact holdings snapshot. Unit-tested. */
import type { ParsedScheme } from "./parse-disclosure";
import type { HoldingsSnapshotFile } from "../../src/lib/holdings/snapshot";
import { compactKey, displayStockName, planNameKey } from "../../src/lib/holdings/keys";

export interface AmcBatch {
  amc: string; // AMFI AMC name
  month: string; // YYYY-MM
  files: string[];
  schemes: ParsedScheme[];
}

export interface MasterScheme {
  isin: string;
  isinReinvest: string;
  name: string;
  amc: string;
}

/** Equity-oriented schemes worth keeping for overlap (hedged arbitrage books & pure FoFs are excluded). */
export function keepScheme(s: ParsedScheme): boolean {
  if (s.equityPct < 35) return false;
  if (/arbitrage/i.test(s.name)) return false;
  if (!/\b(fund|etf|fof|bees|plan)\b/i.test(s.name)) return false; // unnamed sheets
  const directEquity = s.holdings.filter((h) => h.kind === "equity" || h.kind === "foreign-equity").length;
  return directEquity >= 5;
}

const mostCommon = (xs: string[]) => {
  const c = new Map<string, number>();
  for (const x of xs) if (x) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};

function normSector(s: string): string {
  const t = s.replace(/\s+/g, " ").replace(/[*^#]+$/, "").trim();
  if (!t || /^(n\.?a\.?|-|unrated|equity)$/i.test(t)) return "";
  return t === t.toUpperCase() ? t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bIt\b/g, "IT").replace(/\bAnd\b/g, "&") : t;
}

export function buildSnapshot(batches: AmcBatch[], master: MasterScheme[], notCovered: HoldingsSnapshotFile["notCovered"], generatedAt = new Date().toISOString().slice(0, 10)): HoldingsSnapshotFile {
  const names = new Map<string, string[]>();
  const sectorsOf = new Map<string, string[]>();
  const kept: { b: number; s: ParsedScheme }[] = [];
  batches.forEach((batch, b) => {
    for (const s of batch.schemes) {
      if (!keepScheme(s)) continue;
      kept.push({ b, s });
      for (const h of s.holdings) {
        if (h.kind !== "equity" && h.kind !== "foreign-equity") continue;
        names.set(h.isin, [...(names.get(h.isin) ?? []), h.name]);
        sectorsOf.set(h.isin, [...(sectorsOf.get(h.isin) ?? []), normSector(h.industry)]);
      }
    }
  });

  const sectors: string[] = [];
  const secIdx = (s: string) => {
    const v = s || "Other";
    let i = sectors.indexOf(v);
    if (i < 0) i = sectors.push(v) - 1;
    return i;
  };
  const stockIdx = new Map<string, number>();
  const stocks: [string, string, number][] = [];
  for (const [isin, ns] of [...names.entries()].sort((a, b) => b[1].length - a[1].length)) {
    stockIdx.set(isin, stocks.length);
    stocks.push([isin, displayStockName(mostCommon(ns)), secIdx(mostCommon(sectorsOf.get(isin) ?? []))]);
  }

  // AMFI master, grouped by AMC + key, for plan ISINs.
  const masterByKey = new Map<string, MasterScheme[]>();
  for (const m of master) {
    const k = `${m.amc}|${planNameKey(m.name)}`;
    masterByKey.set(k, [...(masterByKey.get(k) ?? []), m]);
  }

  const seen = new Set<string>();
  const schemes: HoldingsSnapshotFile["schemes"] = [];
  for (const { b, s } of kept) {
    const batch = batches[b];
    const k = compactKey(s.name);
    const dedupe = `${batch.amc}|${k}`;
    if (seen.has(dedupe)) continue; // same scheme in two files (e.g. main + supplementary sheet)
    seen.add(dedupe);
    const plans = masterByKey.get(dedupe) ?? [];
    const h: number[] = [];
    for (const x of s.holdings) {
      if (x.kind !== "equity" && x.kind !== "foreign-equity") continue;
      const bp = Math.round(x.weight * 100);
      if (bp <= 0) continue;
      h.push(stockIdx.get(x.isin)!, bp);
    }
    schemes.push({
      n: s.name.replace(/\s+/g, " "),
      a: b,
      m: batch.month,
      k,
      i: [...new Set(plans.flatMap((p) => [p.isin, p.isinReinvest]).filter(Boolean))],
      e: Math.round(s.equityPct * 10) / 10,
      h,
    });
  }

  const month = mostCommon(schemes.map((s) => s.m));
  return {
    version: 1,
    generatedAt,
    month,
    sources: batches.map((x) => ({ amc: x.amc, month: x.month, schemes: schemes.filter((s) => batches[s.a] === x).length, files: x.files })),
    notCovered,
    sectors,
    stocks,
    schemes,
  };
}
