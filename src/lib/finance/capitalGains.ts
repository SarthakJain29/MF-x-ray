/**
 * Capital-gains ESTIMATE for Indian mutual funds, using FIFO lots (see lots.ts).
 * Educational estimate only — not tax advice. Rules as checked in November 2026: Budget 2026 / Finance Act 2026 left
 * MF capital-gains rates unchanged; the Income-tax Act, 2025 (in force from 1 April 2026) renumbered the sections but
 * kept the rates, thresholds and holding periods introduced by Finance (No. 2) Act 2024. See developer.md › Tax rules.
 */
import type { Holding } from "./portfolio";
import type { NavSeries } from "./costs";
import { navOn } from "./costs";

export type TaxClass = "equity" | "debt-specified" | "debt-legacy" | "other";
export type Term = "short" | "long" | "unknown";

export const RULES = {
  checkedOn: "2026-11-05",
  /** sales on/after this date use the current rates */
  currentFrom: "2024-07-23",
  equity: { longAfterMonths: 12, stcgRate: 0.2, ltcgRate: 0.125, ltcgExemption: 125000 },
  /** debt funds acquired before 1 Apr 2023, gold/silver, international FoFs, hybrids with < 65% equity */
  other: { longAfterMonths: 24, ltcgRate: 0.125 },
  /** "specified mutual funds" (≥ 65% debt) acquired on/after 1 Apr 2023: always taxed at slab rate */
  specifiedFrom: "2023-04-01",
  grandfatherCutoff: "2018-01-31",
  cess: 0.04,
} as const;

export const TAX_CLASS_LABEL: Record<TaxClass, string> = {
  equity: "Equity-oriented",
  "debt-specified": "Debt (bought on/after 1 Apr 2023)",
  "debt-legacy": "Debt (bought before 1 Apr 2023)",
  other: "Other non-equity",
};

const EQUITY_HYBRID = /aggressive hybrid|balanced advantage|dynamic asset|arbitrage|equity savings/i;
const DEBT_HYBRID = /conservative hybrid/i;

/** Broad tax treatment of a fund. Multi-asset funds use the disclosed equity share when we have it. */
export function fundTaxType(h: Pick<Holding, "assetClass" | "category" | "name">, equityPct?: number | null): "equity" | "debt" | "other" {
  if (h.assetClass === "Equity") return "equity";
  if (h.assetClass === "Hybrid") {
    if (EQUITY_HYBRID.test(h.category)) return "equity";
    if (DEBT_HYBRID.test(h.category)) return "debt";
    if (equityPct != null) return equityPct >= 65 ? "equity" : equityPct <= 35 ? "debt" : "other";
    return "other";
  }
  if (h.assetClass === "Debt") return "debt";
  return "other"; // gold & silver, international FoFs, unclassified
}

export function taxClassFor(type: "equity" | "debt" | "other", acquired: string | null): TaxClass {
  if (type === "equity") return "equity";
  if (type === "other") return "other";
  if (!acquired) return "debt-legacy";
  return acquired >= RULES.specifiedFrom ? "debt-specified" : "debt-legacy";
}

function addMonths(iso: string, m: number): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + m);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Long-term only when held for MORE than the threshold: sold on the anniversary is still short-term. */
export function termOf(cls: TaxClass, acquired: string | null, sold: string): Term {
  if (cls === "debt-specified") return "short"; // deemed short-term whatever the holding period
  if (!acquired) return "unknown";
  const months = cls === "equity" ? RULES.equity.longAfterMonths : RULES.other.longAfterMonths;
  return sold > addMonths(acquired, months) ? "long" : "short";
}

