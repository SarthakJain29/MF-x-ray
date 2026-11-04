/**
 * Fund overlap: which funds own the same stocks, and your "look-through" exposure to each stock.
 * Data comes from src/data/holdings.json (approximate top-holdings snapshot, see developer.md).
 */
import holdingsData from "@/data/holdings.json";
import { schemeKey } from "./finance/categorize";
import type { Holding } from "./finance/portfolio";

export type Weight = { name: string; weight: number };

export interface FundHoldings {
  label: string;
  source: "fund-snapshot" | "index";
  asOf: string;
  holdings: Weight[];
}

type RawData = { asOf: string; indices: Record<string, [string, number][]>; funds: Record<string, [string, number][]> };
const DATA = holdingsData as unknown as RawData;

const toWeights = (rows: [string, number][]): Weight[] => rows.map(([name, weight]) => ({ name, weight }));

export function indexTracked(name: string): string | null {
  const n = name.toLowerCase();
  if (!/index|etf|bees/.test(n)) return null;
  if (/next\s*50|junior/.test(n)) return "NIFTY NEXT 50";
  if (/sensex/.test(n)) return "SENSEX";
  if (/nifty\s*50\b|nifty\s*fifty|niftybees/.test(n) && !/(midcap|smallcap|equal|value|momentum|quality|low vol|alpha)/.test(n)) return "NIFTY 50";
  return null;
}

export function holdingsFor(fundName: string, data: RawData = DATA): FundHoldings | null {
  const idx = indexTracked(fundName);
  if (idx && data.indices[idx]) return { label: idx, source: "index", asOf: data.asOf, holdings: toWeights(data.indices[idx]) };
  const key = schemeKey(fundName);
  const rows = data.funds[key] ?? Object.entries(data.funds).find(([k]) => key.startsWith(k + " ") || key === k)?.[1];
  if (!rows) return null;
  return { label: key, source: "fund-snapshot", asOf: data.asOf, holdings: toWeights(rows) };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface PairOverlap {
  a: string;
  b: string;
  /** Sum of min(weightA, weightB) over common stocks, in % (0-100). */
  overlap: number;
  common: { name: string; a: number; b: number }[];
}

export function pairOverlap(a: Weight[], b: Weight[]): Omit<PairOverlap, "a" | "b"> {
  const mb = new Map(b.map((w) => [norm(w.name), w]));
  const common: PairOverlap["common"] = [];
  let overlap = 0;
  for (const wa of a) {
    const wb = mb.get(norm(wa.name));
    if (!wb) continue;
    overlap += Math.min(wa.weight, wb.weight);
    common.push({ name: wa.name, a: wa.weight, b: wb.weight });
  }
  common.sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b));
  return { overlap: Math.round(overlap * 10) / 10, common };
}

export interface OverlapReport {
  covered: { holding: Holding; data: FundHoldings }[];
  missing: Holding[];
  pairs: PairOverlap[];
  /** Your rupee exposure to each stock across funds (based on disclosed top holdings only). */
  exposure: { name: string; value: number; shareOfEquity: number; funds: { id: string; name: string; value: number }[] }[];
  /** Funds without holdings data that share a category — likely similar portfolios. */
  sameCategory: { category: string; funds: Holding[] }[];
  equityValue: number;
}

export function overlapReport(holdings: Holding[]): OverlapReport {
  const equity = holdings.filter((h) => h.assetClass === "Equity" || h.assetClass === "International" || (h.assetClass === "Hybrid" && !/arbitrage/i.test(h.category)));
  const covered: OverlapReport["covered"] = [];
  const missing: Holding[] = [];
  for (const h of equity) {
    const d = holdingsFor(h.name);
    if (d) covered.push({ holding: h, data: d });
    else missing.push(h);
  }
  const pairs: PairOverlap[] = [];
  for (let i = 0; i < covered.length; i++)
    for (let j = i + 1; j < covered.length; j++) {
      const p = pairOverlap(covered[i].data.holdings, covered[j].data.holdings);
      pairs.push({ a: covered[i].holding.id, b: covered[j].holding.id, ...p });
    }
  pairs.sort((x, y) => y.overlap - x.overlap);

  const equityValue = equity.reduce((s, h) => s + h.value, 0);
  const ex = new Map<string, OverlapReport["exposure"][number]>();
  for (const { holding, data } of covered) {
    for (const w of data.holdings) {
      const k = norm(w.name);
      const v = (holding.value * w.weight) / 100;
      const e = ex.get(k) ?? { name: w.name, value: 0, shareOfEquity: 0, funds: [] };
      e.value += v;
      e.funds.push({ id: holding.id, name: holding.shortName, value: v });
      ex.set(k, e);
    }
  }
  const exposure = [...ex.values()]
    .map((e) => ({ ...e, value: Math.round(e.value), shareOfEquity: equityValue ? e.value / equityValue : 0 }))
    .sort((a, b) => b.value - a.value);

  const byCat = new Map<string, Holding[]>();
  for (const h of equity) byCat.set(h.category, [...(byCat.get(h.category) ?? []), h]);
  const sameCategory = [...byCat.entries()]
    .filter(([, fs]) => fs.length > 1)
    .map(([category, funds]) => ({ category, funds }));

  return { covered, missing, pairs, exposure, sameCategory, equityValue };
}
