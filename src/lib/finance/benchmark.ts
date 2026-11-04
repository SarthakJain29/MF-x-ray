/**
 * Historical reference point: what the SAME cash flows, on the SAME dates, would be worth in a benchmark
 * index fund. A fact about the past — not a recommendation and not a forecast.
 */
import type { CashFlow } from "./xirr";
import { xirr } from "./xirr";
import type { NavSeries } from "./costs";
import { navOn } from "./costs";

/** UTI Nifty 50 Index Fund – Direct – Growth (AMFI code). Used as a low-cost broad-market reference. */
export const BENCHMARK = { code: 120716, label: "Nifty 50 index fund" } as const;

export interface BenchmarkResult {
  value: number;
  xirr: number | null;
  asOf: string;
}

export function simulateBenchmark(flows: CashFlow[], series: NavSeries): BenchmarkResult | null {
  if (!series.dates.length || !flows.length) return null;
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted[0].date < series.dates[0]) return null; // benchmark didn't exist yet
  let units = 0;
  for (const f of sorted) {
    const nav = navOn(series, f.date);
    if (!nav) return null;
    units += -f.amount / nav; // investing (negative flow) buys units; withdrawals sell the same rupees
    if (units < 0) units = 0;
  }
  const last = series.navs[series.navs.length - 1];
  const asOf = series.dates[series.dates.length - 1];
  const value = units * last;
  return { value, xirr: xirr([...sorted, { date: asOf, amount: value }]), asOf };
}