/** Date from which units bought on `acquired` count as long-term. */
export function longTermFrom(cls: TaxClass, acquired: string): string | null {
  if (cls === "debt-specified") return null;
  const d = new Date(addMonths(acquired, cls === "equity" ? RULES.equity.longAfterMonths : RULES.other.longAfterMonths) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Indian financial year label: 2026-05-10 → "2026-27". */
export function fyOf(iso: string): string {
  const y = +iso.slice(0, 4);
  const start = iso.slice(5) >= "04-01" ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export interface GainSlice {
  holdingId: string;
  fund: string;
  taxClass: TaxClass;
  term: Term;
  acquired: string | null;
  /** sale date, or the valuation date for unrealised gains */
  date: string;
  fy: string;
  units: number;
  cost: number;
  /** cost after grandfathering (equity units acquired on/before 31 Jan 2018) */
  taxCost: number;
  value: number;
  gain: number;
  grandfathered: boolean;
  /** grandfathering applies but no 31-Jan-2018 NAV was available */
  grandfatherMissing: boolean;
}

export interface GainOptions {
  /** NAV history by AMFI code (for the 31 Jan 2018 grandfathering NAV) */
  navs?: Record<number, NavSeries>;
  /** disclosed equity % per holding id (multi-asset funds) */
  equityPct?: Record<string, number | null>;
}

function slice(h: Holding, type: "equity" | "debt" | "other", acquired: string | null, date: string, units: number, cost: number, value: number, o: GainOptions): GainSlice {
  const taxClass = taxClassFor(type, acquired);
  let taxCost = cost;
  let grandfathered = false;
  let grandfatherMissing = false;
  if (taxClass === "equity" && acquired && acquired <= RULES.grandfatherCutoff) {
    const series = h.amfiCode != null ? o.navs?.[h.amfiCode] : undefined;
    const fmvNav = series ? navOn(series, RULES.grandfatherCutoff) : null;
    if (fmvNav) {
      // cost = higher of (actual cost, lower of (FMV on 31-Jan-2018, sale value))
      taxCost = Math.max(cost, Math.min(fmvNav * units, value));
      grandfathered = taxCost !== cost;
    } else grandfatherMissing = true;
  }
  return {
    holdingId: h.id,
    fund: h.shortName,
    taxClass,
    term: termOf(taxClass, acquired, date),
    acquired,
    date,
    fy: fyOf(date),
    units,
    cost,
    taxCost,
    value,
    gain: value - taxCost,
    grandfathered,
    grandfatherMissing,
  };
}

/** Gains already realised by sales and switch-outs (mergers are not sales). */
export function realisedGains(holdings: Holding[], o: GainOptions = {}): GainSlice[] {
  const out: GainSlice[] = [];
  for (const h of holdings) {
    const type = fundTaxType(h, o.equityPct?.[h.id]);
    for (const d of h.disposals) {
      for (const s of d.slices) {
        const value = d.units > 0 ? (d.proceeds * s.units) / d.units : 0;
        out.push(slice(h, type, s.acquired, d.date, s.units, s.cost, value, o));
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** What the remaining units would realise if sold at the latest NAV — a what-if, not a suggestion. */
export function unrealisedGains(holdings: Holding[], asOf: string, o: GainOptions = {}): GainSlice[] {
  const out: GainSlice[] = [];
  for (const h of holdings) {
    if (!h.nav || h.units <= 0) continue;
    const type = fundTaxType(h, o.equityPct?.[h.id]);
    for (const lot of h.lots) if (lot.units > 1e-9) out.push(slice(h, type, lot.date, h.navDate ?? asOf, lot.units, lot.cost, lot.units * h.nav, o));
  }
  return out;
}

export interface TaxSummary {
  equityST: number;
  equityLT: number;
  /** equity LTCG exemption available / used */
  exemption: number;
  exemptionUsed: number;
  equityLTTaxable: number;
  otherLT: number;
  /** gains taxed at the investor's slab rate (debt-specified, other/legacy short-term) */
  slab: number;
  unknown: number;
  tax: { equityST: number; equityLT: number; otherLT: number; slab: number; cess: number; total: number };
}

/**
 * Estimated tax on a set of gains (one FY). Losses are netted within each bucket only; cross-bucket set-off,
 * carry-forward, surcharge and other income are not modelled.
 */
export function summarise(slices: GainSlice[], slabRatePct: number, exemptionAlreadyUsed = 0): TaxSummary {
  let equityST = 0;
  let equityLT = 0;
  let otherLT = 0;
  let slab = 0;
  let unknown = 0;
  for (const s of slices) {
    if (s.term === "unknown") unknown += s.gain;
    else if (s.taxClass === "equity") {
      if (s.term === "long") equityLT += s.gain;
      else equityST += s.gain;
    }
    else if (s.term === "long" && s.taxClass !== "debt-specified") otherLT += s.gain;
    else slab += s.gain;
  }
  const exemption = Math.max(0, RULES.equity.ltcgExemption - exemptionAlreadyUsed);
  const exemptionUsed = Math.min(exemption, Math.max(0, equityLT));
  const equityLTTaxable = Math.max(0, equityLT - exemptionUsed);
  const t = {
    equityST: Math.max(0, equityST) * RULES.equity.stcgRate,
    equityLT: equityLTTaxable * RULES.equity.ltcgRate,
    otherLT: Math.max(0, otherLT) * RULES.other.ltcgRate,
    slab: Math.max(0, slab) * (slabRatePct / 100),
  };
  const base = t.equityST + t.equityLT + t.otherLT + t.slab;
  return { equityST, equityLT, exemption, exemptionUsed, equityLTTaxable, otherLT, slab, unknown, tax: { ...t, cess: base * RULES.cess, total: base * (1 + RULES.cess) } };
}

/** IDCW (dividend) income by FY — taxed as income at slab rate (TDS may apply), shown for information. */
export function idcwIncome(holdings: Holding[]): Record<string, { paid: number; reinvested: number }> {
  const out: Record<string, { paid: number; reinvested: number }> = {};
  for (const h of holdings)
    for (const t of h.transactions) {
      if (t.type !== "DIVIDEND_PAYOUT" && t.type !== "DIVIDEND_REINVEST") continue;
      const fy = fyOf(t.date);
      out[fy] ??= { paid: 0, reinvested: 0 };
      out[fy][t.type === "DIVIDEND_PAYOUT" ? "paid" : "reinvested"] += Math.abs(t.amount ?? 0);
    }
  return out;
}

/** Remaining short-term lots of a fund and when they turn long-term (facts, for planning awareness). */
export function upcomingLongTerm(slices: GainSlice[], asOf: string): { holdingId: string; fund: string; date: string; units: number; gain: number }[] {
  const out = new Map<string, { holdingId: string; fund: string; date: string; units: number; gain: number }>();
  for (const s of slices) {
    if (s.term !== "short" || !s.acquired) continue;
    const from = longTermFrom(s.taxClass, s.acquired);
    if (!from || from <= asOf) continue;
    const prev = out.get(s.holdingId);
    if (!prev || from < prev.date) out.set(s.holdingId, { holdingId: s.holdingId, fund: s.fund, date: from, units: s.units, gain: s.gain });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}
