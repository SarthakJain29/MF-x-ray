/**
 * Fund overlap: which funds own the same stocks, your look-through exposure per stock and per sector, and
 * plain-language verdicts. Primary data: AMC monthly portfolio disclosures (public/data/holdings.json, stock
 * identity = ISIN). Fallbacks, always labelled: a sibling index fund's disclosed portfolio for index funds
 * ("index proxy"), then a hand-compiled approximate snapshot (src/data/holdings-fallback.json).
 */
import fallbackData from "@/data/holdings-fallback.json";
import { schemeKey } from "./finance/categorize";
import type { Holding } from "./finance/portfolio";
import type { HoldingsIndex, StockWeight } from "./holdings/snapshot";
import { displayStockName } from "./holdings/keys";

export type DataSource = "disclosure" | "index-proxy" | "approximate";

export interface FundHoldings {
  source: DataSource;
  /** Display label: the disclosed scheme name, or the index tracked */
  label: string;
  /** "YYYY-MM" for disclosures; free text for the approximate snapshot */
  asOf: string;
  /** % of the fund in equity (for disclosures); null when unknown */
  equityPct: number | null;
  /** Equity holdings. `id` is the ISIN when known, else a normalised name key. */
  holdings: (StockWeight & { id: string })[];
  /** Only the top holdings are known (approximate snapshot) */
  partial: boolean;
}

type RawFallback = { asOf: string; indices: Record<string, [string, number][]>; funds: Record<string, [string, number][]> };
const FALLBACK = fallbackData as unknown as RawFallback;

