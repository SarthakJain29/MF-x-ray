/** Expense ratios: AMFI snapshot (public/data/ter.json) with category-based fallback estimates. */
import { AssetClass } from "../finance/categorize";
import { schemeKey } from "../finance/categorize";

export interface TerFile {
  source: string;
  month: string;
  generatedAt: string;
  /** scheme name -> [regularTER%, directTER%] */
  schemes: Record<string, [number | null, number | null]>;
}

export interface TerInfo {
  regular: number | null;
  direct: number | null;
  source: "amfi" | "estimate";
  month?: string;
}

export class TerIndex {
  private map = new Map<string, [number | null, number | null]>();
  readonly month: string;
  constructor(file: TerFile) {
    this.month = file.month;
    for (const [name, v] of Object.entries(file.schemes)) {
      const k = schemeKey(name);
      if (!this.map.has(k)) this.map.set(k, v);
    }
  }
  lookup(name: string): TerInfo | null {
    const v = this.map.get(schemeKey(name));
    if (!v) return null;
    return { regular: v[0], direct: v[1], source: "amfi", month: this.month };
  }
}

/**
 * Typical TERs (% p.a.) used ONLY when a scheme isn't found in the AMFI snapshot.
 * Rough medians of Indian funds by type; shown to the user as "estimated".
 */
const ESTIMATES: { test: RegExp; regular: number; direct: number }[] = [
  { test: /index|etf/i, regular: 0.6, direct: 0.2 },
  { test: /liquid|overnight|money market/i, regular: 0.3, direct: 0.15 },
  { test: /arbitrage/i, regular: 1.0, direct: 0.35 },
  { test: /ultra short|short duration|corporate bond|banking|gilt|dynamic bond|debt|credit/i, regular: 0.9, direct: 0.35 },
  { test: /hybrid|balanced|multi asset|equity savings/i, regular: 1.9, direct: 0.75 },
  { test: /small cap|mid cap|sectoral|thematic/i, regular: 1.8, direct: 0.7 },
  { test: /.*/, regular: 1.7, direct: 0.7 },
];

export function estimateTer(category: string, assetClass: AssetClass, name: string): TerInfo {
  const hay = `${category} ${/index|etf|nifty|sensex/i.test(name) ? "index" : ""} ${assetClass === "Debt" ? "debt" : ""}`;
  const e = ESTIMATES.find((x) => x.test.test(hay))!;
  return { regular: e.regular, direct: e.direct, source: "estimate" };
}

let cached: Promise<TerIndex | null> | null = null;
export function loadTerIndex(): Promise<TerIndex | null> {
  if (!cached) {
    cached = fetch("/data/ter.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((f: TerFile) => new TerIndex(f))
      .catch(() => null);
  }
  return cached;
}
