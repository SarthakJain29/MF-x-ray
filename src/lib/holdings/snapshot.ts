/**
 * Compact holdings snapshot built from AMC monthly portfolio disclosures (scripts/holdings/ingest.ts).
 * Stock identity is the ISIN; schemes are matched to the user's CAS by plan ISIN first, then by name.
 */
import { compactKey, planNameKey } from "./keys";

export interface HoldingsSnapshotFile {
  version: 1;
  generatedAt: string;
  /** Most common disclosure month, "YYYY-MM" */
  month: string;
  sources: { amc: string; month: string; schemes: number; files: string[] }[];
  notCovered: { amc: string; reason: string }[];
  sectors: string[];
  /** [isin, display name, sector index] */
  stocks: [string, string, number][];
  schemes: {
    /** scheme name as disclosed */
    n: string;
    /** AMC index into sources */
    a: number;
    /** disclosure month YYYY-MM */
    m: string;
    /** compact name key */
    k: string;
    /** plan/option ISINs from AMFI's master (direct/regular, growth/IDCW) */
    i: string[];
    /** % of net assets in equity (Indian + foreign) */
    e: number;
    /** flattened [stockIndex, weight in basis points, ...] — equity holdings only */
    h: number[];
  }[];
}

export interface StockWeight {
  isin: string;
  name: string;
  sector: string;
  /** % of the fund's net assets */
  weight: number;
}

export interface SchemeHoldings {
  scheme: string;
  amc: string;
  /** YYYY-MM */
  month: string;
  equityPct: number;
  holdings: StockWeight[];
}

export class HoldingsIndex {
  readonly month: string;
  readonly file: HoldingsSnapshotFile;
  private byIsin = new Map<string, number>();
  private byKey = new Map<string, number[]>();

  constructor(file: HoldingsSnapshotFile) {
    this.file = file;
    this.month = file.month;
    file.schemes.forEach((s, idx) => {
      for (const isin of s.i) this.byIsin.set(isin, idx);
      this.byKey.set(s.k, [...(this.byKey.get(s.k) ?? []), idx]);
    });
  }

  get schemeCount() {
    return this.file.schemes.length;
  }

  private expand(idx: number): SchemeHoldings {
    const s = this.file.schemes[idx];
    const holdings: StockWeight[] = [];
    for (let j = 0; j < s.h.length; j += 2) {
      const [isin, name, sec] = this.file.stocks[s.h[j]];
      holdings.push({ isin, name, sector: this.file.sectors[sec] ?? "Other", weight: s.h[j + 1] / 100 });
    }
    return { scheme: s.n, amc: this.file.sources[s.a]?.amc ?? "", month: s.m, equityPct: s.e, holdings };
  }

  /** Find a scheme by the user's plan ISIN (exact) or by name (same scheme, any plan). */
  lookup(isin: string | null | undefined, name: string): SchemeHoldings | null {
    if (isin) {
      const idx = this.byIsin.get(isin.toUpperCase());
      if (idx != null) return this.expand(idx);
    }
    const hits = this.byKey.get(planNameKey(name)) ?? this.byKey.get(compactKey(name));
    return hits?.length === 1 ? this.expand(hits[0]) : null;
  }
}

let cached: Promise<HoldingsIndex | null> | null = null;
export function loadHoldingsIndex(): Promise<HoldingsIndex | null> {
  if (!cached) {
    cached = fetch("/data/holdings.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((f: HoldingsSnapshotFile) => new HoldingsIndex(f))
      .catch(() => null);
  }
  return cached;
}