const normName = (s: string) =>
  displayStockName(s)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Which broad index an index fund / ETF tracks (used to borrow a sibling's disclosed portfolio). */
export function indexTracked(name: string): string | null {
  const n = name.toLowerCase();
  if (!/index|etf|bees/.test(n)) return null;
  if (/(equal|value|momentum|quality|low vol|alpha|shariah|dividend|esg|top 10|top 20)/.test(n)) return null;
  if (/next\s*50|junior/.test(n)) return "NIFTY NEXT 50";
  if (/sensex next/.test(n)) return null;
  if (/sensex/.test(n)) return "SENSEX";
  if (/midcap\s*150/.test(n)) return "NIFTY MIDCAP 150";
  if (/smallcap\s*250/.test(n)) return "NIFTY SMALLCAP 250";
  if (/nifty\s*500\b/.test(n) && !/multicap|flexicap/.test(n)) return "NIFTY 500";
  if (/nifty\s*bank\b|bank\s*bees/.test(n) && !/psu|private/.test(n)) return "NIFTY BANK";
  if (/nifty\s*100\b/.test(n)) return "NIFTY 100";
  if (/nifty\s*50\b|nifty\s*fifty|niftybees|nifty bees/.test(n) && !/(midcap|smallcap|bank)/.test(n)) return "NIFTY 50";
  return null;
}

function fromFallback(fundName: string, stockByName: Map<string, StockWeight>): FundHoldings | null {
  const idx = indexTracked(fundName);
  const rows = (idx && FALLBACK.indices[idx]) || FALLBACK.funds[schemeKey(fundName)];
  if (!rows) return null;
  return {
    source: "approximate",
    label: idx ?? fundName,
    asOf: FALLBACK.asOf,
    equityPct: null,
    partial: true,
    holdings: rows.map(([name, weight]) => {
      const known = stockByName.get(normName(name));
      return known ? { ...known, id: known.isin, name: known.name, weight } : { isin: "", name, sector: "Other", weight, id: `name:${normName(name)}` };
    }),
  };
}

/** Resolve the best available holdings for one of the user's funds. */
export function holdingsFor(h: Pick<Holding, "isin" | "name">, index: HoldingsIndex | null): FundHoldings | null {
  if (index) {
    const d = index.lookup(h.isin, h.name);
    if (d) return { source: "disclosure", label: d.scheme, asOf: d.month, equityPct: d.equityPct, partial: false, holdings: d.holdings.map((x) => ({ ...x, id: x.isin })) };
    const tracked = indexTracked(h.name);
    if (tracked) {
      const proxy = findIndexProxy(index, tracked);
      if (proxy) return { source: "index-proxy", label: tracked, asOf: proxy.month, equityPct: proxy.equityPct, partial: false, holdings: proxy.holdings.map((x) => ({ ...x, id: x.isin })) };
    }
  }
  return fromFallback(h.name, index ? stockNameMap(index) : new Map());
}

const proxyCache = new WeakMap<HoldingsIndex, Map<string, ReturnType<HoldingsIndex["lookup"]>>>();
function findIndexProxy(index: HoldingsIndex, tracked: string) {
  let cache = proxyCache.get(index);
  if (!cache) proxyCache.set(index, (cache = new Map()));
  if (cache.has(tracked)) return cache.get(tracked) ?? null;
  // Prefer an index fund (not an ETF) with the same tracked index and the most holdings disclosed.
  const candidates = index.file.schemes
    .filter((s) => indexTracked(s.n) === tracked)
    .sort((a, b) => Number(/etf|bees/i.test(a.n)) - Number(/etf|bees/i.test(b.n)) || b.h.length - a.h.length);
  const hit = candidates[0] ? index.lookup(candidates[0].i[0] ?? null, candidates[0].n) : null;
  cache.set(tracked, hit);
  return hit;
}

const nameMapCache = new WeakMap<HoldingsIndex, Map<string, StockWeight>>();
function stockNameMap(index: HoldingsIndex): Map<string, StockWeight> {
  let m = nameMapCache.get(index);
  if (!m) {
    m = new Map();
    for (const [isin, name, sec] of index.file.stocks) {
      const k = normName(name);
      if (!m.has(k)) m.set(k, { isin, name, sector: index.file.sectors[sec] ?? "Other", weight: 0 });
    }
    nameMapCache.set(index, m);
  }
  return m;
}

export interface PairOverlap {
  a: string;
  b: string;
  /** Sum of min(weightA, weightB) over common stocks, as % of each fund's assets (0-100). */
  overlap: number;
  common: { id: string; name: string; a: number; b: number }[];
  verdict: string;
  level: "high" | "medium" | "low" | "minimal";
}

export function verdictFor(overlap: number): { level: PairOverlap["level"]; verdict: string } {
  const pct = Math.round(overlap);
  if (overlap >= 60) return { level: "high", verdict: `${pct}% the same — these two are nearly the same portfolio` };
  if (overlap >= 35) return { level: "medium", verdict: `${pct}% the same — a large shared core` };
  if (overlap >= 15) return { level: "low", verdict: `${pct}% the same — some shared stocks, mostly different` };
  return { level: "minimal", verdict: `${pct}% the same — very different portfolios` };
}

export function pairOverlap(a: { id?: string; name: string; weight: number }[], b: { id?: string; name: string; weight: number }[]) {
  const key = (x: { id?: string; name: string }) => x.id ?? `name:${normName(x.name)}`;
  const mb = new Map(b.map((w) => [key(w), w]));
  const common: PairOverlap["common"] = [];
  let overlap = 0;
  for (const wa of a) {
    const wb = mb.get(key(wa));
    if (!wb) continue;
    overlap += Math.min(wa.weight, wb.weight);
    common.push({ id: key(wa), name: wa.name, a: wa.weight, b: wb.weight });
  }
  common.sort((x, y) => Math.min(y.a, y.b) - Math.min(x.a, x.b));
  return { overlap: Math.round(overlap * 10) / 10, common };
}

export interface Exposure {
  id: string;
  name: string;
  sector: string;
  value: number;
  shareOfEquity: number;
  funds: { id: string; name: string; value: number }[];
}

export interface OverlapReport {
  covered: { holding: Holding; data: FundHoldings }[];
  missing: Holding[];
  pairs: PairOverlap[];
  /** Your rupee exposure to each stock across funds */
  exposure: Exposure[];
  /** Sector look-through (equity only) */
  sectors: { sector: string; value: number; share: number }[];
  /** Funds without holdings data that share a category — likely similar portfolios. */
  sameCategory: { category: string; funds: Holding[] }[];
  equityValue: number;
  /** Share of equity-fund value whose holdings come from official disclosures */
  officialCoverage: number;
  /** Latest disclosure month used, "YYYY-MM" */
  dataMonth: string | null;
  /** Share of your equity money in your top 10 look-through stocks */
  top10Share: number;
}

export const isEquityLike = (h: Holding) =>
  h.assetClass === "Equity" || h.assetClass === "International" || (h.assetClass === "Hybrid" && !/arbitrage/i.test(h.category));

export function overlapReport(holdings: Holding[], index: HoldingsIndex | null = null): OverlapReport {
  const equity = holdings.filter(isEquityLike);
  const covered: OverlapReport["covered"] = [];
  const missing: Holding[] = [];
  for (const h of equity) {
    const d = holdingsFor(h, index);
    if (d && d.holdings.length) covered.push({ holding: h, data: d });
    else missing.push(h);
  }

  const pairs: PairOverlap[] = [];
  for (let i = 0; i < covered.length; i++)
    for (let j = i + 1; j < covered.length; j++) {
      const p = pairOverlap(covered[i].data.holdings, covered[j].data.holdings);
      pairs.push({ a: covered[i].holding.id, b: covered[j].holding.id, ...p, ...verdictFor(p.overlap) });
    }
  pairs.sort((x, y) => y.overlap - x.overlap);

  const equityValue = equity.reduce((s, h) => s + h.value, 0);
  const ex = new Map<string, Exposure>();
  const sec = new Map<string, number>();
  for (const { holding, data } of covered) {
    for (const w of data.holdings) {
      const v = (holding.value * w.weight) / 100;
      const e = ex.get(w.id) ?? { id: w.id, name: w.name, sector: w.sector, value: 0, shareOfEquity: 0, funds: [] };
      e.value += v;
      e.funds.push({ id: holding.id, name: holding.shortName, value: v });
      ex.set(w.id, e);
      const s = w.sector && w.sector !== "Other" ? w.sector : "Other / unclassified";
      sec.set(s, (sec.get(s) ?? 0) + v);
    }
  }
  const exposure = [...ex.values()]
    .map((e) => ({ ...e, value: Math.round(e.value), shareOfEquity: equityValue ? e.value / equityValue : 0, funds: e.funds.sort((a, b) => b.value - a.value) }))
    .sort((a, b) => b.value - a.value);
  const secTotal = [...sec.values()].reduce((a, b) => a + b, 0);
  const sectors = [...sec.entries()]
    .map(([sector, value]) => ({ sector, value: Math.round(value), share: secTotal ? value / secTotal : 0 }))
    .sort((a, b) => b.value - a.value);

  const byCat = new Map<string, Holding[]>();
  for (const h of missing) byCat.set(h.category, [...(byCat.get(h.category) ?? []), h]);
  const sameCategory = [...byCat.entries()].filter(([, fs]) => fs.length > 1).map(([category, funds]) => ({ category, funds }));

  const official = covered.filter((c) => c.data.source !== "approximate").reduce((s, c) => s + c.holding.value, 0);
  const months = covered.filter((c) => c.data.source !== "approximate").map((c) => c.data.asOf).sort();
  const top10 = exposure.slice(0, 10).reduce((s, e) => s + e.value, 0);

  return {
    covered,
    missing,
    pairs,
    exposure,
    sectors,
    sameCategory,
    equityValue,
    officialCoverage: equityValue ? official / equityValue : 0,
    dataMonth: months.length ? months[months.length - 1] : null,
    top10Share: equityValue ? top10 / equityValue : 0,
  };
}

export const SOURCE_LABEL: Record<DataSource, string> = {
  disclosure: "Official AMC disclosure",
  "index-proxy": "Index portfolio (from a sibling index fund's disclosure)",
  approximate: "Approximate snapshot — not live data",
};

