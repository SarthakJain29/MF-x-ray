/**
 * Cost maths. Every projection here uses a growth rate the USER chooses — it is a what-if, not a forecast.
 */
import type { Holding } from "./portfolio";
import { paidTer } from "./portfolio";

/** Rupees lost to an expense ratio over `years`, at a user-chosen gross growth rate. */
export function terDrag(value: number, terPct: number, years: number, assumedGrossPct: number): number {
  const g = assumedGrossPct / 100;
  const t = terPct / 100;
  const without = value * Math.pow(1 + g, years);
  const withTer = value * Math.pow(1 + g - t, years);
  return Math.max(0, without - withTer);
}

/** Extra rupees a regular plan costs vs its direct twin over `years`. */
export function regularVsDirectGap(value: number, regularTer: number, directTer: number, years: number, assumedGrossPct: number): number {
  const g = assumedGrossPct / 100;
  const direct = value * Math.pow(1 + g - directTer / 100, years);
  const regular = value * Math.pow(1 + g - regularTer / 100, years);
  return Math.max(0, direct - regular);
}

export interface CostRow {
  holding: Holding;
  ter: number | null;
  annualCost: number;
  drag: Record<number, number>;
  /** For regular plans: extra TER vs direct, and the gap over each horizon. */
  extraTer: number | null;
  regularGap: Record<number, number> | null;
}

export const HORIZONS = [5, 10, 20] as const;

export function costTable(holdings: Holding[], assumedGrossPct: number): CostRow[] {
  return holdings.map((h) => {
    const ter = paidTer(h);
    const drag: Record<number, number> = {};
    for (const y of HORIZONS) drag[y] = ter == null ? 0 : terDrag(h.value, ter, y, assumedGrossPct);
    let extraTer: number | null = null;
    let regularGap: Record<number, number> | null = null;
    if (h.plan === "Regular" && h.ter.regular != null && h.ter.direct != null) {
      extraTer = Math.max(0, h.ter.regular - h.ter.direct);
      regularGap = {};
      for (const y of HORIZONS) regularGap[y] = regularVsDirectGap(h.value, h.ter.regular, h.ter.direct, y, assumedGrossPct);
    }
    return { holding: h, ter, annualCost: ter == null ? 0 : (h.value * ter) / 100, drag, extraTer, regularGap };
  });
}

export interface NavSeries {
  /** ascending ISO dates */
  dates: string[];
  navs: number[];
}

export function navOn(series: NavSeries, date: string): number | null {
  // Last NAV on or before date (binary search).
  let lo = 0;
  let hi = series.dates.length - 1;
  if (hi < 0 || series.dates[0] > date) return series.navs[0] ?? null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series.dates[mid] <= date) lo = mid;
    else hi = mid - 1;
  }
  return series.navs[lo];
}

/**
 * What a regular-plan holding would be worth today had the same money gone into the direct plan
 * on the same dates. Uses actual historical NAVs of both plans — a fact about the past, not a forecast.
 */
export function pastRegularCost(h: Holding, direct: NavSeries, directNavToday: number): { directValue: number; lost: number } | null {
  if (h.plan !== "Regular" || h.incompleteHistory) return null;
  let regUnits = 0;
  let dirUnits = 0;
  for (const t of h.transactions) {
    const u = t.units ?? 0;
    if (u > 0 && t.amount != null && t.type !== "SEGREGATION") {
      const nav = navOn(direct, t.date);
      if (!nav) return null;
      regUnits += u;
      dirUnits += Math.abs(t.amount) / nav;
    } else if (u < 0) {
      // Redeem the same fraction of holdings from the direct-plan shadow portfolio.
      const frac = regUnits > 0 ? Math.min(1, -u / regUnits) : 0;
      regUnits += u;
      dirUnits -= dirUnits * frac;
    }
  }
  const directValue = dirUnits * directNavToday;
  return { directValue, lost: Math.max(0, directValue - h.value) };
}

/** Rough fallback when direct NAV history isn't available: average balance × TER gap × years held. */
export function estimatedPastRegularCost(h: Holding, asOf: string): number | null {
  if (h.plan !== "Regular" || h.ter.regular == null || h.ter.direct == null || !h.firstDate) return null;
  const years = (Date.parse(asOf) - Date.parse(h.firstDate)) / (365 * 86400000);
  const avgBalance = (h.cost + h.value) / 2;
  return Math.max(0, avgBalance * ((h.ter.regular - h.ter.direct) / 100) * years);
}
